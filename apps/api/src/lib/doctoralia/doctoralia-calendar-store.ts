import { db, type JsonValue } from "@finanzas/db";

import type {
  DoctoraliaAppointment,
  DoctoraliaCalendarAlert,
  DoctoraliaCalendarSchedule,
  DoctoraliaWorkPeriod,
} from "./doctoralia-calendar-types";

function toJsonValue(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

/**
 * Upsert Doctoralia schedules into the database
 */
export async function upsertDoctoraliaSchedules(schedules: DoctoraliaCalendarSchedule[]) {
  if (schedules.length === 0) {
    return { inserted: 0, updated: 0, skipped: 0 };
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const schedule of schedules) {
    try {
      const existing = await db.doctoraliaSchedule.findUnique({
        where: { externalId: schedule.id },
      });

      const data = {
        externalId: schedule.id,
        name: schedule.name,
        displayName: schedule.displayName,
        facilityId: schedule.facilityId || null,
        specialityId: schedule.specialityId || null,
        doctorId: schedule.doctorId || null,
        provinceId: schedule.provinceId || null,
        cityId: schedule.cityId || null,
        hasWaitingRoom: schedule.hasWaitingRoom ?? null,
        scheduleType: schedule.scheduleType,
        colorSchemaId: schedule.colorSchemaId || null,
        isVirtual: schedule.isVirtual,
        patientsNotificationType: schedule.patientsNotificationType,
      };

      if (existing) {
        // Check if there are actual changes
        const hasChanges = Object.entries(data).some(([key, value]) => {
          const existingValue = existing[key as keyof typeof existing];
          return JSON.stringify(existingValue) !== JSON.stringify(value);
        });

        if (hasChanges) {
          await db.doctoraliaSchedule.update({
            where: { externalId: schedule.id },
            data,
          });
          updated++;
        } else {
          skipped++;
        }
      } else {
        await db.doctoraliaSchedule.create({ data });
        inserted++;
      }
    } catch (error) {
      console.error(`Error upserting schedule ${schedule.id}:`, error);
      skipped++;
    }
  }

  return { inserted, updated, skipped };
}

/**
 * Upsert Doctoralia appointments into the database
 */
export async function upsertDoctoraliaAppointments(
  scheduleExternalId: number,
  appointments: DoctoraliaAppointment[],
) {
  if (appointments.length === 0) {
    return { inserted: 0, updated: 0, skipped: 0 };
  }

  // Get schedule internal ID
  const schedule = await db.doctoraliaSchedule.findUnique({
    where: { externalId: scheduleExternalId },
    select: { id: true },
  });

  if (!schedule) {
    console.warn(`Schedule ${scheduleExternalId} not found. Skipping appointments.`);
    return { inserted: 0, updated: 0, skipped: appointments.length };
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  const BATCH_SIZE = 50;
  for (let i = 0; i < appointments.length; i += BATCH_SIZE) {
    const batch = appointments.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (appointment) => {
        try {
          const existing = await db.doctoraliaCalendarAppointment.findUnique({
            where: {
              scheduleId_externalId: {
                scheduleId: schedule.id,
                externalId: appointment.id,
              },
            },
          });

          const data = {
            scheduleId: schedule.id,
            externalId: appointment.id,
            title: appointment.title,
            startAt: new Date(appointment.start),
            endAt: new Date(appointment.end),
            isBlock: appointment.isBlock,
            eventType: appointment.eventType,
            scheduledBy: appointment.scheduledBy,
            status: appointment.status,
            hasPatient: appointment.hasPatient,
            hasWaitingRoom: appointment.hasWaitingRoom ?? null,
            insuranceId: appointment.insuranceId || null,
            insuranceName: appointment.insuranceName || null,
            comments: appointment.comments || null,
            serviceId: appointment.serviceId,
            serviceName: appointment.serviceName,
            // ZenStack expects JsonObject for this field in current generated types.
            ...(appointment.eventServices
              ? { eventServices: { items: toJsonValue(appointment.eventServices) } }
              : {}),
            serviceColorSchemaId: appointment.serviceColorSchemaId,
            serviceIsDeleted: appointment.serviceIsDeleted,
            attendance: appointment.attendance,
            patientExternalId: appointment.patientId,
            patientReferenceId: appointment.patientReferenceId,
            patientPhone: appointment.patientPhone || null,
            patientEmail: appointment.patientEmail || null,
            patientBirthDate: appointment.patientBirthDate
              ? new Date(appointment.patientBirthDate)
              : null,
            patientArrivalTime: appointment.patientArrivalTime
              ? new Date(appointment.patientArrivalTime)
              : null,
            isPatientFirstTime: appointment.isPatientFirstTime,
            isPatientFirstAdminBooking: appointment.isPatientFirstAdminBooking,
            isBookedViaSecretaryAi: appointment.isBookedViaSecretaryAi,
            onlinePaymentType: appointment.onlinePaymentType || null,
            onlinePaymentStatus: appointment.onlinePaymentStatus || null,
            isPaidOnline: appointment.isPaidOnline,
            communicationChannel: appointment.communicationChannel || null,
            fake: appointment.fake,
            isEventWithVoucher: appointment.isEventWithVoucher,
            duration: appointment.duration,
            canNotifyPatient: appointment.canNotifyPatient,
            noShowProtection: appointment.noShowProtection,
          };

          if (existing) {
            // Check if there are actual changes (simplified comparison)
            const hasChanges =
              JSON.stringify(existing) !== JSON.stringify({ ...existing, ...data });

            if (hasChanges) {
              await db.doctoraliaCalendarAppointment.update({
                where: {
                  scheduleId_externalId: {
                    scheduleId: schedule.id,
                    externalId: appointment.id,
                  },
                },
                data,
              });
              updated++;
            } else {
              skipped++;
            }
          } else {
            await db.doctoraliaCalendarAppointment.create({ data });
            inserted++;
          }
        } catch (error) {
          console.error(`Error upserting appointment ${appointment.id}:`, error);
          skipped++;
        }
      }),
    );
  }

  return { inserted, updated, skipped };
}

/**
 * Upsert Doctoralia work periods into the database
 */
export async function upsertDoctoraliaWorkPeriods(
  scheduleExternalId: number,
  workPeriods: DoctoraliaWorkPeriod[],
) {
  if (workPeriods.length === 0) {
    return { inserted: 0, updated: 0, skipped: 0 };
  }

  // Get schedule internal ID
  const schedule = await db.doctoraliaSchedule.findUnique({
    where: { externalId: scheduleExternalId },
    select: { id: true },
  });

  if (!schedule) {
    console.warn(`Schedule ${scheduleExternalId} not found. Skipping work periods.`);
    return { inserted: 0, updated: 0, skipped: workPeriods.length };
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const period of workPeriods) {
    try {
      // Work periods don't have unique external IDs, so we use start/end time uniqueness
      const existing = await db.doctoraliaWorkPeriod.findFirst({
        where: {
          scheduleId: schedule.id,
          startAt: new Date(period.start),
          endAt: new Date(period.end),
        },
      });

      const data = {
        scheduleId: schedule.id,
        startAt: new Date(period.start),
        endAt: new Date(period.end),
        isPrivate: period.isPrivate,
      };

      if (existing) {
        // Check if is_private changed
        if (existing.isPrivate !== data.isPrivate) {
          await db.doctoraliaWorkPeriod.update({
            where: { id: existing.id },
            data: { isPrivate: data.isPrivate },
          });
          updated++;
        } else {
          skipped++;
        }
      } else {
        await db.doctoraliaWorkPeriod.create({ data });
        inserted++;
      }
    } catch (error) {
      console.error(`Error upserting work period:`, error);
      skipped++;
    }
  }

  return { inserted, updated, skipped };
}

/**
 * Apply appointment updates from alerts feed.
 * We only patch fields present in the alert payload and skip unknown events.
 */
export async function applyDoctoraliaAlertUpdates(alerts: DoctoraliaCalendarAlert[]) {
  if (alerts.length === 0) {
    return { updated: 0, skipped: 0 };
  }

  let updated = 0;
  let skipped = 0;

  for (const alert of alerts) {
    const eventId = alert.params.eventId;
    if (!eventId) {
      skipped++;
      continue;
    }

    const data: {
      status?: number;
      startAt?: Date;
      patientExternalId?: number;
    } = {};

    if (typeof alert.params.eventStatus === "number") {
      data.status = alert.params.eventStatus;
    }

    if (typeof alert.params.patientId === "number") {
      data.patientExternalId = alert.params.patientId;
    }

    if (alert.params.eventStartDateTime) {
      const startAt = new Date(alert.params.eventStartDateTime);
      if (!Number.isNaN(startAt.getTime())) {
        data.startAt = startAt;
      }
    }

    if (Object.keys(data).length === 0) {
      skipped++;
      continue;
    }

    try {
      const result = await db.doctoraliaCalendarAppointment.updateMany({
        where: { externalId: eventId },
        data,
      });

      if (result.count > 0) {
        updated += result.count;
      } else {
        skipped++;
      }
    } catch (error) {
      console.error(`Error applying alert update for event ${eventId}:`, error);
      skipped++;
    }
  }

  return { updated, skipped };
}

/**
 * Create a sync log entry
 */
export async function createDoctoraliaSyncLog(data: {
  triggerSource?: string;
  triggerUserId?: number;
  status: string;
  schedulesSynced?: number;
  appointmentsSynced?: number;
  workPeriodsSynced?: number;
  errorMessage?: string;
}) {
  return db.doctoraliaCalendarSyncLog.create({
    data: {
      triggerSource: data.triggerSource || null,
      triggerUserId: data.triggerUserId || null,
      status: data.status,
      startedAt: new Date(),
      endedAt: data.status !== "PENDING" ? new Date() : null,
      schedulesSynced: data.schedulesSynced || 0,
      appointmentsSynced: data.appointmentsSynced || 0,
      workPeriodsSynced: data.workPeriodsSynced || 0,
      errorMessage: data.errorMessage || null,
    },
  });
}

/**
 * Update a sync log entry
 */
export async function updateDoctoraliaSyncLog(
  id: number,
  data: {
    status: string;
    schedulesSynced?: number;
    appointmentsSynced?: number;
    workPeriodsSynced?: number;
    errorMessage?: string;
  },
) {
  return db.doctoraliaCalendarSyncLog.update({
    where: { id },
    data: {
      status: data.status,
      endedAt: new Date(),
      schedulesSynced: data.schedulesSynced,
      appointmentsSynced: data.appointmentsSynced,
      workPeriodsSynced: data.workPeriodsSynced,
      errorMessage: data.errorMessage || null,
    },
  });
}
