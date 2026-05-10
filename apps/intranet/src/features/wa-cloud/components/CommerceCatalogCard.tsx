import { Button, Card, Chip, Spinner } from "@heroui/react";
import { Save, Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { SelectInput, TextInput } from "@/features/outreach/components/FormField";
import { toast } from "@/lib/toast-interceptor";
import { useAccounts, useCommerceProducts, useSetCommerceCatalog } from "../hooks/useWaCloud";

// Per-account Meta Commerce catalog: link a catalog id (managed in
// Meta Business Suite) so MPM and single-product messages can pull
// products from it. Once set, lists current products for inspection.
export function CommerceCatalogCard() {
  const accounts = useAccounts();
  const setCat = useSetCommerceCatalog();
  const allAccounts =
    accounts.data?.accounts.map((a) => ({
      id: a.id,
      label: a.displayName ?? a.wabaId,
      // commerceCatalogId comes back via accountWithPhonesSchema once the
      // contracts are extended; today we re-fetch via the products query.
    })) ?? [];

  const [accountId, setAccountId] = useState("");
  useEffect(() => {
    if (!accountId && allAccounts[0]) setAccountId(String(allAccounts[0].id));
  }, [allAccounts, accountId]);

  const numericAccountId = accountId ? Number.parseInt(accountId, 10) : undefined;
  const products = useCommerceProducts(
    numericAccountId ? { accountId: numericAccountId, limit: 50 } : undefined
  );

  const [catalogId, setCatalogId] = useState("");
  const [search, setSearch] = useState("");

  // Hydrate input from server on every account/products refresh.
  useEffect(() => {
    if (products.data) setCatalogId(products.data.catalogId ?? "");
  }, [products.data]);

  const save = () => {
    if (!numericAccountId) return;
    setCat.mutate(
      { accountId: numericAccountId, catalogId: catalogId.trim() || null },
      {
        onSuccess: () => toast.success("Catálogo actualizado"),
        onError: (e) => toast.error(`Error: ${String(e)}`),
      }
    );
  };

  const filtered = (products.data?.products ?? []).filter((p) =>
    search ? p.name.toLowerCase().includes(search.toLowerCase()) : true
  );

  return (
    <Card>
      <Card.Header>
        <Card.Title>Catálogo Meta Commerce</Card.Title>
        <Card.Description>
          Vincula un catálogo de Meta Business Suite para enviar productos vía MPM o producto único.
          Los productos se gestionan en Meta; aquí sólo referenciamos el catálogo.
        </Card.Description>
      </Card.Header>
      <Card.Content className="space-y-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <SelectInput
            label="Cuenta WABA"
            value={accountId}
            onValueChange={setAccountId}
            options={allAccounts.map((a) => ({ value: String(a.id), label: a.label }))}
          />
          <div className="sm:col-span-2 flex items-end gap-2">
            <div className="flex-1">
              <TextInput
                label="Catalog ID Meta Commerce"
                value={catalogId}
                onValueChange={setCatalogId}
                placeholder="123456789012345"
              />
            </div>
            <Button onPress={save} isPending={setCat.isPending}>
              <Save size={14} />
              Guardar
            </Button>
            {products.data?.catalogId && (
              <Button
                variant="danger-soft"
                isIconOnly
                aria-label="Desvincular catálogo"
                onPress={() => {
                  setCatalogId("");
                  if (numericAccountId) {
                    setCat.mutate(
                      { accountId: numericAccountId, catalogId: null },
                      { onSuccess: () => toast.success("Catálogo desvinculado") }
                    );
                  }
                }}
              >
                <Trash2 size={14} />
              </Button>
            )}
          </div>
        </div>

        {products.data?.catalogId && (
          <div className="space-y-2 rounded-lg border border-default-200 bg-content2 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-sm">Productos ({filtered.length})</p>
              <div className="flex w-64 items-center gap-1">
                <Search size={12} className="text-default-400" />
                <TextInput
                  label=""
                  value={search}
                  onValueChange={setSearch}
                  placeholder="Buscar producto…"
                />
              </div>
            </div>
            {products.isLoading ? (
              <div className="flex justify-center py-6">
                <Spinner size="sm" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="py-6 text-center text-default-500 text-sm">
                Sin productos. Agrégalos en Meta Business Suite → Commerce.
              </p>
            ) : (
              <div className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
                {filtered.map((p) => (
                  <div key={p.id} className="rounded-md border border-default-200 bg-content1 p-2">
                    {p.image_url && (
                      <img
                        src={p.image_url}
                        alt={p.name}
                        loading="lazy"
                        className="aspect-square w-full rounded object-cover"
                      />
                    )}
                    <p className="mt-1 line-clamp-1 font-medium text-xs">{p.name}</p>
                    <p className="font-mono text-[10px] text-default-500">{p.retailer_id}</p>
                    {p.price && (
                      <Chip size="sm" variant="soft" color="success" className="mt-1">
                        <Chip.Label>
                          {p.price} {p.currency ?? ""}
                        </Chip.Label>
                      </Chip>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card.Content>
    </Card>
  );
}
