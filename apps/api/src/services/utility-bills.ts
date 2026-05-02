// Utility bill scrapers for Essbio (water) and CGE (electricity)

const ESSBIO_BASE = "https://www.essbio.cl";
const CGE_ORCHESTRATOR = "https://orchestrator-portalescge-prd.lfr.cloud";
const CGE_COGNITO_ENDPOINT = "https://cognito-idp.us-east-1.amazonaws.com/";
const CGE_COGNITO_CLIENT_ID = "3obthedс45v0qgtllnsopd6u8i";

// ─── Essbio ───────────────────────────────────────────────────────────────────

export interface EssbioBillResult {
  accountNumber: string;
  address: string;
  clientName: string;
  company: string;
  currentDebt: number;
  error: null | string;
  previousBalance: number;
}

export async function fetchEssbioBill(serviceNumber: string): Promise<EssbioBillResult> {
  const form = new FormData();
  form.append("nro_servicio", serviceNumber);

  const response = await fetch(`${ESSBIO_BASE}/paymentData`, {
    method: "POST",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Safari/605.1.15",
      "X-Requested-With": "XMLHttpRequest",
      HTTP_X_REQUESTED_WITH: "XMLHttpRequest",
      Accept: "*/*",
      Origin: ESSBIO_BASE,
      Referer: `${ESSBIO_BASE}/PagoExpress`,
    },
    body: form,
  });

  if (!response.ok) {
    throw new Error(`Essbio request failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    boleta?: string;
    deuda?: number | string;
    direccion?: string;
    empresa?: string;
    msgerror?: null | string;
    nombre_cliente?: string;
    saldo_anterior?: number | string;
  };

  return {
    accountNumber: data.boleta ?? serviceNumber,
    address: data.direccion ?? "",
    clientName: data.nombre_cliente ?? "",
    company: data.empresa ?? "Essbio S.A.",
    currentDebt: Number(data.deuda ?? 0),
    error: data.msgerror ?? null,
    previousBalance: Number(data.saldo_anterior ?? 0),
  };
}

// ─── CGE ─────────────────────────────────────────────────────────────────────

export interface CgeBillResult {
  accountNumber: string;
  address: string;
  clientName: string;
  commune: string;
  company: string;
  currentBill: number;
  emissionDate: string;
  previousBill: number;
}

export async function getCgeCognitoToken(rut: string, password: string): Promise<string> {
  const response = await fetch(CGE_COGNITO_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
    },
    body: JSON.stringify({
      AuthFlow: "USER_PASSWORD_AUTH",
      AuthParameters: {
        PASSWORD: password,
        USERNAME: rut,
      },
      ClientId: CGE_COGNITO_CLIENT_ID,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`CGE auth failed: ${response.status} ${body}`);
  }

  const data = (await response.json()) as {
    AuthenticationResult?: { AccessToken?: string };
  };

  const token = data.AuthenticationResult?.AccessToken;

  if (!token) {
    throw new Error("CGE auth response missing AccessToken");
  }

  return token;
}

export async function fetchCgeBill(
  accountNumber: string,
  accessToken: string,
): Promise<CgeBillResult> {
  const response = await fetch(
    `${CGE_ORCHESTRATOR}/consultarDeudaPorCuentaContrato`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "*/*",
        Origin: "https://sucursalvirtual.cge.cl",
        Referer: "https://sucursalvirtual.cge.cl/",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Safari/605.1.15",
        "X-Client": "react-app",
        "App-Source": "react-app",
        "x-api-auth": accessToken,
      },
      body: JSON.stringify({
        ITEM: { CANAL: "OVIRTUAL", CTA_CTO: accountNumber },
        url: "OFVCGE_P",
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`CGE request failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    code?: number;
    edatosCupon?: {
      antBoleta?: string;
      comCliente?: string;
      direCliente?: string;
      empresa?: string;
      fecEmision?: string;
      nomCliente?: string;
      ultBoleta?: string;
    };
    mensaje?: string;
  };

  if (data.code !== 0) {
    throw new Error(`CGE error: ${data.mensaje ?? "Unknown error"}`);
  }

  const cupon = data.edatosCupon ?? {};

  return {
    accountNumber,
    address: cupon.direCliente ?? "",
    clientName: cupon.nomCliente ?? "",
    commune: cupon.comCliente ?? "",
    company: cupon.empresa ?? "CGE",
    currentBill: Number(cupon.ultBoleta ?? 0),
    emissionDate: cupon.fecEmision ?? "",
    previousBill: Number(cupon.antBoleta ?? 0),
  };
}

export async function fetchCgeBillWithCredentials(
  accountNumber: string,
  rut: string,
  password: string,
): Promise<CgeBillResult> {
  const token = await getCgeCognitoToken(rut, password);
  return fetchCgeBill(accountNumber, token);
}
