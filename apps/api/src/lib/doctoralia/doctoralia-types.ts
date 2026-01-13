/**
 * Doctoralia API TypeScript Types
 *
 * Matches the Doctoralia Integrations API v1.8.1 response structures.
 * Uses HATEOAS format with ISO8601 dates.
 */

// ============================================================
// BASE HATEOAS STRUCTURES
// ============================================================

export interface HateoasLink {
  href: string;
}

export interface HateoasLinks {
  self?: HateoasLink;
  first?: HateoasLink;
  last?: HateoasLink;
  next?: HateoasLink;
  previous?: HateoasLink;
}

export interface PaginatedResponse<T> {
  _items: T[];
  page: number;
  limit: number;
  pages: number;
  total: number;
  _links: HateoasLinks;
}

// ============================================================
// OAUTH2
// ============================================================

export interface OAuth2TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

// ============================================================
// API ENTITIES
// ============================================================

export interface DoctoraliaFacility {
  id: string;
  name: string;
  _links?: HateoasLinks;
}

export interface DoctoraliaDoctor {
  id: string;
  name: string;
  surname: string;
  profile_url?: string;
  specializations?: { _items: Array<{ id: string; name: string }> };
  _links?: HateoasLinks;
}

export interface DoctoraliaAddress {
  id: string;
  name: string;
  city_name: string;
  post_code: string;
  street: string;
  online_only?: boolean;
  booking_extra_fields?: {
    birth_date: boolean;
    gender: boolean;
    nin: boolean;
  };
  _links?: HateoasLinks;
}

export interface DoctoraliaService {
  id: string;
  service_id?: string;
  name: string;
  price?: number;
  is_price_from?: boolean;
  is_default?: boolean;
  is_visible?: boolean;
  description?: string;
  default_duration?: number;
  _links?: HateoasLinks;
}

export interface DoctoraliaInsuranceProvider {
  id: string;
  name: string;
}

export interface DoctoraliaSlot {
  start: string; // ISO8601 with timezone
  end?: string;
  services?: { _items: Array<{ id: string; name: string }> };
}

export interface DoctoraliaPatient {
  name: string;
  surname: string;
  email: string;
  phone: string;
  birth_date?: string;
  nin?: string;
  gender?: "m" | "f";
  is_returning?: boolean;
  insurance_number?: string;
}

export interface DoctoraliaInsurance {
  id: string;
  name: string;
  plan?: string;
  plan_id?: string;
}

export interface DoctoraliaBooking {
  id: string;
  status: "booked" | "canceled";
  start_at: string; // ISO8601
  end_at: string; // ISO8601
  duration: number; // minutes
  booked_by: string;
  booked_at: string;
  canceled_by?: string;
  canceled_at?: string;
  comment?: string;
  patient?: DoctoraliaPatient;
  insurance?: DoctoraliaInsurance;
  _links?: HateoasLinks;
}

export interface DoctoraliaCalendarBreak {
  id: string;
  since: string; // ISO8601
  till: string; // ISO8601
  description?: string;
  _links?: HateoasLinks;
}

// ============================================================
// BOOKING REQUEST PAYLOADS
// ============================================================

export interface BookSlotPayload {
  duration: number;
  comment?: string;
  patient: {
    name: string;
    surname: string;
    email: string;
    phone: string;
    birth_date?: string;
    nin?: string;
    gender?: "m" | "f";
  };
  service?: {
    id: string;
  };
  insurance?: {
    id: string;
    plan_id?: string;
  };
}

export interface CreateBreakPayload {
  since: string; // ISO8601
  till: string; // ISO8601
  description?: string;
}

// ============================================================
// SLOT UPDATE PAYLOADS
// ============================================================

export interface ReplaceSlotPayload {
  start: string; // ISO8601
  end: string; // ISO8601
}

export interface ReplaceSlotByDatePayload {
  date: string; // YYYY-MM-DD
  slots: Array<{
    start: string; // HH:MM
    end: string; // HH:MM
  }>;
}

// ============================================================
// WEBHOOK NOTIFICATIONS
// ============================================================

export interface DoctoraliaWebhookPayload {
  name: string;
  data: {
    facility?: { id: string };
    doctor?: { id: string };
    address?: { id: string };
    booking?: { id: string };
    break?: { id: string };
    [key: string]: unknown;
  };
}

export type DoctoraliaWebhookEvent =
  | "slot-booking"
  | "slot-booked"
  | "booking-canceled"
  | "booking-moved"
  | "break-created"
  | "break-removed";
