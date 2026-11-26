import type { PaymentType, PriorityLane, VisitPurpose } from "./types";

export const VISIT_PURPOSE_LABELS: Record<VisitPurpose, string> = {
  consultation: "Check-up / Consultation",
  diagnostic: "Diagnostic Assessment",
  emergency: "Emergency / Admission",
};

export const PRIORITY_LANE_LABELS: Record<PriorityLane, string> = {
  regular: "Regular",
  senior_citizen: "Senior Citizen",
  pwd: "PWD",
  pregnant: "Pregnant",
};

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  cash: "Cash",
  hmo: "HMO",
  philhealth: "PhilHealth",
};

export const DEPARTMENT_LABELS: Record<string, string> = {
  OPD: "Outpatient Department (OPD)",
  LAB: "Laboratory & Diagnostics (LAB)",
  ER: "Emergency Room (ER)",
};

export function departmentLabel(code: string | undefined): string {
  if (!code) return "Queueing department";
  return DEPARTMENT_LABELS[code] ?? code;
}
