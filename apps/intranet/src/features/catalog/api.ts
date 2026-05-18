import { catalogORPCClient, toCatalogApiError } from "./orpc";

export async function getProducts(opts?: {
  limit?: number;
  cursor?: number;
  q?: string;
  includeInactive?: boolean;
}) {
  try {
    return await catalogORPCClient.list({
      limit: opts?.limit ?? 50,
      cursor: opts?.cursor,
      q: opts?.q,
      include_inactive: opts?.includeInactive,
    });
  } catch (error) {
    throw toCatalogApiError(error);
  }
}

export async function getProductById(id: number) {
  try {
    return await catalogORPCClient.getById({ id });
  } catch (error) {
    throw toCatalogApiError(error);
  }
}

export async function getCategories() {
  try {
    return await catalogORPCClient.listCategories();
  } catch (error) {
    throw toCatalogApiError(error);
  }
}

type ProductCreateInput = Parameters<typeof catalogORPCClient.adminCreate>[0];
type ProductUpdateInput = Parameters<typeof catalogORPCClient.adminUpdate>[0]["product"];

export async function createProduct(input: ProductCreateInput) {
  try {
    return await catalogORPCClient.adminCreate(input);
  } catch (error) {
    throw toCatalogApiError(error);
  }
}

export async function updateProduct(id: number, product: ProductUpdateInput) {
  try {
    return await catalogORPCClient.adminUpdate({ id, product });
  } catch (error) {
    throw toCatalogApiError(error);
  }
}

export async function archiveProduct(id: number) {
  try {
    return await catalogORPCClient.adminArchive({ id });
  } catch (error) {
    throw toCatalogApiError(error);
  }
}

type CategoryCreateInput = Parameters<typeof catalogORPCClient.createCategory>[0];

export async function createCategory(input: CategoryCreateInput) {
  try {
    return await catalogORPCClient.createCategory(input);
  } catch (error) {
    throw toCatalogApiError(error);
  }
}

export async function deleteCategory(id: number) {
  try {
    return await catalogORPCClient.deleteCategory({ id });
  } catch (error) {
    throw toCatalogApiError(error);
  }
}
