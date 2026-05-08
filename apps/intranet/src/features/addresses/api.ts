import type {
  createAddressInputSchema,
  updateAddressInputSchema,
} from "@finanzas/orpc-contracts/addresses";
import type { z } from "zod";
import { addressesORPCClient, toAddressesApiError } from "./orpc";

export async function listAddresses(personId: number) {
  try {
    const response = await addressesORPCClient.list({ personId });
    return response.addresses;
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
