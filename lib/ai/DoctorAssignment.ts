import type { Db } from "../db/client";
import {
  loadDoctorSnapshots,
  type DoctorSnapshot,
  type DoctorStatus,
} from "../db/DoctorRepository";
import type { TriageLevel } from "./types";

export interface DoctorCandidate {
  id: string;
  fullName: string;
  specialty: string;
  department: string;
  status: DoctorStatus;
  activeConsultations: number;
  queuedPatients: number;
  onDutyNow: boolean;
  emergencyAvailable: boolean;
}

export interface DoctorAssignmentResult {
  doctor: DoctorCandidate | null;
  /** Everyone considered, so staff can see the live state used. */
  candidates: DoctorCandidate[];
  pendingAssignment: boolean;
  reason: string;
}

const STATUS_RANK: Record<DoctorStatus, number> = {
  AVAILABLE: 0,
  BUSY: 1,
  ON_BREAK: 2,
  OFF_DUTY: 3,
  UNAVAILABLE: 3,
};

function toCandidate(d: DoctorSnapshot): DoctorCandidate {
  return {
    id: d.id,
    fullName: d.fullName,
    specialty: d.specialty,
    department: d.department,
    status: d.status,
    activeConsultations: d.activeConsultations,
    queuedPatients: d.queuedPatients,
    onDutyNow: d.onDutyNow,
    emergencyAvailable: d.emergencyAvailable,
  };
}

/**
 * Whether a doctor can be assigned a patient of this level right now.
 * Off-duty / unavailable / not-accepting doctors are always excluded. For
 * Level 1-2 doctors on break are also excluded, and an emergency-available
 * doctor whose status is live-set to AVAILABLE or BUSY may be used even
 * outside their planned schedule window.
 */
export function isEligible(d: DoctorSnapshot, level: TriageLevel): boolean {
  if (!d.acceptsPatients) return false;
  if (d.status === "OFF_DUTY" || d.status === "UNAVAILABLE") return false;

  const critical = level <= 2;

  if (critical && d.status === "ON_BREAK") return false;
  if (d.onDutyNow) return true;

  return critical && d.emergencyAvailable;
}

function workload(d: DoctorSnapshot): number {
  return d.activeConsultations + d.queuedPatients;
}

/** Sort: best availability first, then lowest workload, then fewest active
 *  consultations, then name for a stable order. */
export function rankDoctors(doctors: DoctorSnapshot[]): DoctorSnapshot[] {
  return [...doctors].sort(
    (a, b) =>
      STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
      workload(a) - workload(b) ||
      a.activeConsultations - b.activeConsultations ||
      a.fullName.localeCompare(b.fullName)
  );
}

/**
 * Picks a doctor from live Supabase data. Never fabricates availability: when
 * nobody qualifies the result is `pendingAssignment` so staff are notified.
 */
export async function recommendDoctor(db: Db, params: {
  department: string;
  level: TriageLevel;
}): Promise<DoctorAssignmentResult> {
  const { department, level } = params;

  const inDepartment = await loadDoctorSnapshots(db, { department });
  let eligible = rankDoctors(inDepartment.filter((d) => isEligible(d, level)));
  const considered = [...inDepartment];

  // Critical cases may fall back to any emergency-available doctor.
  if (eligible.length === 0 && level <= 2) {
    const everyone = await loadDoctorSnapshots(db);
    const emergency = everyone.filter(
      (d) => d.emergencyAvailable && isEligible(d, level)
    );

    eligible = rankDoctors(emergency);

    for (const d of everyone) {
      if (!considered.some((c) => c.id === d.id) && d.emergencyAvailable) {
        considered.push(d);
      }
    }
  }

  const candidates = considered.map(toCandidate);

  if (eligible.length === 0) {
    return {
      doctor: null,
      candidates,
      pendingAssignment: true,
      reason:
        inDepartment.length === 0
          ? `No doctors are registered under ${department}. Patient placed in the pending assignment queue.`
          : `No ${department} doctor is currently available. Patient placed in the pending assignment queue.`,
    };
  }

  const chosen = eligible[0];

  return {
    doctor: toCandidate(chosen),
    candidates,
    pendingAssignment: false,
    reason: `${chosen.fullName} (${chosen.status}) has the best availability and lowest workload (${workload(chosen)} patient${workload(chosen) === 1 ? "" : "s"}) among ${eligible.length} eligible doctor${eligible.length === 1 ? "" : "s"}.`,
  };
}

/** Re-checks a specific doctor against live data. Used before any assignment
 *  is finalised or changed. */
export async function validateDoctorLive(
  db: Db,
  doctorId: string,
  level: TriageLevel
): Promise<{ ok: boolean; doctor: DoctorSnapshot | null; reason: string }> {
  const [doctor] = await loadDoctorSnapshots(db, { doctorId });

  if (!doctor) {
    return { ok: false, doctor: null, reason: "Doctor not found or inactive." };
  }

  if (!isEligible(doctor, level)) {
    return {
      ok: false,
      doctor,
      reason: `${doctor.fullName} is not currently eligible (${doctor.status}${doctor.acceptsPatients ? "" : ", not accepting patients"}${doctor.onDutyNow ? "" : ", outside duty hours"}).`,
    };
  }

  return { ok: true, doctor, reason: "Doctor is available." };
}
