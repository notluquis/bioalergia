// BUC rate limit de Meta (200 llamadas/usuario/hora). Contabiliza por
// SocialAccount con una ventana móvil de 1h; lanza al llegar a un margen de
// seguridad (190) para no quemar la cuota. El poll de containers es el costo
// dominante → cada llamada al Graph incrementa el contador.

import { db } from "@finanzas/db";
import { DomainError } from "../../../lib/errors.ts";

const WINDOW_MS = 3600 * 1000;
const SAFETY_CAP = 190;

export async function checkAndIncrementBuc(accountId: number): Promise<void> {
  const account = await db.socialAccount.findUnique({
    where: { id: accountId },
    select: { callWindowStart: true, callCount: true },
  });
  if (!account) return;
  const now = Date.now();
  const windowExpired =
    !account.callWindowStart || now - account.callWindowStart.getTime() > WINDOW_MS;

  if (windowExpired) {
    await db.socialAccount.update({
      where: { id: accountId },
      data: { callWindowStart: new Date(), callCount: 1 },
    });
    return;
  }
  if (account.callCount >= SAFETY_CAP) {
    throw new DomainError(
      "RATE_LIMITED",
      "Límite de llamadas a Meta alcanzado (BUC). Intenta más tarde."
    );
  }
  await db.socialAccount.update({
    where: { id: accountId },
    data: { callCount: { increment: 1 } },
  });
}
