interface ErrorCodeInput {
  message?: string;
  method: string;
  path: string;
  status: number;
}

function defaultCode(status: number): string {
  if (status === 400) return "BAD_REQUEST";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status >= 500) return "INTERNAL_ERROR";
  return "REQUEST_ERROR";
}

function includesAny(value: string, terms: string[]): boolean {
  return terms.some((term) => value.includes(term));
}

function authCode(message: string, status: number): null | string {
  if (includesAny(message, ["token inválido", "token invalido"])) return "AUTH_INVALID_TOKEN";
  if (includesAny(message, ["credenciales incorrectas", "invalid credentials"])) {
    return "AUTH_INVALID_CREDENTIALS";
  }
  if (includesAny(message, ["mfa no configurado"])) return "AUTH_MFA_NOT_CONFIGURED";
  if (includesAny(message, ["código incorrecto", "codigo incorrecto"]))
    return "AUTH_MFA_INVALID_CODE";
  if (includesAny(message, ["challenge inválido", "challenge invalido"])) {
    return "AUTH_PASSKEY_INVALID_CHALLENGE";
  }
  if (includesAny(message, ["credencial no encontrada"])) return "AUTH_PASSKEY_NOT_FOUND";
  if (includesAny(message, ["verificación fallida", "verificacion fallida"])) {
    return "AUTH_VERIFICATION_FAILED";
  }
  if (includesAny(message, ["no autorizado", "unauthorized"]) || status === 401) {
    return "AUTH_UNAUTHORIZED";
  }
  return null;
}

function usersCode(message: string): null | string {
  if (includesAny(message, ["usuario no encontrado"])) return "USER_NOT_FOUND";
  if (
    includesAny(message, ["rol", "role"]) &&
    includesAny(message, ["no encontrado", "not found"])
  ) {
    return "ROLE_NOT_FOUND";
  }
  if (
    includesAny(message, ["correo", "email"]) &&
    includesAny(message, ["conflict", "duplicado"])
  ) {
    return "USER_EMAIL_CONFLICT";
  }
  return null;
}

function financeCode(message: string, path: string): null | string {
  if (
    (path.startsWith("/api/release-transactions") ||
      path.startsWith("/api/settlement-transactions")) &&
    includesAny(message, ["transacción no encontrada", "transaccion no encontrada"])
  ) {
    return "FINANCE_TRANSACTION_NOT_FOUND";
  }

  if (
    path.startsWith("/api/finance") &&
    includesAny(message, ["categoría no encontrada", "categoria no encontrada"])
  ) {
    return "FINANCE_CATEGORY_NOT_FOUND";
  }

  return null;
}

function integrationsCode(message: string, path: string): null | string {
  if (path.startsWith("/api/integrations/google") && includesAny(message, ["failed", "error"])) {
    return "GOOGLE_INTEGRATION_ERROR";
  }
  return null;
}

function backupCode(message: string, path: string): null | string {
  if (!path.startsWith("/api/backups")) return null;
  if (includesAny(message, ["restore"])) return "BACKUP_RESTORE_ERROR";
  if (includesAny(message, ["backup"])) return "BACKUP_OPERATION_ERROR";
  return null;
}

export function resolveErrorCode(input: ErrorCodeInput): string {
  const message = input.message?.trim().toLowerCase() ?? "";

  if (input.path.startsWith("/api/auth")) {
    return authCode(message, input.status) ?? defaultCode(input.status);
  }

  if (input.path.startsWith("/api/users")) {
    return usersCode(message) ?? defaultCode(input.status);
  }

  return (
    financeCode(message, input.path) ??
    integrationsCode(message, input.path) ??
    backupCode(message, input.path) ??
    defaultCode(input.status)
  );
}
