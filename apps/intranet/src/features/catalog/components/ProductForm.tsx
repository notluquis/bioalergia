import {
  Button,
  Description,
  FieldError,
  Form,
  Input,
  Label,
  ListBox,
  NumberField,
  Select,
  Switch,
  TextArea,
  TextField,
} from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useState } from "react";

import { catalogKeys } from "../queries";

const CLP_FORMAT_OPTIONS: Intl.NumberFormatOptions = {
  currency: "CLP",
  currencyDisplay: "symbol",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
  style: "currency",
};

const NO_CATEGORY_KEY = "__no_category__";
const STATUS_OPTIONS = [
  { id: "DRAFT", label: "Borrador" },
  { id: "ACTIVE", label: "Activo (visible en tienda)" },
  { id: "ARCHIVED", label: "Archivado" },
];

export type ProductFormValues = {
  slug: string;
  sku: string;
  name: string;
  short_description: string;
  description: string;
  category_id: number | null;
  brand: string;
  price_clp: number;
  compare_at_price_clp: number | null;
  cost_clp: number | null;
  weight_grams: number | null;
  barcode: string;
  requires_prescription: boolean;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  seo_title: string;
  seo_description: string;
  available_qty: number;
  safety_stock: number;
};

const EMPTY: ProductFormValues = {
  slug: "",
  sku: "",
  name: "",
  short_description: "",
  description: "",
  category_id: null,
  brand: "",
  price_clp: 0,
  compare_at_price_clp: null,
  cost_clp: null,
  weight_grams: null,
  barcode: "",
  requires_prescription: false,
  status: "DRAFT",
  seo_title: "",
  seo_description: "",
  available_qty: 0,
  safety_stock: 2,
};

interface ProductFormProps {
  initial?: Partial<ProductFormValues> | null;
  onCancel: () => void;
  onSave: (values: ProductFormValues) => void;
  saving: boolean;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function ProductForm({ initial, onCancel, onSave, saving }: ProductFormProps) {
  const [form, setForm] = useState<ProductFormValues>({ ...EMPTY, ...initial });
  const { data: categoriesResponse } = useQuery(catalogKeys.categories());
  const categories = categoriesResponse?.data ?? [];

  function setField<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleNameBlur() {
    if (!form.slug && form.name) {
      setField("slug", slugify(form.name));
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onSave(form);
  }

  return (
    <Form className="space-y-5 text-sm" onSubmit={handleSubmit} validationBehavior="aria">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          isRequired
          name="name"
          onBlur={handleNameBlur}
          onChange={(v) => setField("name", v)}
          validate={(v) => (v.trim() ? null : "El nombre es obligatorio")}
          value={form.name}
        >
          <Label>Nombre</Label>
          <Input placeholder="ISDIN Baby Naturals Loción Corporal 400 ml" />
          <FieldError />
        </TextField>

        <TextField
          isRequired
          name="sku"
          onChange={(v) => setField("sku", v)}
          validate={(v) => (v.trim() ? null : "SKU obligatorio")}
          value={form.sku}
        >
          <Label>SKU</Label>
          <Input placeholder="391006" />
          <FieldError />
        </TextField>

        <TextField
          isRequired
          name="slug"
          onChange={(v) => setField("slug", v)}
          validate={(v) =>
            /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v) ? null : "Sólo minúsculas, números y guiones"
          }
          value={form.slug}
        >
          <Label>Slug (URL)</Label>
          <Input placeholder="isdin-baby-naturals-locion-corporal-400ml" />
          <Description>Se autogenera desde el nombre. Editable.</Description>
          <FieldError />
        </TextField>

        <TextField name="brand" onChange={(v) => setField("brand", v)} value={form.brand}>
          <Label>Marca</Label>
          <Input placeholder="ISDIN" />
        </TextField>

        <Select
          onChange={(key) =>
            setField("category_id", key && key !== NO_CATEGORY_KEY ? Number(key) : null)
          }
          value={form.category_id == null ? NO_CATEGORY_KEY : String(form.category_id)}
        >
          <Label>Categoría</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id={NO_CATEGORY_KEY} key={NO_CATEGORY_KEY}>
                Sin categoría
              </ListBox.Item>
              {categories.map((c) => (
                <ListBox.Item id={String(c.id)} key={c.id}>
                  {c.name}
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        <Select
          onChange={(key) => setField("status", String(key) as "DRAFT" | "ACTIVE" | "ARCHIVED")}
          value={form.status}
        >
          <Label>Estado</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {STATUS_OPTIONS.map((s) => (
                <ListBox.Item id={s.id} key={s.id}>
                  {s.label}
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      <TextField
        name="short_description"
        onChange={(v) => setField("short_description", v)}
        value={form.short_description}
      >
        <Label>Descripción corta</Label>
        <Input />
      </TextField>

      <TextField
        name="description"
        onChange={(v) => setField("description", v)}
        value={form.description}
      >
        <Label>Descripción larga</Label>
        <TextArea rows={4} />
      </TextField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <NumberField
          isRequired
          formatOptions={CLP_FORMAT_OPTIONS}
          isInvalid={form.price_clp < 0}
          minValue={0}
          name="price_clp"
          onChange={(v) => setField("price_clp", v ?? 0)}
          value={form.price_clp}
        >
          <Label>Precio CLP</Label>
          <NumberField.Group className="grid-cols-1">
            <NumberField.Input />
          </NumberField.Group>
          <Description>IVA incluido</Description>
          {form.price_clp < 0 && <FieldError>Precio inválido</FieldError>}
        </NumberField>
        <NumberField
          formatOptions={CLP_FORMAT_OPTIONS}
          minValue={0}
          name="compare_at_price_clp"
          onChange={(v) => setField("compare_at_price_clp", v ?? null)}
          value={form.compare_at_price_clp ?? Number.NaN}
        >
          <Label>Precio antes (tachado)</Label>
          <NumberField.Group className="grid-cols-1">
            <NumberField.Input />
          </NumberField.Group>
        </NumberField>
        <NumberField
          formatOptions={CLP_FORMAT_OPTIONS}
          minValue={0}
          name="cost_clp"
          onChange={(v) => setField("cost_clp", v ?? null)}
          value={form.cost_clp ?? Number.NaN}
        >
          <Label>Costo interno</Label>
          <NumberField.Group className="grid-cols-1">
            <NumberField.Input />
          </NumberField.Group>
        </NumberField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <NumberField
          isRequired
          minValue={0}
          name="available_qty"
          onChange={(v) => setField("available_qty", v ?? 0)}
          step={1}
          value={form.available_qty}
        >
          <Label>Stock disponible</Label>
          <NumberField.Group className="grid-cols-1">
            <NumberField.Input />
          </NumberField.Group>
        </NumberField>
        <NumberField
          minValue={0}
          name="safety_stock"
          onChange={(v) => setField("safety_stock", v ?? 0)}
          step={1}
          value={form.safety_stock}
        >
          <Label>Stock de seguridad</Label>
          <NumberField.Group className="grid-cols-1">
            <NumberField.Input />
          </NumberField.Group>
          <Description>Reserva no vendible</Description>
        </NumberField>
        <NumberField
          minValue={0}
          name="weight_grams"
          onChange={(v) => setField("weight_grams", v ?? null)}
          step={1}
          value={form.weight_grams ?? Number.NaN}
        >
          <Label>Peso (g)</Label>
          <NumberField.Group className="grid-cols-1">
            <NumberField.Input />
          </NumberField.Group>
          <Description>Para Chilexpress</Description>
        </NumberField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField name="barcode" onChange={(v) => setField("barcode", v)} value={form.barcode}>
          <Label>Código de barras</Label>
          <Input />
        </TextField>
        <div className="flex items-center pt-6">
          <Switch
            isSelected={form.requires_prescription}
            onChange={(v) => setField("requires_prescription", v)}
          >
            Requiere receta
          </Switch>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          name="seo_title"
          onChange={(v) => setField("seo_title", v)}
          value={form.seo_title}
        >
          <Label>SEO título</Label>
          <Input />
        </TextField>
        <TextField
          name="seo_description"
          onChange={(v) => setField("seo_description", v)}
          value={form.seo_description}
        >
          <Label>SEO descripción</Label>
          <Input />
        </TextField>
      </div>

      <div className="flex flex-col-reverse items-stretch gap-3 pt-4 sm:flex-row sm:items-center sm:justify-end">
        <Button onPress={onCancel} type="button" variant="secondary">
          Cancelar
        </Button>
        <Button isDisabled={saving} type="submit" variant="primary">
          {saving ? "Guardando..." : "Guardar producto"}
        </Button>
      </div>
    </Form>
  );
}
