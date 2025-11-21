import dayjs from "dayjs";
import { logger } from "../lib/logger.js";
import { hasBalanceForDate } from "../repositories/dailyProductionBalances.js";

const MIN_INTERVAL_MINUTES = 30;

export function startDailyProductionReminderJob() {
  if (process.env.DAILY_PROD_REMINDER_ENABLED === "false") {
    logger.info("[daily-production-reminder] disabled via env");
    return;
  }

  const intervalMinutes = Math.max(
    Number(process.env.DAILY_PROD_REMINDER_INTERVAL_MINUTES ?? 180),
    MIN_INTERVAL_MINUTES
  );
  const intervalMs = intervalMinutes * 60 * 1000;

  const runCheck = async () => {
    const target = dayjs().subtract(1, "day").format("YYYY-MM-DD");
    try {
      const hasRecord = await hasBalanceForDate(target);
      if (!hasRecord) {
        logger.info(
          { target, intervalMinutes },
          "[daily-production-reminder] No hay balance de prestaciones para el día anterior"
        );
      }
    } catch (error) {
      logger.error({ error }, "[daily-production-reminder] Error verificando balance diario");
    }
  };

  // run once on boot and then on interval
  runCheck();
  setInterval(runCheck, intervalMs);
}
