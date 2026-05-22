import type {
  CreateBudgetInput,
  CreateProductInput,
  QuoteInput,
  UpdateProductInput,
} from "@finanzas/orpc-contracts/immunotherapy";
import { immunotherapyORPCClient, toImmunotherapyApiError } from "./orpc";

export async function listImmunoProducts() {
  try {
    const res = await immunotherapyORPCClient.listProducts();
    return res.products;
  } catch (error) {
    throw toImmunotherapyApiError(error);
  }
}

export async function createImmunoProduct(input: CreateProductInput) {
  try {
    const res = await immunotherapyORPCClient.createProduct(input);
    return res.product;
  } catch (error) {
    throw toImmunotherapyApiError(error);
  }
}

export async function updateImmunoProduct(input: UpdateProductInput) {
  try {
    const res = await immunotherapyORPCClient.updateProduct(input);
    return res.product;
  } catch (error) {
    throw toImmunotherapyApiError(error);
  }
}

export async function deleteImmunoProduct(id: number) {
  try {
    return await immunotherapyORPCClient.deleteProduct({ id });
  } catch (error) {
    throw toImmunotherapyApiError(error);
  }
}

export async function listImmunoAllergens(q?: string) {
  try {
    const res = await immunotherapyORPCClient.listAllergens(q ? { q } : {});
    return res.allergens;
  } catch (error) {
    throw toImmunotherapyApiError(error);
  }
}

export async function quoteImmunotherapy(input: QuoteInput) {
  try {
    return await immunotherapyORPCClient.quote(input);
  } catch (error) {
    throw toImmunotherapyApiError(error);
  }
}

export async function createImmunoBudget(input: CreateBudgetInput) {
  try {
    return await immunotherapyORPCClient.createBudget(input);
  } catch (error) {
    throw toImmunotherapyApiError(error);
  }
}

export async function getImmunoTerms() {
  try {
    return await immunotherapyORPCClient.getTerms();
  } catch (error) {
    throw toImmunotherapyApiError(error);
  }
}

export async function updateImmunoTerms(input: {
  legalName?: string | null;
  legalRut?: string | null;
  immunoBudgetTerms?: string | null;
}) {
  try {
    return await immunotherapyORPCClient.updateTerms(input);
  } catch (error) {
    throw toImmunotherapyApiError(error);
  }
}

// Genera el PDF (server-side) y dispara la descarga en el navegador.
export async function downloadImmunoBudgetPdf(input: CreateBudgetInput): Promise<void> {
  try {
    const file = await immunotherapyORPCClient.generatePdf(input);
    const blob = file instanceof Blob ? file : new Blob([file as BlobPart]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file instanceof File && file.name ? file.name : "presupuesto_inmunoterapia.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    throw toImmunotherapyApiError(error);
  }
}
