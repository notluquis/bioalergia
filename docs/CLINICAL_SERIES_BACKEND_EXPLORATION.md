# Clinical Series Backend Implementation Guide

**Last Updated:** March 11, 2026  
**Status:** Complete Backend Exploration  
**Purpose:** Frontend component design reference

---

## 📋 Table of Contents

1. [API Endpoints](#api-endpoints)
2. [Data Models](#data-models)
3. [Services & Queries](#services--queries)
4. [Route Handlers](#route-handlers)
5. [Permission Checks](#permission-checks)
6. [Business Logic](#business-logic)
7. [Type Definitions](#type-definitions)

---

## 🔌 API Endpoints

### Clinical Series Endpoints

All endpoints are exposed via **oRPC (Object Remote Procedure)** in the calendar module.

#### 1. **Rebuild Clinical Series** (Reorganize series from events)

```
POST /api/orpc/calendar/rpc/series/rebuild
```

**Description:** Reorganizes calendar events into clinical series groups based on event categories and metadata.

**Input Schema:**

```typescript
{
  from?: string;    // Date string: YYYY-MM-DD (optional)
  to?: string;      // Date string: YYYY-MM-DD (optional)
}
```

**Response Schema:**

```typescript
{
  processed: number; // Total events processed
  from: string | null; // Start date used (YYYY-MM-DD)
  to: string | null; // End date used (YYYY-MM-DD)
}
```

**Permission Required:** `update` on `CalendarEvent`

**Example Response:**

```json
{
  "processed": 247,
  "from": "2026-01-01",
  "to": "2026-03-11"
}
```

---

#### 2. **Get Suggestions with Clinical Series** (Via DTE Event Links)

```
GET /api/orpc/dte-event-links/rpc/suggestions?calendarId={id}&eventId={id}&limit={n}
```

**Description:** Retrieves suggestions for matching calendar events to DTE documents. Includes clinical series snapshot if the event belongs to a series.

**Input Schema:**

```typescript
{
  calendarId: string;     // Google Calendar ID
  eventId: string;        // External event ID (from Google)
  limit?: number;         // Max suggestions (1-30, default unclear)
}
```

**Response Schema:**

```typescript
{
  event: {
    amountExpected: number | null;
    amountPaid: number | null;
    calendarId: string;
    description: string | null;
    eventDate: string;           // YYYY-MM-DD
    eventId: string;
    hints: {
      nameHints: string[];      // Patient name candidates
      rutHints: string[];       // Patient RUT candidates
    };
    summary: string | null;
  } | null;

  linked: unknown | null;  // Existing DTE link if any

  series: ClinicalSeriesSnapshot | null;  // ← FULL SERIES DATA

  suggestions: EventDteSuggestion[];  // Array of matching DTE documents
}
```

**Permission Required:**

- `read` on `CalendarDaily`
- `read` on `DTEPurchaseDetail`

---

### Related Endpoints (Event Classification)

These endpoints also update `clinicalSeriesId` on events:

#### 3. **Classify Event** (Manual classification)

```
POST /api/orpc/calendar/rpc/events/classify
```

**Input includes optional:**

```typescript
{
  clinicalSeriesId?: null | number;  // Assign/unassign series
  // ... other fields
}
```

---

## 📊 Data Models

### ClinicalSeries (Database Schema)

**Location:** `/packages/db/zenstack/schema.zmodel` (lines 795-817)

```zmodel
model ClinicalSeries {
  id               Int                  @id @default(autoincrement())
  kind             ClinicalSeriesKind
  status           ClinicalSeriesStatus @default(ACTIVE)
  displayName      String?              @map("display_name")
  patientName      String?              @map("patient_name")
  patientRut       String?              @map("patient_rut")
  expectedSessions Int?                 @map("expected_sessions")
  notes            String?
  completedAt      DateTime?            @map("completed_at")
  createdAt        DateTime             @default(now()) @map("created_at")
  updatedAt        DateTime             @default(now()) @updatedAt @map("updated_at")
  events           Event[]

  // Access Control
  @@deny('all', auth() == null)                    // Deny all unauthenticated
  @@allow('read', true)                           // Everyone can read
  @@allow('create,update,delete', auth().status == 'ACTIVE')  // Only active users do mutations

  @@index([kind, status])
  @@index([patientRut])
  @@map("clinical_series")
}
```

### Enums

```zmodel
enum ClinicalSeriesKind {
  PATCH_TEST                  // Test de parche
  SKIN_TEST                   // Test cutáneo
  SUBCUTANEOUS_TREATMENT      // Tratamiento subcutáneo
}

enum ClinicalSeriesStatus {
  ACTIVE                      // Ongoing series
  COMPLETED                   // Finished series
  CANCELLED                   // Cancelled series
}

enum ClinicalSeriesStageKind {
  INSTALLATION                // Initial setup stage
  READING                     // Reading/observation stage
  DOSE                        // Dosage administration stage
  MAINTENANCE                 // Ongoing maintenance
}
```

### Relationship to Events

```zmodel
model Event {
  // ... other fields ...

  clinicalSeriesId    Int?              @map("clinical_series_id")
  seriesStageKind     ClinicalSeriesStageKind? @map("series_stage_kind")
  seriesStageLabel    String?           @map("series_stage_label")
  seriesStageNumber   Int?              @map("series_stage_number")

  clinicalSeries      ClinicalSeries?   @relation(fields: [clinicalSeriesId], references: [id], onDelete: SetNull)

  @@index([clinicalSeriesId])
}
```

### Frontend TypeScript Types

**Location:** `/apps/intranet/src/features/calendar/types.ts` (lines 190-245)

```typescript
export interface ClinicalSeriesLinkedDocument {
  clientName: string;
  clientRUT: string;
  confidenceScore: number;
  documentDate: string; // YYYY-MM-DD
  dteSaleDetailId: string;
  folio: string;
  matchedBy: string; // How was it matched?
  totalAmount: number;
}

export interface ClinicalSeriesEvent {
  amountExpected: number | null;
  amountPaid: number | null;
  calendarGoogleId: string;
  eventDate: string; // YYYY-MM-DD
  eventId: number; // Internal ID
  externalEventId: string; // Google event ID
  seriesStageKind: "DOSE" | "INSTALLATION" | "MAINTENANCE" | "READING" | null;
  seriesStageLabel: string | null;
  seriesStageNumber: number | null; // Stage sequence number
  summary: string | null;
}

export interface ClinicalSeriesSnapshot {
  displayName: string | null;
  eligibleDocumentDateFrom: string; // YYYY-MM-DD (startDate - 7 days)
  eligibleDocumentDateTo: string; // YYYY-MM-DD (endDate + 30 days, capped at today)
  events: ClinicalSeriesEvent[];
  id: number;
  kind: "PATCH_TEST" | "SKIN_TEST" | "SUBCUTANEOUS_TREATMENT";
  linkedDocuments: ClinicalSeriesLinkedDocument[];
  patientName: string | null;
  patientRut: string | null;
  remainingExpected: number; // totalExpected - totalLinkedAmount
  remainingPaid: number; // totalPaid - totalLinkedAmount
  status: "ACTIVE" | "CANCELLED" | "COMPLETED";
  totalExpected: number; // Sum of all event.amountExpected
  totalLinkedAmount: number; // Sum of all linkedDocument.totalAmount
  totalPaid: number; // Sum of all event.amountPaid
}
```

---

## 🛠️ Services & Queries

### Primary Service File

**Location:** `/apps/api/src/services/clinical-series.ts`

#### Key Exported Functions

##### 1. **syncClinicalSeriesForInternalEventId(eventId: number)**

```typescript
// Purpose: Main sync function - links event to clinical series or creates new one
// Returns: Series ID or null

// Logic:
// 1. Load event details (summary, description, category, etc.)
// 2. Infer series kind from event category
// 3. Extract patient hints (RUT + name) from event text
// 4. Find or create matching series
// 5. Update event's clinicalSeriesId
// 6. Refresh series metadata (expectedSessions, displayName, etc.)
```

**Details:**

- **Infers Series Kind** from event category:
  - `"Tratamiento subcutáneo"` → `SUBCUTANEOUS_TREATMENT`
  - `"Test y exámenes"` + patchTest metadata → `PATCH_TEST`
  - `"Test y exámenes"` + skinTest metadata → `SKIN_TEST`
- **Series Window Logic** (determines if event belongs to existing series):
  - `SUBCUTANEOUS_TREATMENT`: 180-day window
  - `PATCH_TEST` / `SKIN_TEST`: 45-day window
- **Patient Extraction** from event text:
  - RUT matching: Regex `/\b\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK]\b/`
  - Name matching: Regex for capitalized multi-word names (5+ chars minimum after normalization)

---

##### 2. **syncClinicalSeriesForEventIds(eventIds: number[])**

```typescript
// Batch sync for multiple internal event IDs
```

---

##### 3. **syncClinicalSeriesForExternalEvents(events: Array<{ calendarId: string; eventId: string }>)**

```typescript
// Sync from Google Calendar external IDs
```

---

##### 4. **rebuildClinicalSeries(params?: { from?: string; to?: string })**

```typescript
// Purpose: Full rebuild/reorganization of all clinical series
// Queries all events in categories: 'Test y exámenes', 'Tratamiento subcutáneo'
// Date-filtered by from/to if provided (YYYY-MM-DD format)
// Syncs each event sequentially
// Returns: { processed: number, from: string | null, to: string | null }
```

**Database Query Used:**

```sql
SELECT e.id AS "eventId"
FROM events e
WHERE e.category IN ('Test y exámenes', 'Tratamiento subcutáneo')
  AND (start_date >= date OR start_date IS NULL)
  AND (start_date <= date OR start_date IS NULL)
ORDER BY start_date ASC, e.id ASC
```

---

##### 5. **getClinicalSeriesSnapshotByExternalEvent(params: { calendarId: string; eventId: string })**

```typescript
// Purpose: Get complete series data for frontend display
// Returns: ClinicalSeriesSnapshot | null

// Loads:
// - Series metadata (displayName, patientName, patientRut, etc.)
// - All events in series (with dates, amounts, stage info)
// - All linked DTE documents
// - Calculations (totals, remaining amounts, eligible date ranges)
```

**Date Range Calculations:**

```typescript
eligibleDocumentDateFrom = eventStartDate - 7 days
eligibleDocumentDateTo = Math.min(eventEndDate + 30 days, today)
```

**Remaining Amounts Logic:**

```typescript
remainingExpected = Math.max(0, totalExpected - totalLinkedAmount);
remainingPaid = Math.max(0, totalPaid - totalLinkedAmount);
```

---

### Helper Functions (Internal)

```typescript
// Text normalization
normalizeName(value: string): string
// - Removes accents (NFKD normalization)
// - Converts to lowercase
// - Removes special chars (keeps letters, numbers, spaces, hyphens)
// - Trims whitespace

// Extract patient hints from event text
extractPatientHints(summary: null | string, description: null | string)
// Returns: { patientRut: string | null, patientName: string | null }

// Infer series kind from event metadata
inferSeriesKind(event: EventSeriesCandidate): ClinicalSeriesKind | null

// Get series window (how far apart events can be for same series)
getSeriesWindowDays(kind: ClinicalSeriesKind): number
// SUBCUTANEOUS_TREATMENT → 180 days
// Others → 45 days

// Find matching existing series
async findMatchingSeries(params: {
  eventDate: string;
  kind: ClinicalSeriesKind;
  patientName: string | null;
  patientRut: string | null;
}): Promise<number | null>

// Refresh series metadata after changes
async refreshClinicalSeriesMetadata(seriesId: number)
// Updates: displayName, patientName, patientRut, expectedSessions
```

---

## 🔀 Route Handlers

### Calendar Module Routes

**Location:** `/apps/api/src/orpc/calendar.ts`

#### Route: `/series/rebuild`

```typescript
const rebuildClinicalSeriesRoute = requirePermission("CalendarEvent", "update")
  .route({
    method: "POST",
    path: "/series/rebuild",
    summary: "Reagrupar series clinicas para tests y tratamientos subcutaneos",
  })
  .input(rebuildClinicalSeriesInputSchema)
  .output(rebuildClinicalSeriesResponseSchema)
  .handler(async ({ input }) => rebuildClinicalSeries(input));
```

**Input Validation:**

```typescript
const rebuildClinicalSeriesInputSchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});
```

**Output Validation:**

```typescript
const rebuildClinicalSeriesResponseSchema = z.object({
  from: z.string().nullable(),
  processed: z.number(),
  to: z.string().nullable(),
});
```

---

### DTE Event Links Module Routes

**Location:** `/apps/api/src/orpc/dte-event-links.ts`

#### Route: `/suggestions`

```typescript
const eventLinkSuggestions = readEventLinks
  .route({
    method: "GET",
    path: "/suggestions",
    summary: "Sugiere DTE para un evento",
  })
  .input(eventLinkSuggestionsInputSchema)
  .output(suggestionsResponseSchema)
  .handler(async ({ input }) => {
    return getEventDteSuggestions(input);
  });
```

**Middleware Chain:**

```
readEventLinks middleware
├─ Check: hasPermission(userId, "read", "CalendarDaily")
├─ Check: hasPermission(userId, "read", "DTEPurchaseDetail")
└─ Handler: getEventDteSuggestions()
    └─ Calls: getClinicalSeriesSnapshotByExternalEvent()
              └─ Database query for: series + events + linkedDocuments
```

---

## 🔐 Permission Checks

### Access Control Matrix

| Operation             | Subject              | Permission                                           | User Status | Notes                                              |
| --------------------- | -------------------- | ---------------------------------------------------- | ----------- | -------------------------------------------------- |
| Read ClinicalSeries   | ANY                  | N/A                                                  | ANY         | Allowed for all (Zenstack @allow('read', true))    |
| Create ClinicalSeries | ANY                  | N/A                                                  | ACTIVE      | Only ACTIVE users (Zenstack @allow('create', ...)) |
| Update ClinicalSeries | ANY                  | N/A                                                  | ACTIVE      | Only ACTIVE users                                  |
| Delete ClinicalSeries | ANY                  | N/A                                                  | ACTIVE      | Only ACTIVE users                                  |
| Rebuild Series        | POST /series/rebuild | `update` on `CalendarEvent`                          | ANY         | Requires explicit permission                       |
| Get Suggestions       | GET /suggestions     | `read` on both `CalendarDaily` + `DTEPurchaseDetail` | ANY         | Dual permission check                              |

### Code Examples

**Rebuild Route:**

```typescript
const rebuildClinicalSeriesRoute = requirePermission("CalendarEvent", "update").route({
  method: "POST",
  path: "/series/rebuild",
  // ...
});
```

**Suggestions Route (Dual Check):**

```typescript
const readEventLinks = authed.use(async ({ context, next }) => {
  const canReadCalendar = await hasPermission(context.user.id, "read", "CalendarDaily");
  const canReadDte = await hasPermission(context.user.id, "read", "DTEPurchaseDetail");

  if (!canReadCalendar || !canReadDte) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});
```

---

## 💡 Business Logic

### Series Grouping Algorithm

**Trigger:** When an event is classified or calendar is synced

**Process:**

1. **Detection Phase**

   ```
   Event has category?
   ├─ "Tratamiento subcutáneo" → SUBCUTANEOUS_TREATMENT
   └─ "Test y exámenes" → Check test metadata
      ├─ patchTest: true → PATCH_TEST
      └─ skinTest: true → SKIN_TEST

   If no matching kind → No series assigned
   ```

2. **Patient Extraction Phase**

   ```
   Extract from event.summary + event.description:
   ├─ RUT: First match of format: /\b\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK]\b/
   └─ Name: Longest capitalized phrase (5+ chars after normalization)

   If no patient hints → Keep existing series or return null
   ```

3. **Matching Phase (Find or Create)**

   ```
   Query: ClinicalSeries with same kind AND (patientRut OR patientName)

   For each candidate:
     Calculate event date distance to candidate's date range
       ├─ SUBCUTANEOUS_TREATMENT: ±180 days window
       └─ Others: ±45 days window

     If distance ≤ threshold:
       Pick: Candidate with smallest distance

   If no candidate found:
     Create: New ClinicalSeries with extracted hints
   ```

4. **Metadata Refresh Phase**
   ```
   After assignment, update series:
   ├─ displayName: "${identity} · ${kindLabel}"
   │  where identity = patientName || patientRut || "Paciente sin identificar"
   ├─ patientName: First extracted name from all events
   ├─ patientRut: First extracted RUT from all events
   └─ expectedSessions:
      ├─ Max of seriesStageNumber if any numbered stages exist
      ├─ null if MAINTENANCE stage found
      └─ count of events otherwise
   ```

### Series Display Name Logic

```typescript
function buildSeriesDisplayName(params: {
  kind: ClinicalSeriesKind;
  patientName: string | null;
  patientRut: string | null;
}): string {
  const kindLabel = {
    PATCH_TEST: "Test de parche",
    SKIN_TEST: "Test cutáneo",
    SUBCUTANEOUS_TREATMENT: "Tratamiento subcutáneo",
  }[params.kind];

  const identity = params.patientName ?? params.patientRut ?? "Paciente sin identificar";
  return `${identity} · ${kindLabel}`;
}
```

**Examples:**

- `"Juan Pérez · Test de parche"`
- `"19.000.000-1 · Tratamiento subcutáneo"`
- `"Paciente sin identificar · Test cutáneo"`

---

### Eligible Document Date Range

Calculates window for DTE document matching:

```typescript
function calculateEligibleDocumentDates(events: ClinicalSeriesEvent[]) {
  const eventDates = events.map((e) => parseDate(e.eventDate)).sort();
  const firstDate = dayjs(eventDates[0]);
  const lastDate = dayjs(eventDates[eventDates.length - 1]);

  return {
    from: firstDate.subtract(7, "days").format("YYYY-MM-DD"),
    to:
      lastDate.add(30, "days") > today
        ? today.format("YYYY-MM-DD")
        : lastDate.add(30, "days").format("YYYY-MM-DD"),
  };
}
```

**Rationale:**

- Documents dated 7 days _before_ first event accepted (patient history)
- Documents up to 30 days _after_ last event accepted (billing lag)
- Capped at today (don't allow future billing)

---

## 📝 Type Definitions

All types are exported from:

- **Backend (TypeScript):** `/apps/api/src/services/clinical-series.ts` (lines 14-65)
- **Frontend (TypeScript):** `/apps/intranet/src/features/calendar/types.ts`

### Complete Type Hierarchy

```typescript
// =====================================================
// SNAPSHOT TYPES (Complete series representation)
// =====================================================

export interface ClinicalSeriesSnapshot {
  displayName: string | null;
  eligibleDocumentDateFrom: string;
  eligibleDocumentDateTo: string;
  events: ClinicalSeriesEvent[];
  id: number;
  kind: ClinicalSeriesKind;
  linkedDocuments: ClinicalSeriesLinkedDocument[];
  patientName: string | null;
  patientRut: string | null;
  remainingExpected: number;
  remainingPaid: number;
  status: ClinicalSeriesStatus;
  totalExpected: number;
  totalLinkedAmount: number;
  totalPaid: number;
}

// =====================================================
// COMPONENT TYPES
// =====================================================

export interface ClinicalSeriesEvent {
  amountExpected: number | null;
  amountPaid: number | null;
  calendarGoogleId: string;
  eventDate: string; // YYYY-MM-DD
  eventId: number;
  externalEventId: string;
  seriesStageKind: ClinicalSeriesStageKind | null;
  seriesStageLabel: string | null;
  seriesStageNumber: number | null;
  summary: string | null;
}

export interface ClinicalSeriesLinkedDocument {
  clientName: string;
  clientRUT: string;
  confidenceScore: number;
  documentDate: string; // YYYY-MM-DD
  dteSaleDetailId: string;
  folio: string;
  matchedBy: string; // e.g., "rut", "name_fuzzy"
  totalAmount: number;
}

// =====================================================
// ENUM TYPES
// =====================================================

export type ClinicalSeriesKind = "PATCH_TEST" | "SKIN_TEST" | "SUBCUTANEOUS_TREATMENT";

export type ClinicalSeriesStatus = "ACTIVE" | "COMPLETED" | "CANCELLED";

export type ClinicalSeriesStageKind = "INSTALLATION" | "READING" | "DOSE" | "MAINTENANCE";

export type RebuildClinicalSeriesResponse = {
  from: string | null;
  processed: number;
  to: string | null;
};
```

---

## 🎯 Design Patterns for Frontend Components

### Pattern 1: Display Clinical Series Info

```typescript
// Component receives ClinicalSeriesSnapshot
<PatientSeriesCard series={snapshot} />
// Display: displayName, patientName/Rut, kind, status
// Show: eventCount, totalExpected/Paid, linkedDocumentCount
```

### Pattern 2: List Events in Series

```typescript
// Use snapshot.events array
{snapshot.events.map(event => (
  <EventRow
    key={event.eventId}
    date={event.eventDate}
    stage={event.seriesStageKind}
    amount={event.amountExpected}
    // ...
  />
))}
```

### Pattern 3: Match Documents to Series

```typescript
// Check eligibility before allowing link
if (
  documentDate >= snapshot.eligibleDocumentDateFrom &&
  documentDate <= snapshot.eligibleDocumentDateTo
) {
  // Allow linking to this series
}
```

### Pattern 4: Calculate Remaining Amounts

```typescript
// Frontend receives pre-calculated values
remaining = {
  expected: snapshot.remainingExpected, // May be 0 if over-linked
  paid: snapshot.remainingPaid,
};
```

---

## 📄 API Response Examples

### Rebuild Series Response

```json
{
  "processed": 247,
  "from": "2026-01-01",
  "to": "2026-03-11"
}
```

### Suggestions Endpoint Response

```json
{
  "event": {
    "amountExpected": 150000,
    "amountPaid": 150000,
    "calendarId": "google@calendar.com",
    "description": "Test de parche paciente Juan Pérez 19000000-1",
    "eventDate": "2026-03-05",
    "eventId": "google-event-123",
    "hints": {
      "nameHints": ["Juan Pérez"],
      "rutHints": ["19000000-1"]
    },
    "summary": "Lectura Test de Parche"
  },
  "linked": null,
  "series": {
    "displayName": "Juan Pérez · Test de parche",
    "eligibleDocumentDateFrom": "2026-02-26",
    "eligibleDocumentDateTo": "2026-04-04",
    "events": [
      {
        "amountExpected": 150000,
        "amountPaid": 150000,
        "calendarGoogleId": "google@calendar.com",
        "eventDate": "2026-02-25",
        "eventId": 12345,
        "externalEventId": "google-event-121",
        "seriesStageKind": "INSTALLATION",
        "seriesStageLabel": "Instalación",
        "seriesStageNumber": 1,
        "summary": "Instalación Test de Parche"
      },
      {
        "amountExpected": 0,
        "amountPaid": 0,
        "calendarGoogleId": "google@calendar.com",
        "eventDate": "2026-03-05",
        "eventId": 12346,
        "externalEventId": "google-event-122",
        "seriesStageKind": "READING",
        "seriesStageLabel": "Lectura",
        "seriesStageNumber": 2,
        "summary": "Lectura Test de Parche"
      }
    ],
    "id": 456,
    "kind": "PATCH_TEST",
    "linkedDocuments": [
      {
        "clientName": "Juan Pérez",
        "clientRUT": "19000000-1",
        "confidenceScore": 95.5,
        "documentDate": "2026-03-06",
        "dteSaleDetailId": "dte-001",
        "folio": "1234",
        "matchedBy": "rut",
        "totalAmount": 150000
      }
    ],
    "patientName": "Juan Pérez",
    "patientRut": "19000000-1",
    "remainingExpected": 0,
    "remainingPaid": 0,
    "status": "ACTIVE",
    "totalExpected": 150000,
    "totalLinkedAmount": 150000,
    "totalPaid": 150000
  },
  "suggestions": [
    {
      "clientName": "Juan Pérez",
      "clientRUT": "19000000-1",
      "confidenceScore": 95.5,
      "documentDate": "2026-03-06",
      "documentType": 33,
      "dteSaleDetailId": "dte-001",
      "exemptAmount": 0,
      "folio": "1234",
      "ivaAmount": 28571,
      "method": "rut",
      "netAmount": 121429,
      "reasons": ["RUT exact match", "Client name fuzzy match"],
      "registerNumber": 5001,
      "totalAmount": 150000
    }
  ]
}
```

---

## 🗂️ File Structure Summary

```
Backend
├── services/
│   ├── clinical-series.ts          ← Main service logic
│   └── dte-event-linking.ts        ← Uses clinical-series service
├── orpc/
│   ├── calendar.ts                 ← POST /series/rebuild endpoint
│   └── dte-event-links.ts          ← GET /suggestions endpoint
└── packages/db/zenstack/
    └── schema.zmodel               ← Database schema

Frontend
├── features/calendar/
│   ├── types.ts                    ← Type definitions
│   ├── api.ts                      ← Fetch functions
│   ├── schemas.ts                  ← Zod validation schemas
│   ├── dte-orpc.ts                 ← oRPC client definition
│   └── orpc.ts                     ← oRPC client instance
└── pages/
    └── CalendarClassificationPage.tsx ← Uses clinical series
```

---

## ✅ Summary for Frontend Design

### What You Can Rely On

1. **ClinicalSeriesSnapshot** - Complete snapshot with all data pre-computed
2. **Date calculations** - `eligibleDocumentDateFrom/To` provided by backend
3. **Remaining amounts** - Pre-calculated by backend to avoid re-computation
4. **Metadata** - `displayName`, `patientName`, `patientRut` populated intelligently
5. **Stage tracking** - `seriesStageKind`, `seriesStageNumber` on events
6. **Document linking** - Bridge between events and DTE documents

### Key Responsibilities for Frontend

1. Display series metadata (name, patient info, kind)
2. List events with dates and stage information
3. Filter/sort documents by eligible date range
4. Show linked documents with confidence scores
5. Trigger rebuild operation when needed
6. Manage user interaction for series creation/assignment

---

**Status:** ✅ Complete  
**Next Action:** Use this guide to design frontend components
