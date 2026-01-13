/**
 * Doctoralia Service - Business Logic
 *
 * High-level business operations for Doctoralia integration.
 */

import { db } from "@finanzas/db";

// ============================================================
// SYNC LOG MANAGEMENT
// ============================================================

export async function createDoctoraliaSyncLogEntry(params: {
  triggerSource?: string;
  triggerUserId?: number | null;
  triggerLabel?: string;
}) {
  // Check if there's already a pending sync
  const pending = await db.doctoraliaSyncLog.findFirst({
    where: { status: "PENDING" },
  });

  if (pending) {
    throw new Error("Sincronización Doctoralia ya en curso");
  }

  const log = await db.doctoraliaSyncLog.create({
    data: {
      triggerSource: params.triggerSource,
      triggerUserId: params.triggerUserId,
      status: "PENDING",
    },
  });

  return log.id;
}

export async function finalizeDoctoraliaSyncLogEntry(
  logId: number,
  params: {
    status: "SUCCESS" | "ERROR";
    facilitiesSynced?: number;
    doctorsSynced?: number;
    slotsSynced?: number;
    bookingsSynced?: number;
    errorMessage?: string;
  },
) {
  await db.doctoraliaSyncLog.update({
    where: { id: logId },
    data: {
      status: params.status,
      endedAt: new Date(),
      facilitiesSynced: params.facilitiesSynced ?? 0,
      doctorsSynced: params.doctorsSynced ?? 0,
      slotsSynced: params.slotsSynced ?? 0,
      bookingsSynced: params.bookingsSynced ?? 0,
      errorMessage: params.errorMessage,
    },
  });
}

export async function listDoctoraliaSyncLogs(limit = 50) {
  return db.doctoraliaSyncLog.findMany({
    orderBy: { startedAt: "desc" },
    take: limit,
  });
}

// ============================================================
// FACILITY LOOKUP
// ============================================================

export async function getDoctoraliaFacilitiesWithCounts() {
  const facilities = await db.doctoraliaFacility.findMany({
    include: {
      _count: {
        select: {
          doctors: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return facilities.map((f) => ({
    id: f.id,
    externalId: f.externalId,
    name: f.name,
    doctorCount: f._count.doctors,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
  }));
}

// ============================================================
// DOCTOR LOOKUP
// ============================================================

export async function getDoctoraliaDoctorsWithAddresses(facilityId: number) {
  const doctors = await db.doctoraliaDoctor.findMany({
    where: { facilityId },
    include: {
      addresses: {
        include: {
          _count: {
            select: {
              bookings: true,
              services: true,
            },
          },
        },
      },
    },
    orderBy: { surname: "asc" },
  });

  return doctors.map((d) => ({
    id: d.id,
    externalId: d.externalId,
    name: d.name,
    surname: d.surname,
    fullName: `${d.name} ${d.surname}`,
    profileUrl: d.profileUrl,
    addresses: d.addresses.map((a) => ({
      id: a.id,
      externalId: a.externalId,
      name: a.name,
      cityName: a.cityName,
      street: a.street,
      onlineOnly: a.onlineOnly,
      bookingCount: a._count.bookings,
      serviceCount: a._count.services,
    })),
  }));
}

// ============================================================
// BOOKING STATISTICS
// ============================================================

export async function getDoctoraliaBookingStats(
  addressId: number,
  startDate: Date,
  endDate: Date,
) {
  const bookings = await db.doctoraliaBooking.groupBy({
    by: ["status"],
    where: {
      addressId,
      startAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    _count: true,
  });

  const stats: Record<string, number> = {};
  for (const b of bookings) {
    stats[b.status] = b._count;
  }

  return {
    total: Object.values(stats).reduce((a, b) => a + b, 0),
    booked: stats["booked"] ?? 0,
    canceled: stats["canceled"] ?? 0,
  };
}
