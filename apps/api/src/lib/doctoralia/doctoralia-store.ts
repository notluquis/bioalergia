/**
 * Doctoralia Store - Database Operations
 *
 * CRUD operations for Doctoralia entities in the database.
 * Uses the @finanzas/db package.
 */

import { db } from "@finanzas/db";
import type {
  DoctoraliaAddress,
  DoctoraliaBooking,
  DoctoraliaCalendarBreak,
  DoctoraliaDoctor,
  DoctoraliaFacility,
  DoctoraliaInsuranceProvider,
  DoctoraliaService,
} from "./doctoralia-types.js";

// ============================================================
// FACILITIES
// ============================================================

export async function upsertFacility(facility: DoctoraliaFacility) {
  return db.doctoraliaFacility.upsert({
    where: { externalId: facility.id },
    create: {
      externalId: facility.id,
      name: facility.name,
    },
    update: {
      name: facility.name,
    },
  });
}

export async function getFacilityByExternalId(externalId: string) {
  return db.doctoraliaFacility.findUnique({
    where: { externalId },
  });
}

export async function listFacilities() {
  return db.doctoraliaFacility.findMany({
    orderBy: { name: "asc" },
  });
}

// ============================================================
// DOCTORS
// ============================================================

export async function upsertDoctor(facilityId: number, doctor: DoctoraliaDoctor) {
  return db.doctoraliaDoctor.upsert({
    where: {
      facilityId_externalId: {
        facilityId,
        externalId: doctor.id,
      },
    },
    create: {
      facilityId,
      externalId: doctor.id,
      name: doctor.name,
      surname: doctor.surname,
      profileUrl: doctor.profile_url,
    },
    update: {
      name: doctor.name,
      surname: doctor.surname,
      profileUrl: doctor.profile_url,
    },
  });
}

export async function getDoctorByExternalId(facilityId: number, externalId: string) {
  return db.doctoraliaDoctor.findUnique({
    where: {
      facilityId_externalId: {
        facilityId,
        externalId,
      },
    },
  });
}

export async function listDoctorsByFacility(facilityId: number) {
  return db.doctoraliaDoctor.findMany({
    where: { facilityId },
    orderBy: { surname: "asc" },
  });
}

// ============================================================
// ADDRESSES
// ============================================================

export async function upsertAddress(doctorId: number, address: DoctoraliaAddress) {
  return db.doctoraliaAddress.upsert({
    where: {
      doctorId_externalId: {
        doctorId,
        externalId: address.id,
      },
    },
    create: {
      doctorId,
      externalId: address.id,
      name: address.name,
      cityName: address.city_name,
      postCode: address.post_code,
      street: address.street,
      onlineOnly: address.online_only ?? false,
    },
    update: {
      name: address.name,
      cityName: address.city_name,
      postCode: address.post_code,
      street: address.street,
      onlineOnly: address.online_only ?? false,
    },
  });
}

export async function getAddressByExternalId(doctorId: number, externalId: string) {
  return db.doctoraliaAddress.findUnique({
    where: {
      doctorId_externalId: {
        doctorId,
        externalId,
      },
    },
  });
}

export async function listAddressesByDoctor(doctorId: number) {
  return db.doctoraliaAddress.findMany({
    where: { doctorId },
  });
}

// ============================================================
// SERVICES
// ============================================================

export async function upsertService(addressId: number, service: DoctoraliaService) {
  return db.doctoraliaService.upsert({
    where: {
      addressId_externalId: {
        addressId,
        externalId: service.id,
      },
    },
    create: {
      addressId,
      externalId: service.id,
      serviceId: service.service_id,
      name: service.name,
      price: service.price,
      isPriceFrom: service.is_price_from ?? false,
      isDefault: service.is_default ?? false,
      isVisible: service.is_visible ?? true,
      description: service.description,
      defaultDuration: service.default_duration,
    },
    update: {
      serviceId: service.service_id,
      name: service.name,
      price: service.price,
      isPriceFrom: service.is_price_from ?? false,
      isDefault: service.is_default ?? false,
      isVisible: service.is_visible ?? true,
      description: service.description,
      defaultDuration: service.default_duration,
    },
  });
}

// ============================================================
// INSURANCE PROVIDERS
// ============================================================

export async function upsertInsuranceProvider(
  addressId: number,
  provider: DoctoraliaInsuranceProvider,
) {
  return db.doctoraliaInsuranceProvider.upsert({
    where: {
      addressId_insuranceProviderId: {
        addressId,
        insuranceProviderId: provider.id,
      },
    },
    create: {
      addressId,
      insuranceProviderId: provider.id,
      name: provider.name,
    },
    update: {
      name: provider.name,
    },
  });
}

// ============================================================
// BOOKINGS
// ============================================================

export async function upsertBooking(addressId: number, booking: DoctoraliaBooking) {
  return db.doctoraliaBooking.upsert({
    where: {
      addressId_externalId: {
        addressId,
        externalId: booking.id,
      },
    },
    create: {
      addressId,
      externalId: booking.id,
      status: booking.status,
      startAt: new Date(booking.start_at),
      endAt: new Date(booking.end_at),
      duration: booking.duration,
      bookedBy: booking.booked_by,
      bookedAt: booking.booked_at ? new Date(booking.booked_at) : null,
      canceledBy: booking.canceled_by,
      canceledAt: booking.canceled_at ? new Date(booking.canceled_at) : null,
      patientName: booking.patient?.name,
      patientSurname: booking.patient?.surname,
      patientEmail: booking.patient?.email,
      patientPhone: booking.patient?.phone,
      comment: booking.comment,
    },
    update: {
      status: booking.status,
      startAt: new Date(booking.start_at),
      endAt: new Date(booking.end_at),
      duration: booking.duration,
      canceledBy: booking.canceled_by,
      canceledAt: booking.canceled_at ? new Date(booking.canceled_at) : null,
      patientName: booking.patient?.name,
      patientSurname: booking.patient?.surname,
      patientEmail: booking.patient?.email,
      patientPhone: booking.patient?.phone,
      comment: booking.comment,
    },
  });
}

export async function listBookingsByAddress(addressId: number, startAt: Date, endAt: Date) {
  return db.doctoraliaBooking.findMany({
    where: {
      addressId,
      startAt: {
        gte: startAt,
        lte: endAt,
      },
    },
    orderBy: { startAt: "asc" },
  });
}

// ============================================================
// CALENDAR BREAKS
// ============================================================

export async function upsertBreak(addressId: number, breakData: DoctoraliaCalendarBreak) {
  return db.doctoraliaCalendarBreak.upsert({
    where: {
      addressId_externalId: {
        addressId,
        externalId: breakData.id,
      },
    },
    create: {
      addressId,
      externalId: breakData.id,
      since: new Date(breakData.since),
      till: new Date(breakData.till),
      description: breakData.description,
    },
    update: {
      since: new Date(breakData.since),
      till: new Date(breakData.till),
      description: breakData.description,
    },
  });
}

export async function deleteBreakByExternalId(addressId: number, externalId: string) {
  return db.doctoraliaCalendarBreak.delete({
    where: {
      addressId_externalId: {
        addressId,
        externalId,
      },
    },
  });
}

// ============================================================
// SLOTS (Bulk operations)
// ============================================================

export async function replaceSlots(
  addressId: number,
  slots: Array<{ startAt: Date; endAt: Date }>,
) {
  // Delete existing slots for this address
  await db.doctoraliaSlot.deleteMany({
    where: { addressId },
  });

  // Insert new slots
  if (slots.length > 0) {
    await db.doctoraliaSlot.createMany({
      data: slots.map((slot) => ({
        addressId,
        startAt: slot.startAt,
        endAt: slot.endAt,
      })),
    });
  }
}

export async function listSlotsByAddress(addressId: number, startAt: Date, endAt: Date) {
  return db.doctoraliaSlot.findMany({
    where: {
      addressId,
      startAt: {
        gte: startAt,
        lte: endAt,
      },
    },
    orderBy: { startAt: "asc" },
  });
}

// ============================================================
// SYNC LOGS
// ============================================================

export async function createSyncLog(params: { triggerSource?: string; triggerUserId?: number }) {
  return db.doctoraliaSyncLog.create({
    data: {
      triggerSource: params.triggerSource,
      triggerUserId: params.triggerUserId,
      status: "PENDING",
    },
  });
}

export async function finalizeSyncLog(
  id: number,
  params: {
    status: "SUCCESS" | "ERROR";
    facilitiesSynced?: number;
    doctorsSynced?: number;
    slotsSynced?: number;
    bookingsSynced?: number;
    errorMessage?: string;
  },
) {
  return db.doctoraliaSyncLog.update({
    where: { id },
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

export async function listSyncLogs(limit = 50) {
  return db.doctoraliaSyncLog.findMany({
    orderBy: { startedAt: "desc" },
    take: limit,
  });
}
