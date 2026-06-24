import {
  addressSchema,
  type createAddressInputSchema,
  type updateAddressInputSchema,
} from "@finanzas/orpc-contracts/addresses";
import { z } from "zod";
import { ApiError } from "@/lib/api-client";
import { addressesORPCClient, toAddressesApiError } from "./orpc";

const addressListResultSchema = z.array(addressSchema);

export async function listAddresses(personId: number) {
  try {
    const response = await addressesORPCClient.list({ personId });
    // Runtime contract validation: oRPC client trusts the contract types
    // by default and casts without checking. If the server ever returns a
    // row that violates the schema (legacy DB row, broken middleware,
    // raw SQL handler bypassing zod), we surface a precise field-path
    // ApiError instead of letting nullable data crash deep in render.
    const parsed = addressListResultSchema.safeParse(response.addresses);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ApiError(
        `Respuesta del servidor no cumple el contrato de direcciones: ${issue?.path.join(".") ?? "?"} (${issue?.message ?? "validation error"})`,
        500,
        parsed.error.format()
      );
    }
    return parsed.data;
  } catch (error) {
    throw toAddressesApiError(error);
  }
}

export async function createAddress(input: z.input<typeof createAddressInputSchema>) {
  try {
    const response = await addressesORPCClient.create(input);
    return response.address;
  } catch (error) {
    throw toAddressesApiError(error);
  }
}

export async function updateAddress(input: z.input<typeof updateAddressInputSchema>) {
  try {
    const response = await addressesORPCClient.update(input);
    return response.address;
  } catch (error) {
    throw toAddressesApiError(error);
  }
}

export async function deleteAddress(id: number) {
  try {
    await addressesORPCClient.delete({ id });
  } catch (error) {
    throw toAddressesApiError(error);
  }
}

export async function setPrimaryAddress(id: number, personId: number) {
  try {
    const response = await addressesORPCClient.setPrimary({ id, personId });
    return response.address;
  } catch (error) {
    throw toAddressesApiError(error);
  }
}
