import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ClinicalAllergenDto } from "@finanzas/orpc-contracts/clinical-allergens";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { useState } from "react";
import { Button } from "@heroui/react";

import { AllergenFormModal } from "./AllergenFormModal";

// Stories for the clinical-allergens CRUD modal. The modal only mutates
// (create / update / deactivate) and then invalidates the allergens
// query cache. Each oRPC procedure is mocked per-meta so the form can be
// driven without a DB:
//   * `createAllergen`  — POST on "Nuevo".
//   * `updateAllergen`  — POST on "Editar".
//   * `deactivateAllergen` — soft-delete from the "Editar" footer.
//   * `listAllergens`   — answers the cache-invalidation refetch.

const ok = (data: unknown) => HttpResponse.json({ json: data, meta: [] });

const ALLERGEN_FIXTURE: ClinicalAllergenDto = {
  id: "alg_0001",
  scientificName: "Cynodon dactylon",
  commonName: "Pasto bermuda",
  englishName: "Bermuda grass",
  category: "Gramínea",
  categoryEn: "Grass",
  pollenType: "Polen de pastos",
  pollenTypeEn: "Grass pollen",
  tags: ["estacional", "exterior"],
  isActive: true,
  aliases: [{ id: "ali_1", alias: "bermuda", aliasType: "MANUAL" }],
};

// Default handlers: every mutation resolves to the fixture, the list
// refetch returns it too. No DB risk.
const baseHandlers = [
  http.post("*/api/orpc/clinical-allergens/rpc/createAllergen", () =>
    ok({ allergen: ALLERGEN_FIXTURE })
  ),
  http.post("*/api/orpc/clinical-allergens/rpc/updateAllergen", () =>
    ok({ allergen: ALLERGEN_FIXTURE })
  ),
  http.post("*/api/orpc/clinical-allergens/rpc/deactivateAllergen", () =>
    ok({ allergen: { ...ALLERGEN_FIXTURE, isActive: false } })
  ),
  http.post("*/api/orpc/clinical-allergens/rpc/listAllergens", () =>
    ok({ allergens: [ALLERGEN_FIXTURE] })
  ),
];

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
}

function ModalHarness({ allergen }: { allergen?: ClinicalAllergenDto }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="p-8">
      <Button onPress={() => setOpen(true)}>Abrir modal</Button>
      <AllergenFormModal isOpen={open} onOpenChange={setOpen} allergen={allergen} />
    </div>
  );
}

const meta: Meta<typeof AllergenFormModal> = {
  title: "Allergens/AllergenFormModal",
  component: AllergenFormModal,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Modal CRUD del catálogo clínico de alérgenos. Crea/edita nombre común, científico, categorías, tipo de polen, etiquetas y alias; el botón de desactivar hace soft-delete. MSW simula cada mutación oRPC.",
      },
    },
    msw: { handlers: baseHandlers },
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={makeQueryClient()}>
        <Story />
      </QueryClientProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof AllergenFormModal>;

// New allergen: empty form. "Crear alérgeno" stays disabled until both
// required fields (commonName + category) are filled.
export const Nuevo: Story = {
  name: "Nuevo — formulario vacío",
  render: () => <ModalHarness />,
  // Modest interaction: confirm the dialog renders to AT and that filling
  // the two required fields enables the submit button. `storybook/test` is
  // lazy-imported per the AppModal.stories.tsx convention (Chromatic
  // story-extractor crashes on top-level imports).
  play: async ({ canvasElement }) => {
    const { expect, userEvent, within } = await import("storybook/test");
    const doc = canvasElement.ownerDocument;
    const root = within(doc.body);

    const dialog = await root.findByRole("dialog");
    await expect(dialog).toBeVisible();

    const submit = await root.findByRole("button", { name: "Crear alérgeno" });
    await expect(submit).toBeDisabled();

    const dialogScope = within(dialog);
    const commonName = dialogScope.getByPlaceholderText("Pasto bermuda");
    const category = dialogScope.getByPlaceholderText("Gramínea");
    await userEvent.type(commonName, "Olivo");
    await userEvent.type(category, "Árbol");

    await expect(commonName).toHaveValue("Olivo");
    await expect(category).toHaveValue("Árbol");
    await expect(submit).toBeEnabled();
  },
};

// Editing an existing allergen: form is pre-hydrated from the fixture and
// the footer shows the "Desactivar" (soft-delete) action.
export const Editar: Story = {
  name: "Editar — alérgeno existente",
  render: () => <ModalHarness allergen={ALLERGEN_FIXTURE} />,
};
