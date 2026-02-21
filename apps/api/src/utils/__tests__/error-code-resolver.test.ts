import { describe, expect, it } from "vitest";
import { resolveErrorCode } from "../error-code-resolver";

describe("resolveErrorCode", () => {
  it.each([
    {
      expected: "AUTH_INVALID_TOKEN",
      input: {
        method: "GET",
        path: "/api/auth/me/session",
        status: 401,
        message: "Token inválido",
      },
    },
    {
      expected: "AUTH_MFA_INVALID_CODE",
      input: {
        method: "POST",
        path: "/api/auth/login/mfa",
        status: 401,
        message: "Código incorrecto",
      },
    },
    {
      expected: "USER_NOT_FOUND",
      input: {
        method: "GET",
        path: "/api/users/123",
        status: 404,
        message: "Usuario no encontrado",
      },
    },
    {
      expected: "PATIENT_NOT_FOUND",
      input: {
        method: "GET",
        path: "/api/patients/999",
        status: 404,
        message: "Paciente no encontrado",
      },
    },
    {
      expected: "PATIENT_ATTACHMENT_FILE_REQUIRED",
      input: {
        method: "POST",
        path: "/api/patients/1/attachments",
        status: 400,
        message: "No se proporcionó ningún archivo",
      },
    },
    {
      expected: "CERTIFICATE_NOT_FOUND",
      input: {
        method: "GET",
        path: "/api/certificates/verify/abc",
        status: 404,
        message: "Certificado no encontrado",
      },
    },
    {
      expected: "FINANCE_TRANSACTION_NOT_FOUND",
      input: {
        method: "GET",
        path: "/api/release-transactions/99",
        status: 404,
        message: "Transacción no encontrada",
      },
    },
    {
      expected: "DOCTORALIA_INVALID_SIGNATURE",
      input: {
        method: "POST",
        path: "/api/doctoralia/webhook",
        status: 401,
        message: "Firma inválida",
      },
    },
    {
      expected: "GOOGLE_INTEGRATION_ERROR",
      input: {
        method: "GET",
        path: "/api/integrations/google/url",
        status: 500,
        message: "Failed to generate auth URL",
      },
    },
    {
      expected: "BACKUP_RESTORE_ERROR",
      input: {
        method: "POST",
        path: "/api/backups/id/restore",
        status: 500,
        message: "restore failed",
      },
    },
    {
      expected: "INTERNAL_ERROR",
      input: {
        method: "GET",
        path: "/api/unknown",
        status: 500,
        message: "whatever",
      },
    },
  ])("returns $expected for $input.path", ({ input, expected }) => {
    expect(resolveErrorCode(input)).toBe(expected);
  });
});
