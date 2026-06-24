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

import { DomainError } from "../../lib/errors.ts";

// Assert a thrown value is a DomainError with EXACT kind + message. Bare
// `.rejects.toThrow(/regex/)` survives Stryker mutants that swap the kind
// argument or tweak the message; pin both fields to kill them.
async function expectDomainError(
  promise: Promise<unknown>,
  kind: DomainError["kind"],
  message: string
) {
  await expect(promise).rejects.toMatchObject({
    constructor: DomainError,
    kind,
    message,
  });
  // toMatchObject's `constructor` check is loose; assert instanceof explicitly.
  await promise.then(
    () => {
      throw new Error("expected promise to reject");
    },
    (err: unknown) => {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).kind).toBe(kind);
      expect((err as DomainError).message).toBe(message);
    }
  );
}

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
  findCartByToken,
  createCartWithToken,
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
    expect(hashCartToken("hola")).toBe(createHash("sha256").update("hola").digest("hex"));
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
// findCartByToken — hash lookup + exact include shape (db-call args)
// ---------------------------------------------------------------------------

describe("findCartByToken", () => {
  it("hashea el token y busca por tokenHash (no por token plano)", async () => {
    mockCartFindUnique.mockResolvedValue(null);
    await findCartByToken("plain-tok");
    expect(mockCartFindUnique).toHaveBeenCalledTimes(1);
    const arg = mockCartFindUnique.mock.calls[0][0] as { where: { tokenHash: string } };
    const expectedHash = createHash("sha256").update("plain-tok").digest("hex");
    expect(arg.where).toEqual({ tokenHash: expectedHash });
    // NO debe filtrar por el token plano
    expect(arg.where.tokenHash).not.toBe("plain-tok");
  });

  it("incluye items→product→images (isPrimary, take 1) ordenados por id asc", async () => {
    mockCartFindUnique.mockResolvedValue(null);
    await findCartByToken("t");
    const arg = mockCartFindUnique.mock.calls[0][0] as {
      include: {
        items: {
          include: {
            product: {
              include: { images: { where: { isPrimary: boolean }; take: number } };
            };
          };
          orderBy: { id: string };
        };
      };
    };
    expect(arg.include.items.orderBy).toEqual({ id: "asc" });
    expect(arg.include.items.include.product.include.images.where).toEqual({ isPrimary: true });
    expect(arg.include.items.include.product.include.images.take).toBe(1);
  });

  it("devuelve null cuando no hay cart (passthrough del findUnique)", async () => {
    mockCartFindUnique.mockResolvedValue(null);
    expect(await findCartByToken("t")).toBeNull();
  });

  it("devuelve el cart tal cual cuando existe (passthrough)", async () => {
    const row = { id: 42, items: [] };
    mockCartFindUnique.mockResolvedValue(row);
    expect(await findCartByToken("t")).toBe(row);
  });
});

// ---------------------------------------------------------------------------
// createCartWithToken — exact create args + TTL math + currency literal
// ---------------------------------------------------------------------------

describe("createCartWithToken", () => {
  it("crea el cart con tokenHash, userId, currency=CLP y expiresAt = now + 14 días", async () => {
    mockCartCreate.mockResolvedValue({ id: 1, items: [] });
    const before = Date.now();
    await createCartWithToken("the-hash", 7);
    const after = Date.now();
    expect(mockCartCreate).toHaveBeenCalledTimes(1);
    const arg = mockCartCreate.mock.calls[0][0] as {
      data: { tokenHash: string; userId: number | null; currency: string; expiresAt: Date };
    };
    expect(arg.data.tokenHash).toBe("the-hash");
    expect(arg.data.userId).toBe(7);
    expect(arg.data.currency).toBe("CLP");
    // expiresAt = now + 14d (en ms). Comprobamos el delta dentro de la ventana
    // [before, after] para matar mutantes que toquen 14 / 24 / 60 / 1000.
    const ttlMs = 14 * 24 * 60 * 60 * 1000;
    const ts = arg.data.expiresAt.getTime();
    expect(ts).toBeGreaterThanOrEqual(before + ttlMs);
    expect(ts).toBeLessThanOrEqual(after + ttlMs);
    // y NO es exactamente 13 ni 15 días (boundary del literal de días)
    expect(ts).toBeGreaterThan(after + 13 * 24 * 60 * 60 * 1000);
    expect(ts).toBeLessThan(before + 15 * 24 * 60 * 60 * 1000);
  });

  it("acepta userId null (carrito guest)", async () => {
    mockCartCreate.mockResolvedValue({ id: 2, items: [] });
    await createCartWithToken("h", null);
    const arg = mockCartCreate.mock.calls[0][0] as { data: { userId: number | null } };
    expect(arg.data.userId).toBeNull();
  });

  it("incluye items→product→images (isPrimary, take 1) en el create", async () => {
    mockCartCreate.mockResolvedValue({ id: 3, items: [] });
    await createCartWithToken("h", null);
    const arg = mockCartCreate.mock.calls[0][0] as {
      include: {
        items: {
          include: {
            product: { include: { images: { where: { isPrimary: boolean }; take: number } } };
          };
        };
      };
    };
    expect(arg.include.items.include.product.include.images.where).toEqual({ isPrimary: true });
    expect(arg.include.items.include.product.include.images.take).toBe(1);
  });

  it("devuelve el cart creado (passthrough del create)", async () => {
    const created = { id: 99, items: [] };
    mockCartCreate.mockResolvedValue(created);
    expect(await createCartWithToken("h", 1)).toBe(created);
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
    it0.product.images = [
      { cdnUrl: "https://cdn/first.png" },
      { cdnUrl: "https://cdn/second.png" },
    ];
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

function activeProduct(
  over: Partial<{
    priceClp: number;
    availableQty: number;
    safetyStock: number;
    status: string;
  }> = {}
) {
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
    mockProductFindUnique.mockResolvedValue(
      activeProduct({ availableQty: 10, safetyStock: 7, priceClp: 999 })
    );
    mockItemFindUnique.mockResolvedValue(null);
    await addItemToCart(opts);
    expect(mockItemCreate).toHaveBeenCalledTimes(1);
    const arg = mockItemCreate.mock.calls[0][0] as {
      data: { qty: number; unitPriceClp: number; cartId: number; productId: number };
    };
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

  it("busca el producto por id con el select de stock exacto", async () => {
    mockProductFindUnique.mockResolvedValue(activeProduct());
    mockItemFindUnique.mockResolvedValue(null);
    await addItemToCart({ cartId: 1, productId: 50, qty: 1 });
    const arg = mockProductFindUnique.mock.calls[0][0] as {
      where: { id: number };
      select: Record<string, boolean>;
    };
    expect(arg.where).toEqual({ id: 50 });
    expect(arg.select).toEqual({
      id: true,
      status: true,
      priceClp: true,
      availableQty: true,
      safetyStock: true,
    });
  });

  it("busca la línea existente por la clave compuesta cartId_productId", async () => {
    mockProductFindUnique.mockResolvedValue(activeProduct());
    mockItemFindUnique.mockResolvedValue(null);
    await addItemToCart({ cartId: 4, productId: 50, qty: 1 });
    const arg = mockItemFindUnique.mock.calls[0][0] as {
      where: { cartId_productId: { cartId: number; productId: number } };
    };
    expect(arg.where).toEqual({ cartId_productId: { cartId: 4, productId: 50 } });
  });

  it("la línea nueva lleva cartId/productId/qty/unitPriceClp exactos", async () => {
    mockProductFindUnique.mockResolvedValue(activeProduct({ priceClp: 5000 }));
    mockItemFindUnique.mockResolvedValue(null);
    await addItemToCart({ cartId: 8, productId: 50, qty: 2 });
    const arg = mockItemCreate.mock.calls[0][0] as {
      data: { cartId: number; productId: number; qty: number; unitPriceClp: number };
    };
    expect(arg.data).toEqual({ cartId: 8, productId: 50, qty: 2, unitPriceClp: 5000 });
  });

  it("MERGE: suma qty existente + nueva en la misma línea", async () => {
    mockProductFindUnique.mockResolvedValue(
      activeProduct({ availableQty: 20, safetyStock: 0, priceClp: 700 })
    );
    mockItemFindUnique.mockResolvedValue({ id: 999, qty: 4 });
    await addItemToCart({ cartId: 1, productId: 50, qty: 3 });
    expect(mockItemCreate).not.toHaveBeenCalled();
    expect(mockItemUpdate).toHaveBeenCalledTimes(1);
    const arg = mockItemUpdate.mock.calls[0][0] as {
      where: { id: number };
      data: { qty: number; unitPriceClp: number };
    };
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
    const arg = mockItemDeleteMany.mock.calls[0][0] as {
      where: { cartId: number; productId: number };
    };
    expect(arg.where).toEqual({ cartId: 1, productId: 50 });
    expect(mockProductFindUnique).not.toHaveBeenCalled();
    expect(mockItemUpdateMany).not.toHaveBeenCalled();
  });

  it("qty>0 con producto inexistente → rechaza", async () => {
    mockProductFindUnique.mockResolvedValue(null);
    await expect(updateItemQty({ cartId: 1, productId: 50, qty: 2 })).rejects.toThrow(
      /no disponible/
    );
    expect(mockItemUpdateMany).not.toHaveBeenCalled();
  });

  it("qty>0 con producto no ACTIVE → rechaza", async () => {
    mockProductFindUnique.mockResolvedValue(activeProduct({ status: "ARCHIVED" }));
    await expect(updateItemQty({ cartId: 1, productId: 50, qty: 2 })).rejects.toThrow(
      /no disponible/
    );
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
    mockProductFindUnique.mockResolvedValue(
      activeProduct({ availableQty: 50, safetyStock: 0, priceClp: 888 })
    );
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

  it("rechaza qty JUSTO por encima de sellable (boundary <)", async () => {
    // sellable = 10 - 4 = 6; qty 7 > 6 → rechaza
    mockProductFindUnique.mockResolvedValue(activeProduct({ availableQty: 10, safetyStock: 4 }));
    await expect(updateItemQty({ cartId: 1, productId: 50, qty: 7 })).rejects.toBeInstanceOf(
      DomainError
    );
    expect(mockItemUpdateMany).not.toHaveBeenCalled();
  });

  it("busca el producto por id con el select de stock exacto", async () => {
    mockProductFindUnique.mockResolvedValue(activeProduct({ availableQty: 50, safetyStock: 0 }));
    await updateItemQty({ cartId: 1, productId: 50, qty: 2 });
    const arg = mockProductFindUnique.mock.calls[0][0] as {
      where: { id: number };
      select: Record<string, boolean>;
    };
    expect(arg.where).toEqual({ id: 50 });
    expect(arg.select).toEqual({
      priceClp: true,
      availableQty: true,
      safetyStock: true,
      status: true,
    });
  });

  it("NO borra la línea cuando qty>0 (deleteMany solo en qty=0)", async () => {
    mockProductFindUnique.mockResolvedValue(activeProduct({ availableQty: 50, safetyStock: 0 }));
    await updateItemQty({ cartId: 1, productId: 50, qty: 2 });
    expect(mockItemDeleteMany).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// removeItem / clearCart — delete glue (asegura where correcto)
// ---------------------------------------------------------------------------

describe("removeItem / clearCart", () => {
  it("removeItem borra por cartId + productId", async () => {
    await removeItem(7, 13);
    const arg = mockItemDeleteMany.mock.calls[0][0] as {
      where: { cartId: number; productId: number };
    };
    expect(arg.where).toEqual({ cartId: 7, productId: 13 });
  });

  it("clearCart borra SOLO por cartId (todas las líneas)", async () => {
    await clearCart(7);
    const arg = mockItemDeleteMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(arg.where).toEqual({ cartId: 7 });
    expect(arg.where).not.toHaveProperty("productId");
  });
});

// ---------------------------------------------------------------------------
// DomainError branches — EXACT kind + message (Stryker mutant killers)
//
// Cada `throw new DomainError(kind, msg)` en cart.ts es un objetivo de mutación
// (swap del kind, edición del literal del mensaje). Las pruebas de arriba sólo
// usan `.toThrow(/regex/)`, que NO ata el kind ni el texto exacto → el mutante
// sobrevive. Aquí afirmamos instanceof DomainError + `.kind` + `.message`
// literal por cada rama.
// ---------------------------------------------------------------------------

describe("cart DomainError branches (exact kind + message)", () => {
  const opts = { cartId: 1, productId: 50, qty: 3 };

  describe("addItemToCart", () => {
    it('producto inexistente → BAD_REQUEST "Producto no disponible"', async () => {
      mockProductFindUnique.mockResolvedValue(null);
      await expectDomainError(addItemToCart(opts), "BAD_REQUEST", "Producto no disponible");
    });

    it('producto no ACTIVE → BAD_REQUEST "Producto no disponible"', async () => {
      mockProductFindUnique.mockResolvedValue(activeProduct({ status: "DRAFT" }));
      await expectDomainError(addItemToCart(opts), "BAD_REQUEST", "Producto no disponible");
    });

    it('qty > sellable (línea nueva) → UNPROCESSABLE_ENTITY "Stock insuficiente (disponible: N)"', async () => {
      // sellable = 10 - 8 = 2 < qty 3
      mockProductFindUnique.mockResolvedValue(activeProduct({ availableQty: 10, safetyStock: 8 }));
      await expectDomainError(
        addItemToCart(opts),
        "UNPROCESSABLE_ENTITY",
        "Stock insuficiente (disponible: 2)"
      );
    });

    it("sellable negativo → mensaje interpola Math.max(0, …) = 0", async () => {
      // sellable = 5 - 9 = -4 → disponible mostrado 0
      mockProductFindUnique.mockResolvedValue(activeProduct({ availableQty: 5, safetyStock: 9 }));
      await expectDomainError(
        addItemToCart(opts),
        "UNPROCESSABLE_ENTITY",
        "Stock insuficiente (disponible: 0)"
      );
    });

    it("MERGE: total > sellable → UNPROCESSABLE_ENTITY con disponible exacto", async () => {
      // sellable = 10 - 2 = 8; existente 6 + nueva 3 = 9 > 8
      mockProductFindUnique.mockResolvedValue(activeProduct({ availableQty: 10, safetyStock: 2 }));
      mockItemFindUnique.mockResolvedValue({ id: 5, qty: 6 });
      await expectDomainError(
        addItemToCart({ cartId: 1, productId: 50, qty: 3 }),
        "UNPROCESSABLE_ENTITY",
        "Stock insuficiente (disponible: 8)"
      );
    });
  });

  describe("updateItemQty", () => {
    it('producto inexistente → BAD_REQUEST "Producto no disponible"', async () => {
      mockProductFindUnique.mockResolvedValue(null);
      await expectDomainError(
        updateItemQty({ cartId: 1, productId: 50, qty: 2 }),
        "BAD_REQUEST",
        "Producto no disponible"
      );
    });

    it('producto no ACTIVE → BAD_REQUEST "Producto no disponible"', async () => {
      mockProductFindUnique.mockResolvedValue(activeProduct({ status: "ARCHIVED" }));
      await expectDomainError(
        updateItemQty({ cartId: 1, productId: 50, qty: 2 }),
        "BAD_REQUEST",
        "Producto no disponible"
      );
    });

    it('qty > sellable → UNPROCESSABLE_ENTITY "Stock insuficiente (disponible: N)"', async () => {
      // sellable = 10 - 4 = 6 < qty 7
      mockProductFindUnique.mockResolvedValue(activeProduct({ availableQty: 10, safetyStock: 4 }));
      await expectDomainError(
        updateItemQty({ cartId: 1, productId: 50, qty: 7 }),
        "UNPROCESSABLE_ENTITY",
        "Stock insuficiente (disponible: 6)"
      );
    });

    it("sellable negativo → disponible mostrado 0 (Math.max)", async () => {
      // sellable = 3 - 10 = -7 → 0
      mockProductFindUnique.mockResolvedValue(activeProduct({ availableQty: 3, safetyStock: 10 }));
      await expectDomainError(
        updateItemQty({ cartId: 1, productId: 50, qty: 1 }),
        "UNPROCESSABLE_ENTITY",
        "Stock insuficiente (disponible: 0)"
      );
    });
  });
});
