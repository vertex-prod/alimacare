import "server-only";

import { ApiError } from "./errors";
import {
  ACTIVE_STATUSES,
  DEFAULT_DEPARTMENTS,
  STATUS_TRANSITIONS,
} from "./labels";
import { getSupabaseAdmin } from "./supabase";
import type {
  AppointmentStatus,
  DashboardData,
  DepartmentSummary,
  PatientListItem,
  PatientRow,
  QueueEvent,
  StatusCounts,
  VisitPurpose,
} from "./types";
import { zonedDateString } from "./time";

export const TIME_ZONE = "Asia/Manila";

export const LIST_COLUMNS =
  "id, patient_id, full_name, identity_unknown, age, sex, visit_purpose, respondent_role, chief_complaint, priority_lane, payment_type, department, status, queue_number, queue_date, assigned_doctor, assigned_room, estimated_wait_minutes, called_time, consultation_start_time, completed_time, registration_datetime";

export function todayManila(): string {
  return zonedDateString(new Date(), TIME_ZONE);
}

function emptyCounts(): StatusCounts {
  return {
    PENDING_RECEPTION: 0,
    APPROVED: 0,
    WAITING: 0,
    CALLED: 0,
    ONGOING: 0,
    COMPLETED: 0,
    CANCELLED: 0,
    NO_SHOW: 0,
    ARCHIVED: 0,
  };
}

function minutesBetween(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;

  const diff = new Date(to).getTime() - new Date(from).getTime();

  return Number.isFinite(diff) && diff >= 0 ? diff / 60000 : null;
}

function average(values: (number | null)[]): number | null {
  const valid = values.filter((value): value is number => value !== null);

  if (!valid.length) return null;

  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

function addDaysToDateString(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days));

  return value.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function getDashboard(): Promise<DashboardData> {
  const supabase = getSupabaseAdmin();
  const today = todayManila();
  const weekStart = addDaysToDateString(today, -6);

  const [todayResult, weekResult] = await Promise.all([
    supabase
      .from("patients")
      .select(LIST_COLUMNS)
      .eq("queue_date", today)
      .order("registration_datetime", { ascending: false }),
    supabase
      .from("patients")
      .select("queue_date")
      .gte("queue_date", weekStart)
      .lte("queue_date", today),
  ]);

  if (todayResult.error) throw todayResult.error;
  if (weekResult.error) throw weekResult.error;

  const patients = (todayResult.data ?? []) as PatientListItem[];
  const counts = emptyCounts();

  const departmentCodes = new Set<string>(DEFAULT_DEPARTMENTS);
  for (const patient of patients) {
    counts[patient.status] += 1;
    departmentCodes.add(patient.department);
  }

  const departments: DepartmentSummary[] = Array.from(departmentCodes).map(
    (code) => {
      const rows = patients.filter((patient) => patient.department === code);
      const count = (statuses: AppointmentStatus[]) =>
        rows.filter((row) => statuses.includes(row.status)).length;

      return {
        code,
        total: rows.length,
        active: count(ACTIVE_STATUSES),
        pending: count(["PENDING_RECEPTION"]),
        waiting: count(["APPROVED", "WAITING"]),
        serving: count(["CALLED", "ONGOING"]),
        completed: count(["COMPLETED"]),
      };
    }
  );

  const weeklyCounts = new Map<string, number>();
  for (const row of weekResult.data ?? []) {
    const date = row.queue_date as string | null;
    if (date) weeklyCounts.set(date, (weeklyCounts.get(date) ?? 0) + 1);
  }

  const weekly = Array.from({ length: 7 }, (_, index) => {
    const date = addDaysToDateString(weekStart, index);
    const label = new Intl.DateTimeFormat("en-PH", {
      weekday: "short",
      timeZone: "UTC",
    }).format(new Date(`${date}T00:00:00Z`));

    return { date, label, visits: weeklyCounts.get(date) ?? 0 };
  });

  return {
    today,
    total: patients.length,
    counts,
    emergencies: patients.filter((patient) => patient.visit_purpose === "emergency")
      .length,
    priority: patients.filter((patient) => patient.priority_lane !== "regular")
      .length,
    averageWaitMinutes: average(
      patients.map((patient) =>
        minutesBetween(patient.registration_datetime, patient.called_time)
      )
    ),
    averageServiceMinutes: average(
      patients.map((patient) =>
        minutesBetween(patient.consultation_start_time, patient.completed_time)
      )
    ),
    departments,
    recent: patients.slice(0, 8),
    weekly,
  };
}

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

export async function getQueue(date: string): Promise<PatientListItem[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("patients")
    .select(LIST_COLUMNS)
    .eq("queue_date", date)
    .in("status", ACTIVE_STATUSES)
    .order("registration_datetime", { ascending: true });

  if (error) throw error;

  return (data ?? []) as PatientListItem[];
}

// ---------------------------------------------------------------------------
// Patient records
// ---------------------------------------------------------------------------

export interface PatientFilters {
  q?: string | null;
  status?: AppointmentStatus | null;
  department?: string | null;
  purpose?: VisitPurpose | null;
  from?: string | null;
  to?: string | null;
  page: number;
  pageSize: number;
}

/** Strip characters that have meaning inside a PostgREST `or` filter. */
function sanitizeSearch(value: string): string {
  return value.replace(/[%,()*\\"']/g, " ").trim().slice(0, 80);
}

export async function listPatients(
  filters: PatientFilters
): Promise<{ patients: PatientListItem[]; total: number }> {
  let query = getSupabaseAdmin()
    .from("patients")
    .select(LIST_COLUMNS, { count: "exact" });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.department) query = query.eq("department", filters.department);
  if (filters.purpose) query = query.eq("visit_purpose", filters.purpose);
  if (filters.from) query = query.gte("queue_date", filters.from);
  if (filters.to) query = query.lte("queue_date", filters.to);

  const search = filters.q ? sanitizeSearch(filters.q) : "";

  if (search) {
    const pattern = `%${search}%`;
    query = query.or(
      [
        `full_name.ilike.${pattern}`,
        `patient_id.ilike.${pattern}`,
        `queue_number.ilike.${pattern}`,
        `contact_number.ilike.${pattern}`,
        `guardian_full_name.ilike.${pattern}`,
      ].join(",")
    );
  }

  const start = (filters.page - 1) * filters.pageSize;

  const { data, error, count } = await query
    .order("registration_datetime", { ascending: false })
    .range(start, start + filters.pageSize - 1);

  if (error) throw error;

  return { patients: (data ?? []) as PatientListItem[], total: count ?? 0 };
}

export async function getPatient(id: string): Promise<PatientRow> {
  const { data, error } = await getSupabaseAdmin()
    .from("patients")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new ApiError(404, "Patient not found.");

  return data as PatientRow;
}

export async function getPatientEvents(id: string): Promise<QueueEvent[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("queue_events")
    .select("*")
    .eq("patient_id", id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  return (data ?? []) as QueueEvent[];
}

async function logEvent(
  patient: Pick<PatientRow, "id" | "queue_number" | "status">,
  performedBy: string,
  notes: string
): Promise<void> {
  const { error } = await getSupabaseAdmin().from("queue_events").insert({
    patient_id: patient.id,
    queue_number: patient.queue_number,
    status: patient.status,
    performed_by: performedBy,
    notes,
  });

  if (error) throw error;
}

/**
 * Change the status. The database trigger sets the call/start/complete
 * timestamps and appends a "Status updated" event; this then stamps that event
 * with the admin's name and note.
 */
export async function changeStatus(
  id: string,
  next: AppointmentStatus,
  performedBy: string,
  options: {
    notes?: string | null;
    assignedDoctor?: string | null;
    assignedRoom?: string | null;
  } = {}
): Promise<PatientRow> {
  const supabase = getSupabaseAdmin();
  const current = await getPatient(id);

  if (current.status === next) {
    throw new ApiError(400, "The patient already has this status.");
  }

  if (!STATUS_TRANSITIONS[current.status].includes(next)) {
    throw new ApiError(
      400,
      `Cannot move a patient from ${current.status} to ${next}.`
    );
  }

  const patch: Record<string, unknown> = { status: next };

  if (options.assignedDoctor !== undefined) {
    patch.assigned_doctor = options.assignedDoctor;
  }
  if (options.assignedRoom !== undefined) {
    patch.assigned_room = options.assignedRoom;
  }

  // Reopening a closed record: clear the old completion time so the trigger
  // records a fresh one next time.
  if (["WAITING", "ONGOING"].includes(next) && current.completed_time) {
    patch.completed_time = null;
  }

  // Optimistic concurrency: only apply if nobody changed the status meanwhile.
  const { data, error } = await supabase
    .from("patients")
    .update(patch)
    .eq("id", id)
    .eq("status", current.status)
    .select("*");

  if (error) throw error;

  if (!data || !data.length) {
    throw new ApiError(
      409,
      "This patient was updated by someone else. Refresh and try again."
    );
  }

  const updated = data[0] as PatientRow;

  const { data: latest } = await supabase
    .from("queue_events")
    .select("id")
    .eq("patient_id", id)
    .eq("status", next)
    .is("performed_by", null)
    .order("created_at", { ascending: false })
    .limit(1);

  const note = options.notes?.trim() || "Status updated";

  if (latest && latest.length) {
    await supabase
      .from("queue_events")
      .update({ performed_by: performedBy, notes: note })
      .eq("id", latest[0].id);
  } else {
    await logEvent(updated, performedBy, note);
  }

  return updated;
}

export interface PatientDetailsPatch {
  assigned_doctor?: string | null;
  assigned_room?: string | null;
  estimated_wait_minutes?: number | null;
  priority_lane?: PatientRow["priority_lane"];
  department?: string;
}

export async function updatePatientDetails(
  id: string,
  patch: PatientDetailsPatch,
  performedBy: string,
  reason?: string | null
): Promise<PatientRow> {
  if (!Object.keys(patch).length) {
    throw new ApiError(400, "Nothing to update.");
  }

  const current = await getPatient(id);

  const { data, error } = await getSupabaseAdmin()
    .from("patients")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;

  const updated = data as PatientRow;
  const changes: string[] = [];

  if (patch.department && patch.department !== current.department) {
    changes.push(`Transferred ${current.department} → ${updated.department}`);
  }
  if (
    patch.priority_lane !== undefined &&
    patch.priority_lane !== current.priority_lane
  ) {
    changes.push(`Priority ${current.priority_lane} → ${updated.priority_lane}`);
  }
  if (
    patch.assigned_doctor !== undefined &&
    patch.assigned_doctor !== current.assigned_doctor
  ) {
    changes.push(`Doctor: ${updated.assigned_doctor ?? "none"}`);
  }
  if (
    patch.assigned_room !== undefined &&
    patch.assigned_room !== current.assigned_room
  ) {
    changes.push(`Room: ${updated.assigned_room ?? "none"}`);
  }

  if (changes.length) {
    const note = [changes.join("; "), reason?.trim()].filter(Boolean).join(" — ");
    await logEvent(updated, performedBy, note.slice(0, 500));
  }

  return updated;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const EXPORT_COLUMNS = [
  "patient_id",
  "queue_date",
  "queue_number",
  "department",
  "status",
  "registration_datetime",
  "called_time",
  "consultation_start_time",
  "completed_time",
  "respondent_role",
  "visit_purpose",
  "full_name",
  "identity_unknown",
  "dob",
  "age",
  "sex",
  "civil_status",
  "address",
  "contact_number",
  "chief_complaint",
  "allergies",
  "has_request_slip",
  "priority_lane",
  "payment_type",
  "hmo_provider",
  "hmo_no",
  "philhealth_pin",
  "employer_name",
  "room_preference",
  "emergency_contact_name",
  "emergency_contact_relationship",
  "emergency_contact_number",
  "guardian_full_name",
  "guardian_relationship",
  "guardian_contact_number",
  "guardian_id_type",
  "consent_given",
  "assigned_doctor",
  "assigned_room",
] as const;

export async function exportPatients(
  from: string,
  to: string
): Promise<Record<string, unknown>[]> {
  const supabase = getSupabaseAdmin();
  const rows: Record<string, unknown>[] = [];
  const pageSize = 1000;

  for (let start = 0; ; start += pageSize) {
    const { data, error } = await supabase
      .from("patients")
      .select(EXPORT_COLUMNS.join(", "))
      .gte("queue_date", from)
      .lte("queue_date", to)
      .order("queue_date", { ascending: true })
      .order("registration_datetime", { ascending: true })
      .range(start, start + pageSize - 1);

    if (error) throw error;

    rows.push(...((data ?? []) as unknown as Record<string, unknown>[]));

    if (!data || data.length < pageSize || rows.length >= 50_000) break;
  }

  return rows;
}
