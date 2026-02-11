import { getCalendarAlerts, getCalendarEvents } from "../lib/doctoralia/doctoralia-calendar-client";
import {
  applyDoctoraliaAlertUpdates,
  createDoctoraliaSyncLog,
  updateDoctoraliaSyncLog,
  upsertDoctoraliaAppointments,
  upsertDoctoraliaSchedules,
  upsertDoctoraliaWorkPeriods,
} from "../lib/doctoralia/doctoralia-calendar-store";
import type {
  DoctoraliaCalendarAlert,
  DoctoraliaCalendarResponse,
} from "../lib/doctoralia/doctoralia-calendar-types";
import { getSetting, updateSetting } from "./settings";

const SETTINGS_KEYS = {
  lastAlertId: "doctoralia:calendar:lastAlertId",
};

type UpsertSummary = {
  schedules: { inserted: number; updated: number; skipped: number };
  appointments: { inserted: number; updated: number; skipped: number };
  workPeriods: { inserted: number; updated: number; skipped: number };
};

/**
 * Service to handle Doctoralia Calendar synchronization
 * Fetches calendar events from Docplanner API and stores them in the database
 */
export class DoctoraliaCalendarSyncService {
  private async upsertCalendarResponse(
    response: DoctoraliaCalendarResponse,
  ): Promise<UpsertSummary> {
    let schedulesInserted = 0;
    let schedulesUpdated = 0;
    let schedulesSkipped = 0;

    let appointmentsInserted = 0;
    let appointmentsUpdated = 0;
    let appointmentsSkipped = 0;

    let workPeriodsInserted = 0;
    let workPeriodsUpdated = 0;
    let workPeriodsSkipped = 0;

    // 1. Sync schedules
    const schedules = Object.values(response.schedules);
    if (schedules.length > 0) {
      console.log(`[DoctoraliaSync] Upserting ${schedules.length} schedules`);
      const scheduleResult = await upsertDoctoraliaSchedules(schedules);
      schedulesInserted = scheduleResult.inserted;
      schedulesUpdated = scheduleResult.updated;
      schedulesSkipped = scheduleResult.skipped;
    }

    // 2. Group appointments by schedule ID
    const appointmentsBySchedule = new Map<number, typeof response.appointments>();
    for (const appointment of response.appointments) {
      const scheduleId = appointment.scheduleId;
      if (!appointmentsBySchedule.has(scheduleId)) {
        appointmentsBySchedule.set(scheduleId, []);
      }
      appointmentsBySchedule.get(scheduleId)?.push(appointment);
    }

    // 3. Sync appointments for each schedule
    for (const [scheduleId, appointments] of appointmentsBySchedule.entries()) {
      console.log(
        `[DoctoraliaSync] Upserting ${appointments.length} appointments for schedule ${scheduleId}`,
      );
      const appointmentResult = await upsertDoctoraliaAppointments(scheduleId, appointments);
      appointmentsInserted += appointmentResult.inserted;
      appointmentsUpdated += appointmentResult.updated;
      appointmentsSkipped += appointmentResult.skipped;
    }

    // 4. Group work periods by schedule ID
    const workPeriodsBySchedule = new Map<number, typeof response.workperiods>();
    for (const period of response.workperiods) {
      const scheduleId = period.scheduleId;
      if (!workPeriodsBySchedule.has(scheduleId)) {
        workPeriodsBySchedule.set(scheduleId, []);
      }
      workPeriodsBySchedule.get(scheduleId)?.push(period);
    }

    // 5. Sync work periods for each schedule
    for (const [scheduleId, workPeriods] of workPeriodsBySchedule.entries()) {
      console.log(
        `[DoctoraliaSync] Upserting ${workPeriods.length} work periods for schedule ${scheduleId}`,
      );
      const periodResult = await upsertDoctoraliaWorkPeriods(scheduleId, workPeriods);
      workPeriodsInserted += periodResult.inserted;
      workPeriodsUpdated += periodResult.updated;
      workPeriodsSkipped += periodResult.skipped;
    }

    return {
      schedules: {
        inserted: schedulesInserted,
        updated: schedulesUpdated,
        skipped: schedulesSkipped,
      },
      appointments: {
        inserted: appointmentsInserted,
        updated: appointmentsUpdated,
        skipped: appointmentsSkipped,
      },
      workPeriods: {
        inserted: workPeriodsInserted,
        updated: workPeriodsUpdated,
        skipped: workPeriodsSkipped,
      },
    };
  }

  private buildDateWindowFromAlerts(alerts: DoctoraliaCalendarAlert[]) {
    const dates = alerts
      .map((alert) => alert.params.eventStartDateTime?.split("T")[0])
      .filter((date): date is string => Boolean(date));

    if (dates.length === 0) {
      return null;
    }

    const sorted = [...dates].sort();
    return {
      from: sorted[0],
      to: sorted[sorted.length - 1],
    };
  }

  /**
   * Sync all Doctoralia calendar events for a date range
   * @param from Start date (YYYY-MM-DD)
   * @param to End date (YYYY-MM-DD)
   * @param scheduleIds Optional array of schedule IDs to filter
   */
  async syncCalendar(
    from: string,
    to: string,
    scheduleIds?: number[],
    triggerSource?: string,
    triggerUserId?: number,
  ) {
    const syncLog = await createDoctoraliaSyncLog({
      triggerSource,
      triggerUserId,
      status: "RUNNING",
    });

    try {
      console.log(`[DoctoraliaSync] Fetching calendar events from ${from} to ${to}`);

      const response = await getCalendarEvents(from, to, scheduleIds);
      const summary = await this.upsertCalendarResponse(response);

      // Update sync log with success
      await updateDoctoraliaSyncLog(syncLog.id, {
        status: "SUCCESS",
        schedulesSynced: summary.schedules.inserted + summary.schedules.updated,
        appointmentsSynced: summary.appointments.inserted + summary.appointments.updated,
        workPeriodsSynced: summary.workPeriods.inserted + summary.workPeriods.updated,
      });

      console.log(
        `[DoctoraliaSync] Sync completed: ${summary.schedules.inserted} schedules inserted, ${summary.schedules.updated} updated, ${summary.schedules.skipped} skipped`,
      );
      console.log(
        `[DoctoraliaSync] ${summary.appointments.inserted} appointments inserted, ${summary.appointments.updated} updated, ${summary.appointments.skipped} skipped`,
      );
      console.log(
        `[DoctoraliaSync] ${summary.workPeriods.inserted} work periods inserted, ${summary.workPeriods.updated} updated, ${summary.workPeriods.skipped} skipped`,
      );

      return {
        success: true,
        ...summary,
      };
    } catch (error) {
      console.error("[DoctoraliaSync] Sync failed:", error);

      // Update sync log with failure
      await updateDoctoraliaSyncLog(syncLog.id, {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Fetch and return the alert feed for event notifications (alertType=3 by default).
   */
  async getAlerts(alertType = 3) {
    return getCalendarAlerts(alertType);
  }

  /**
   * Incremental sync based on alerts feed.
   *
   * 1) Fetch `/alerts?alertType=3`
   * 2) Derive impacted date window + schedules
   * 3) Pull `/calendarevents` for that window and upsert
   * 4) Apply direct status/date updates from alerts (mainly cancellations)
   */
  async syncFromAlerts(alertType = 3, triggerSource?: string, triggerUserId?: number) {
    const syncLog = await createDoctoraliaSyncLog({
      triggerSource,
      triggerUserId,
      status: "RUNNING",
    });

    try {
      const alerts = await getCalendarAlerts(alertType);
      const lastAlertIdRaw = await getSetting(SETTINGS_KEYS.lastAlertId);
      const lastAlertId = Number(lastAlertIdRaw ?? "0");
      const latestAlertId = alerts.reduce((maxId, alert) => Math.max(maxId, alert.id), 0);
      const pendingAlerts = Number.isFinite(lastAlertId)
        ? alerts.filter((alert) => alert.id > lastAlertId)
        : alerts;

      console.log(
        `[DoctoraliaSync] Retrieved ${alerts.length} alerts (pending=${pendingAlerts.length}, alertType=${alertType}, lastAlertId=${lastAlertId || 0})`,
      );

      if (pendingAlerts.length === 0) {
        if (latestAlertId > 0 && latestAlertId !== lastAlertId) {
          await updateSetting(SETTINGS_KEYS.lastAlertId, String(latestAlertId));
        }

        await updateDoctoraliaSyncLog(syncLog.id, {
          status: "SUCCESS",
          schedulesSynced: 0,
          appointmentsSynced: 0,
          workPeriodsSynced: 0,
        });

        return {
          success: true,
          alertsFetched: alerts.length,
          pendingAlertsFetched: 0,
          schedules: { inserted: 0, updated: 0, skipped: 0 },
          appointments: { inserted: 0, updated: 0, skipped: 0 },
          workPeriods: { inserted: 0, updated: 0, skipped: 0 },
          alertUpdates: { updated: 0, skipped: 0 },
          syncWindow: null,
          scheduleIds: [] as number[],
        };
      }

      const scheduleIds = [
        ...new Set(
          pendingAlerts
            .map((alert) => alert.params.scheduleId)
            .filter((scheduleId): scheduleId is number => Number.isFinite(scheduleId)),
        ),
      ];
      const syncWindow = this.buildDateWindowFromAlerts(pendingAlerts);

      const summary: UpsertSummary = {
        schedules: { inserted: 0, updated: 0, skipped: 0 },
        appointments: { inserted: 0, updated: 0, skipped: 0 },
        workPeriods: { inserted: 0, updated: 0, skipped: 0 },
      };

      if (syncWindow) {
        console.log(
          `[DoctoraliaSync] Syncing alerts window ${syncWindow.from}..${syncWindow.to} for ${scheduleIds.length} schedules`,
        );

        const response = await getCalendarEvents(syncWindow.from, syncWindow.to, scheduleIds);
        const upsertResult = await this.upsertCalendarResponse(response);
        summary.schedules = upsertResult.schedules;
        summary.appointments = upsertResult.appointments;
        summary.workPeriods = upsertResult.workPeriods;
      }

      const actionableAlerts = pendingAlerts.filter((alert) =>
        ["cancel-event-alert", "reschedule-event-alert", "event-confirmation-alert"].includes(
          alert.type,
        ),
      );
      const alertUpdates = await applyDoctoraliaAlertUpdates(actionableAlerts);

      if (latestAlertId > 0 && latestAlertId !== lastAlertId) {
        await updateSetting(SETTINGS_KEYS.lastAlertId, String(latestAlertId));
      }

      await updateDoctoraliaSyncLog(syncLog.id, {
        status: "SUCCESS",
        schedulesSynced: summary.schedules.inserted + summary.schedules.updated,
        appointmentsSynced:
          summary.appointments.inserted + summary.appointments.updated + alertUpdates.updated,
        workPeriodsSynced: summary.workPeriods.inserted + summary.workPeriods.updated,
      });

      return {
        success: true,
        alertsFetched: alerts.length,
        pendingAlertsFetched: pendingAlerts.length,
        ...summary,
        alertUpdates,
        syncWindow,
        scheduleIds,
      };
    } catch (error) {
      console.error("[DoctoraliaSync] Alert sync failed:", error);

      await updateDoctoraliaSyncLog(syncLog.id, {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Sync events for a specific date (convenience method)
   */
  async syncDate(date: string, scheduleIds?: number[]) {
    return this.syncCalendar(date, date, scheduleIds);
  }

  /**
   * Sync events for the current week
   */
  async syncCurrentWeek(scheduleIds?: number[]) {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const from = startOfWeek.toISOString().split("T")[0];
    const to = endOfWeek.toISOString().split("T")[0];

    return this.syncCalendar(from, to, scheduleIds);
  }

  /**
   * Sync events for the current month
   */
  async syncCurrentMonth(scheduleIds?: number[]) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const from = startOfMonth.toISOString().split("T")[0];
    const to = endOfMonth.toISOString().split("T")[0];

    return this.syncCalendar(from, to, scheduleIds);
  }
}

// Export singleton instance
export const doctoraliaCalendarSyncService = new DoctoraliaCalendarSyncService();
