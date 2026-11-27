import type { Db } from "./client";

export type DoctorStatus =
  | "AVAILABLE"
  | "BUSY"
  | "ON_BREAK"
  | "OFF_DUTY"
  | "UNAVAILABLE";

export interface DoctorSnapshot {
  id: string;
  fullName: string;
  specialty: string;
  department: string;
  acceptsPatients: boolean;
  emergencyAvailable: boolean;
  status: DoctorStatus;
  statusUpdatedAt: string | null;
  activeConsultations: number;
  queuedPatients: number;
  /** Whether the current Asia/Manila time falls inside a duty schedule. */
  onDutyNow: boolean;
}

interface ScheduleRow {
  doctor_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
}

const STATUS_VALUES: DoctorStatus[] = [
  "AVAILABLE",
  "BUSY",
  "ON_BREAK",
  "OFF_DUTY",
  "UNAVAILABLE",
];

/** Current weekday (0 = Sunday) and minutes since midnight in Asia/Manila. */
export function manilaClock(now: Date = new Date()): {
  weekday: number;
  minutes: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    get("weekday")
  );

  return {
    weekday,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":");

  return Number(h) * 60 + Number(m);
}

export function isOnDuty(schedules: ScheduleRow[], now: Date = new Date()) {
  const { weekday, minutes } = manilaClock(now);

  return schedules.some((s) => {
    const start = toMinutes(s.start_time);
    const end = toMinutes(s.end_time);

    if (s.weekday === weekday) {
      // Overnight windows (e.g. 22:00-06:00) run past midnight.
      return start < end ? minutes >= start && minutes < end : minutes >= start;
    }

    const previousDay = (weekday + 6) % 7;

    return s.weekday === previousDay && end < start && minutes < end;
  });
}

/**
 * Reads live doctors, availability, duty schedules and workload straight from
 * Supabase. Nothing here is cached: assignment decisions always see the
 * current state of the hospital.
 */
export async function loadDoctorSnapshots(
  db: Db,
  filter: { department?: string; doctorId?: string } = {}
): Promise<DoctorSnapshot[]> {
  let doctorQuery = db
    .from("doctors")
    .select("id, full_name, specialty, department, accepts_patients, emergency_available")
    .eq("active", true);

  if (filter.department) doctorQuery = doctorQuery.eq("department", filter.department);
  if (filter.doctorId) doctorQuery = doctorQuery.eq("id", filter.doctorId);

  const { data: doctors, error } = await doctorQuery;

  if (error) throw new Error(`Could not load doctors: ${error.message}`);
  if (!doctors || doctors.length === 0) return [];

  const ids = doctors.map((d) => d.id);

  const [availability, schedules, workload] = await Promise.all([
    db
      .from("doctor_availability")
      .select("doctor_id, status, status_updated_at")
      .in("doctor_id", ids),
    db
      .from("doctor_schedules")
      .select("doctor_id, weekday, start_time, end_time")
      .in("doctor_id", ids),
    db.rpc("doctor_workload"),
  ]);

  if (availability.error) throw new Error(`Could not load availability: ${availability.error.message}`);
  if (schedules.error) throw new Error(`Could not load schedules: ${schedules.error.message}`);
  if (workload.error) throw new Error(`Could not load workload: ${workload.error.message}`);

  const availabilityById = new Map(
    (availability.data ?? []).map((a) => [a.doctor_id as string, a])
  );
  const workloadById = new Map(
    ((workload.data ?? []) as {
      doctor_id: string;
      active_consultations: number;
      queued_patients: number;
    }[]).map((w) => [w.doctor_id, w])
  );
  const schedulesById = new Map<string, ScheduleRow[]>();

  for (const row of (schedules.data ?? []) as ScheduleRow[]) {
    const list = schedulesById.get(row.doctor_id) ?? [];
    list.push(row);
    schedulesById.set(row.doctor_id, list);
  }

  const now = new Date();

  return doctors.map((d) => {
    const a = availabilityById.get(d.id);
    const w = workloadById.get(d.id);
    // A doctor with no availability row is treated as not working.
    const status = STATUS_VALUES.includes(a?.status as DoctorStatus)
      ? (a?.status as DoctorStatus)
      : "OFF_DUTY";

    return {
      id: d.id,
      fullName: d.full_name,
      specialty: d.specialty,
      department: d.department,
      acceptsPatients: d.accepts_patients,
      emergencyAvailable: d.emergency_available,
      status,
      statusUpdatedAt: a?.status_updated_at ?? null,
      activeConsultations: w?.active_consultations ?? 0,
      queuedPatients: w?.queued_patients ?? 0,
      onDutyNow: isOnDuty(schedulesById.get(d.id) ?? [], now),
    };
  });
}

export async function setDoctorStatus(db: Db, doctorId: string, status: DoctorStatus) {
  const { error } = await db
    .from("doctor_availability")
    .upsert({
      doctor_id: doctorId,
      status,
      status_updated_at: new Date().toISOString(),
    });

  if (error) throw new Error(error.message);
}
