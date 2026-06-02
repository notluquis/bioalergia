import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// cart.ts toca db.cart / db.cartItem / db.product. Mockeamos @finanzas/db
// (+ slices por la regla del repo). El foco son la lógica PURA (token/hash,
// cookie attrs, serializeCart math) y las reglas de validación (stock, qty
// boundaries, merge de líneas) en addItemToCart / updateItemQty.

const {
  mockDb,
  mockCartFindUnique,
  mockCartCreate,
  mockProductFindUnique,
  mockItemFindUnique,
  mockItemCreate,
  mockItemUpdate,
  mockItemUpdateMany,
  mockItemDeleteMany,
} = vi.hoisted(() => {
  const mockCartFindUnique = vi.fn();
  const mockCartCreate = vi.fn();
  const mockProductFindUnique = vi.fn();
  const mockItemFindUnique = vi.fn();
  const mockItemCreate = vi.fn();
  const mockItemUpdate = vi.fn();
  const mockItemUpdateMany = vi.fn();
  const mockItemDeleteMany = vi.fn();
  const mockDb = {
    cart: {
      findUnique: (...a: unknown[]) => mockCartFindUnique(...a),
      create: (...a: unknown[]) => mockCartCreate(...a),
    },
    product: { findUnique: (...a: unknown[]) => mockProductFindUnique(...a) },
    cartItem: {
      findUnique: (...a: unknown[]) => mockItemFindUnique(...a),
      create: (...a: unknown[]) => mockItemCreate(...a),
      update: (...a: unknown[]) => mockItemUpdate(...a),
      updateMany: (...a: unknown[]) => mockItemUpdateMany(...a),
      deleteMany: (...a: unknown[]) => mockItemDeleteMany(...a),
    },
  };
  return {
    mockDb,
    mockCartFindUnique,
    mockCartCreate,
    mockProductFindUnique,
    mockItemFindUnique,
    mockItemCreate,
    mockItemUpdate,
    mockItemUpdateMany,
    mockItemDeleteMany,
  };
});

vi.mock("@finanzas/db", () => ({ db: mockDb, kysely: {} }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));

const {
  CART_COOKIE_NAME,
  generateCartToken,
  hashCartToken,
  buildCartCookie,
  serializeCart,
  addItemToCart,
  updateItemQty,
  removeItem,
  clearCart,
} = await import("../cart.ts");

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Token / hash — PURE crypto
// ---------------------------------------------------------------------------

describe("generateCartToken", () => {
  it("produce un hash sha256-hex (64 chars) consistente con el token", () => {
    const { token, hash } = generateCartToken();
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    // El hash DEBE ser sha256(token) en hex — mata mutantes que cambian update()/digest().
    expect(hash).toBe(createHash("sha256").update(token).digest("hex"));
  });

  it("usa base64url (sin +, /, ni padding =) para el token", () => {
    const { token } = generateCartToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token).not.toContain("=");
  });

  it("genera tokens distintos en llamadas sucesivas (randomBytes)", () => {
    const a = generateCartToken();
    const b = generateCartToken();
    expect(a.token).not.toBe(b.token);
    expect(a.hash).not.toBe(b.hash);
  });
});

describe("hashCartToken", () => {
  it("es determinístico: mismo token → mismo hash", () => {
    expect(hashCartToken("abc")).toBe(hashCartToken("abc"));
  });

  it("coincide con sha256 hex de referencia", () => {
    expect(hashCartToken("hola")).toBe(
      createHash("sha256").update("hola").digest("hex")
    );
  });

  it("hashea el token EXACTO (distinto input → distinto hash)", () => {
    expect(hashCartToken("a")).not.toBe(hashCartToken("b"));
  });

  it("generateCartToken().hash es reproducible vía hashCartToken", () => {
    const { token, hash } = generateCartToken();
    expect(hashCartToken(token)).toBe(hash);
  });
});

// ---------------------------------------------------------------------------
// Cookie attrs — PURE
// ---------------------------------------------------------------------------

describe("buildCartCookie", () => {
  it("arma la cookie con los flags de seguridad correctos (secure=true)", () => {
    const c = buildCartCookie("tok123", true);
    expect(c).toEqual({
      name: CART_COOKIE_NAME,
      value: "tok123",
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "lax",
    });
  });

  it("propaga secure=false sin tocar el resto", () => {
    const c = buildCartCookie("tok", false);
    expect(c.secure).toBe(false);
    expect(c.httpOnly).toBe(true);
    expect(c.sameSite).toBe("lax");
  });

  it("usa exactamente 30 días de maxAge (2592000 s)", () => {
    expect(buildCartCookie("t", true).maxAge).toBe(2_592_000);
  });

  it("el nombre de la cookie es 'cart_token'", () => {
    expect(CART_COOKIE_NAME).toBe("cart_token");
    expect(buildCartCookie("t", true).name).toBe("cart_token");
  });

  it("path es root '/'", () => {
    expect(buildCartCookie("t", true).path).toBe("/");
  });
});

// ---------------------------------------------------------------------------
// serializeCart — PURE transform + totals math
// ---------------------------------------------------------------------------

type RawItem = {
  id: number;
  productId: number;
  qty: number;
  unitPriceClp: number;
  product: {
    id: number;
    sku: string;
    slug: string;
    name: string;
    brand: string | null;
    availableQty: number;
    images: Array<{ cdnUrl: string }>;
  };
};

function rawCart(items: RawItem[], over: Partial<{ id: number; currency: string }> = {}) {
  return {
    id: over.id ?? 1,
    currency: over.currency ?? "CLP",
    items,
    // campos extra ignorados por serializeCart, presentes en el row real
    tokenHash: "x",
    userId: null,
    expiresAt: new Date(),
  };
}

function item(over: Partial<RawItem> = {}): RawItem {
  return {
    id: over.id ?? 100,
    productId: over.productId ?? 50,
    qty: over.qty ?? 2,
    unitPriceClp: over.unitPriceClp ?? 1000,
    product: {
      id: over.product?.id ?? over.productId ?? 50,
      sku: over.product?.sku ?? "SKU-1",
      slug: over.product?.slug ?? "slug-1",
      name: over.product?.name ?? "Prod 1",
      brand: over.product?.brand ?? "Acme",
      availableQty: over.product?.availableQty ?? 99,
      images: over.product?.images ?? [{ cdnUrl: "https://cdn/x.jpg" }],
    },
  };
}

// serializeCart está tipado contra el retorno de findCartByToken; el shape
// de fixture coincide en runtime. Cast vía unknown (oxlint banea `any`).
function serialize(cart: ReturnType<typeof rawCart>) {
  return serializeCart(cart as unknown as Parameters<typeof serializeCart>[0]);
}

describe("serializeCart", () => {
  it("carrito vacío → subtotal/total/item_count en 0 y sin items", () => {
    const out = serialize(rawCart([]));
    expect(out.items).toEqual([]);
    expect(out.subtotal_clp).toBe(0);
    expect(out.total_clp).toBe(0);
    expect(out.item_count).toBe(0);
  });

  it("una línea: subtotal = unit_price × qty", () => {
    const out = serialize(rawCart([item({ qty: 3, unitPriceClp: 1500 })]));
    expect(out.subtotal_clp).toBe(4500);
    expect(out.total_clp).toBe(4500);
    expect(out.item_count).toBe(3);
  });

  it("múltiples líneas: suma los productos (no concatena ni promedia)", () => {
    const out = serialize(
      rawCart([
        item({ id: 1, productId: 10, qty: 2, unitPriceClp: 1000 }), // 2000
        item({ id: 2, productId: 20, qty: 3, unitPriceClp: 500 }), //  1500
      ])
    );
    expect(out.subtotal_clp).toBe(3500);
    expect(out.total_clp).toBe(3500);
    // item_count suma cantidades, NO número de líneas
    expect(out.item_count).toBe(5);
    expect(out.items).toHaveLength(2);
  });

  it("total_clp == subtotal_clp (MVP sin shipping/discount)", () => {
    const out = serialize(rawCart([item({ qty: 7, unitPriceClp: 333 })]));
    expect(out.total_clp).toBe(out.subtotal_clp);
    expect(out.total_clp).toBe(2331);
  });

  it("mapea snake_case y campos de producto", () => {
    const out = serialize(
      rawCart(
        [
          item({
            id: 9,
            productId: 77,
            qty: 1,
            unitPriceClp: 4200,
            product: {
              id: 77,
              sku: "SKU-77",
              slug: "prod-77",
              name: "Suero",
              brand: "Bio",
              availableQty: 12,
              images: [{ cdnUrl: "https://cdn/p77.png" }],
            },
          }),
        ],
        { id: 555, currency: "USD" }
      )
    );
    expect(out.id).toBe(555);
    expect(out.currency).toBe("USD");
    const line = out.items[0];
    expect(line).toMatchObject({
      id: 9,
      product_id: 77,
      qty: 1,
      unit_price_clp: 4200,
    });
    expect(line.product).toMatchObject({
      id: 77,
      sku: "SKU-77",
      slug: "prod-77",
      name: "Suero",
      brand: "Bio",
      primary_image_url: "https://cdn/p77.png",
      available_qty: 12,
    });
  });

  it("primary_image_url es null cuando no hay imágenes (?? null)", () => {
    const it0 = item();
    it0.product.images = [];
    const out = serialize(rawCart([it0]));
    expect(out.items[0].product.primary_image_url).toBeNull();
  });

  it("toma la PRIMERA imagen como primary (images[0])", () => {
    const it0 = item();
    it0.product.images = [{ cdnUrl: "https://cdn/first.png" }, { cdnUrl: "https://cdn/second.png" }];
    const out = serialize(rawCart([it0]));
    expect(out.items[0].product.primary_image_url).toBe("https://cdn/first.png");
  });

  it("preserva el orden de las líneas tal cual vienen", () => {
    const out = serialize(
      rawCart([
        item({ id: 3, productId: 30 }),
        item({ id: 1, productId: 10 }),
        item({ id: 2, productId: 20 }),
      ])
    );
    expect(out.items.map((i) => i.id)).toEqual([3, 1, 2]);
  });
});

// ---------------------------------------------------------------------------
// addItemToCart — validación de stock + merge de líneas
// ---------------------------------------------------------------------------

function activeProduct(over: Partial<{ priceClp: number; availableQty: number; safetyStock: number; status: string }> = {}) {
  return {
    id: 50,
    status: over.status ?? "ACTIVE",
    priceClp: over.priceClp ?? 1000,
    availableQty: over.availableQty ?? 10,
    safetyStock: over.safetyStock ?? 2,
  };
}

describe("addItemToCart", () => {
  const opts = { cartId: 1, productId: 50, qty: 3 };

  it("rechaza producto inexistente", async () => {
    mockProductFindUnique.mockResolvedValue(null);
    await expect(addItemToCart(opts)).rejects.toThrow(/no disponible/);
    expect(mockItemCreate).not.toHaveBeenCalled();
  });

  it("rechaza producto no ACTIVE", async () => {
    mockProductFindUnique.mockResolvedValue(activeProduct({ status: "DRAFT" }));
    await expect(addItemToCart(opts)).rejects.toThrow(/no disponible/);
    expect(mockItemCreate).not.toHaveBeenCalled();
  });

  it("sellable = availableQty - safetyStock; rechaza si qty supera sellable", async () => {
    // availableQty 10, safety 8 → sellable 2 < qty 3
    mockProductFindUnique.mockResolvedValue(activeProduct({ availableQty: 10, safetyStock: 8 }));
    await expect(addItemToCart(opts)).rejects.toThrow(/Stock insuficiente \(disponible: 2\)/);
    expect(mockItemCreate).not.toHaveBeenCalled();
  });

  it("permite qty EXACTAMENTE igual a sellable (límite es <, no <=)", async () => {
    // sellable = 10 - 7 = 3 == qty 3
    mockProductFindUnique.mockResolvedValue(activeProduct({ availableQty: 10, safetyStock: 7, priceClp: 999 }));
    mockItemFindUnique.mockResolvedValue(null);
    await addItemToCart(opts);
    expect(mockItemCreate).toHaveBeenCalledTimes(1);
    const arg = mockItemCreate.mock.calls[0][0] as { data: { qty: number; unitPriceClp: number; cartId: number; productId: number } };
    expect(arg.data).toMatchObject({ qty: 3, unitPriceClp: 999, cartId: 1, productId: 50 });
  });

  it("crea línea nueva cuando no existe (snapshot del precio actual)", async () => {
    mockProductFindUnique.mockResolvedValue(activeProduct({ priceClp: 1234 }));
    mockItemFindUnique.mockResolvedValue(null);
    await addItemToCart(opts);
    expect(mockItemCreate).toHaveBeenCalledTimes(1);
    expect(mockItemUpdate).not.toHaveBeenCalled();
    const arg = mockItemCreate.mock.calls[0][0] as { data: { unitPriceClp: number } };
    expect(arg.data.unitPriceClp).toBe(1234);
  });

  it("MERGE: suma qty existente + nueva en la misma línea", async () => {
    mockProductFindUnique.mockResolvedValue(activeProduct({ availableQty: 20, safetyStock: 0, priceClp: 700 }));
    mockItemFindUnique.mockResolvedValue({ id: 999, qty: 4 });
    await addItemToCart({ cartId: 1, productId: 50, qty: 3 });
    expect(mockItemCreate).not.toHaveBeenCalled();
    expect(mockItemUpdate).toHaveBeenCalledTimes(1);
    const arg = mockItemUpdate.mock.calls[0][0] as { where: { id: number }; data: { qty: number; unitPriceClp: number } };
    expect(arg.where.id).toBe(999);
    expect(arg.data.qty).toBe(7); // 4 + 3
    expect(arg.data.unitPriceClp).toBe(700);
  });

  it("MERGE: rechaza si qty TOTAL (existente+nueva) supera sellable", async () => {
    // sellable = 10 - 2 = 8; existente 6 + nueva 3 = 9 > 8
    mockProductFindUnique.mockResolvedValue(activeProduct({ availableQty: 10, safetyStock: 2 }));
    mockItemFindUnique.mockResolvedValue({ id: 5, qty: 6 });
    await expect(addItemToCart({ cartId: 1, productId: 50, qty: 3 })).rejects.toThrow(
      /Stock insuficiente \(disponible: 8\)/
    );
    expect(mockItemUpdate).not.toHaveBeenCalled();
  });

  it("MERGE: permite total EXACTAMENTE igual a sellable", async () => {
    // sellable 8; existente 5 + nueva 3 = 8 == sellable
    mockProductFindUnique.mockResolvedValue(activeProduct({ availableQty: 10, safetyStock: 2 }));
    mockItemFindUnique.mockResolvedValue({ id: 5, qty: 5 });
    await addItemToCart({ cartId: 1, productId: 50, qty: 3 });
    expect(mockItemUpdate).toHaveBeenCalledTimes(1);
    const arg = mockItemUpdate.mock.calls[0][0] as { data: { qty: number } };
    expect(arg.data.qty).toBe(8);
  });

  it("muestra disponible 0 (no negativo) cuando safetyStock excede availableQty", async () => {
    // sellable = 5 - 9 = -4 → Math.max(0, -4) = 0
    mockProductFindUnique.mockResolvedValue(activeProduct({ availableQty: 5, safetyStock: 9 }));
    await expect(addItemToCart(opts)).rejects.toThrow(/disponible: 0/);
  });
});

// ---------------------------------------------------------------------------
// updateItemQty — delete-on-zero + revalidación de stock
// ---------------------------------------------------------------------------

describe("updateItemQty", () => {
  it("qty=0 → borra la línea sin tocar producto", async () => {
    await updateItemQty({ cartId: 1, productId: 50, qty: 0 });
    expect(mockItemDeleteMany).toHaveBeenCalledTimes(1);
    const arg = mockItemDeleteMany.mock.calls[0][0] as { where: { cartId: number; productId: number } };
    expect(arg.where).toEqual({ cartId: 1, productId: 50 });
    expect(mockProductFindUnique).not.toHaveBeenCalled();
    expect(mockItemUpdateMany).not.toHaveBeenCalled();
  });

  it("qty>0 con producto inexistente → rechaza", async () => {
    mockProductFindUnique.mockResolvedValue(null);
    await expect(updateItemQty({ cartId: 1, productId: 50, qty: 2 })).rejects.toThrow(/no disponible/);
    expect(mockItemUpdateMany).not.toHaveBeenCalled();
  });

  it("qty>0 con producto no ACTIVE → rechaza", async () => {
    mockProductFindUnique.mockResolvedValue(activeProduct({ status: "ARCHIVED" }));
    await expect(updateItemQty({ cartId: 1, productId: 50, qty: 2 })).rejects.toThrow(/no disponible/);
    expect(mockItemUpdateMany).not.toHaveBeenCalled();
  });

  it("rechaza qty que supera sellable", async () => {
    // sellable = 10 - 4 = 6 < qty 7
    mockProductFindUnique.mockResolvedValue(activeProduct({ availableQty: 10, safetyStock: 4 }));
    await expect(updateItemQty({ cartId: 1, productId: 50, qty: 7 })).rejects.toThrow(
      /Stock insuficiente \(disponible: 6\)/
    );
    expect(mockItemUpdateMany).not.toHaveBeenCalled();
  });

  it("setea qty ABSOLUTA (no suma) + snapshot de precio", async () => {
    mockProductFindUnique.mockResolvedValue(activeProduct({ availableQty: 50, safetyStock: 0, priceClp: 888 }));
    await updateItemQty({ cartId: 2, productId: 50, qty: 4 });
    expect(mockItemUpdateMany).toHaveBeenCalledTimes(1);
    const arg = mockItemUpdateMany.mock.calls[0][0] as {
      where: { cartId: number; productId: number };
      data: { qty: number; unitPriceClp: number };
    };
    expect(arg.where).toEqual({ cartId: 2, productId: 50 });
    expect(arg.data).toEqual({ qty: 4, unitPriceClp: 888 });
  });

  it("permite qty EXACTAMENTE igual a sellable", async () => {
    // sellable = 10 - 4 = 6 == qty 6
    mockProductFindUnique.mockResolvedValue(activeProduct({ availableQty: 10, safetyStock: 4 }));
    await updateItemQty({ cartId: 1, productId: 50, qty: 6 });
    expect(mockItemUpdateMany).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// removeItem / clearCart — delete glue (asegura where correcto)
// ---------------------------------------------------------------------------

describe("removeItem / clearCart", () => {
  it("removeItem borra por cartId + productId", async () => {
    await removeItem(7, 13);
    const arg = mockItemDeleteMany.mock.calls[0][0] as { where: { cartId: number; productId: number } };
    expect(arg.where).toEqual({ cartId: 7, productId: 13 });
  });

  it("clearCart borra SOLO por cartId (todas las líneas)", async () => {
    await clearCart(7);
    const arg = mockItemDeleteMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(arg.where).toEqual({ cartId: 7 });
    expect(arg.where).not.toHaveProperty("productId");
  });
});
