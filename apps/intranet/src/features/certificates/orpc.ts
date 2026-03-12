import { createORPCClient, ORPCError } from "@orpc/client";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";

type CertificateVerifyResponse =
  | {
      diagnosis: string;
      doctor: {
        name: string;
        specialty?: string;
      };
      issuedAt: Date;
      patient: {
        name: string;
      };
      purpose: string;
      restDays?: null | number;
      restEndDate?: Date | null;
      restStartDate?: Date | null;
      valid: true;
    }
  | {
      error?: string;
      valid: false;
    };

type CertificatesORPCClient = {
  verify: (input: { id: string }) => Promise<CertificateVerifyResponse>;
};

const certificatesORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const certificatesORPCClient = createORPCClient<CertificatesORPCClient>(
  certificatesORPCLink,
  {
    path: ["api", "orpc", "certificates", "rpc"],
  },
);

export function toCertificatesApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof ORPCError) {
    return new ApiError(error.message, error.status, error.data);
  }

  if (error instanceof Error) {
    return new ApiError(error.message, 500);
  }

  return new ApiError("Error inesperado", 500, error);
}
