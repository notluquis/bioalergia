import { getCalendarEvents } from "../lib/doctoralia/doctoralia-calendar-client";
import {
  createDoctoraliaSyncLog,
  updateDoctoraliaSyncLog,
  upsertDoctoraliaAppointments,
  upsertDoctoraliaSchedules,
  upsertDoctoraliaWorkPeriods,
} from "../lib/doctoralia/doctoralia-calendar-store";

/**
 * Service to handle Doctoralia Calendar synchronization
 * Fetches calendar events from Docplanner API and stores them in the database
 */
export class DoctoraliaCalendarSyncService {
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

      // Update sync log with success
      await updateDoctoraliaSyncLog(syncLog.id, {
        status: "SUCCESS",
        schedulesSynced: schedulesInserted + schedulesUpdated,
        appointmentsSynced: appointmentsInserted + appointmentsUpdated,
        workPeriodsSynced: workPeriodsInserted + workPeriodsUpdated,
      });

      console.log(
        `[DoctoraliaSync] Sync completed: ${schedulesInserted} schedules inserted, ${schedulesUpdated} updated, ${schedulesSkipped} skipped`,
      );
      console.log(
        `[DoctoraliaSync] ${appointmentsInserted} appointments inserted, ${appointmentsUpdated} updated, ${appointmentsSkipped} skipped`,
      );
      console.log(
        `[DoctoraliaSync] ${workPeriodsInserted} work periods inserted, ${workPeriodsUpdated} updated, ${workPeriodsSkipped} skipped`,
      );

      return {
        success: true,
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
