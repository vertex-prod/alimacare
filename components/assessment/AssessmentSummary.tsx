"use client";

import type { ReactNode } from "react";
import type { AssessmentView, DoctorDecision } from "@/lib/db/AssessmentRepository";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";

export interface AuditEntry {
  id: number;
  staff_name: string;
  action: string;
  field: string | null;
  original_value: unknown;
  new_value: unknown;
  note: string | null;
  created_at: string;
}

export interface DoctorOption {
  id: string;
  fullName: string;
  specialty: string;
  department: string;
  status: string;
  activeConsultations: number;
  queuedPatients: number;
  onDutyNow: boolean;
  acceptsPatients: boolean;
}

export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "muted";

export function levelTone(level: number): Tone {
  if (level <= 2) return "danger";
  if (level === 3) return "warning";
  if (level === 4) return "info";

  return "success";
}

export function validationTone(status: string): Tone {
  if (status === "APPROVED") return "success";
  if (status === "OVERRIDDEN") return "info";
  if (status === "FLAGGED") return "warning";

  return "muted";
}

export function doctorDecisionTone(decision: DoctorDecision): Tone {
  if (decision === "ACCEPTED") return "success";
  if (decision === "REJECTED") return "danger";

  return "warning";
}

export function doctorDecisionLabel(decision: DoctorDecision): string {
  if (decision === "ACCEPTED") return "Doctor accepted";
  if (decision === "REJECTED") return "Declined – needs reassignment";

  return "Awaiting doctor";
}

export const LEVEL_LABELS = [
  "",
  "LEVEL 1 – CRITICAL",
  "LEVEL 2 – EMERGENCY",
  "LEVEL 3 – URGENT",
  "LEVEL 4 – LESS URGENT",
  "LEVEL 5 – NON-URGENT",
];

function List({ items, empty = "None reported" }: { items: string[]; empty?: string }) {
  if (items.length === 0) return <span className="text-gray-400">{empty}</span>;

  return (
    <ul className="list-disc space-y-0.5 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-2 text-sm sm:grid-cols-[170px_1fr]">
      <dt className="font-medium text-gray-500">{label}</dt>
      <dd className="text-gray-900">{children}</dd>
    </div>
  );
}

function fmt(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;

  return JSON.stringify(value);
}

export function AssessmentStatusBadges({ assessment: a }: { assessment: AssessmentView }) {
  const hasAssignment = a.validation.finalDoctorId !== null;

  return (
    <div className="flex flex-col items-end gap-1">
      <Badge tone={levelTone(a.effective.level)} dot>
        {a.effective.label}
      </Badge>
      <div className="flex flex-wrap items-center justify-end gap-1">
        <Badge tone={validationTone(a.validation.status)}>{a.validation.status}</Badge>
        {hasAssignment && (
          <Badge tone={doctorDecisionTone(a.validation.doctorDecision)} dot>
            {doctorDecisionLabel(a.validation.doctorDecision)}
          </Badge>
        )}
      </div>
    </div>
  );
}

export function AuditHistory({
  audit,
  title = "Audit history",
}: {
  audit: AuditEntry[];
  title?: string;
}) {
  return (
    <div className="mt-6 border-t border-gray-200 pt-4">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {audit.length === 0 ? (
        <p className="mt-2 text-sm text-gray-400">No staff changes recorded.</p>
      ) : (
        <ul className="mt-2 space-y-2 text-sm">
          {audit.map((entry) => (
            <li key={entry.id} className="rounded-lg bg-gray-50 px-3 py-2">
              <span className="font-medium">{entry.action}</span> by {entry.staff_name} ·{" "}
              {new Date(entry.created_at).toLocaleString()}
              {(entry.original_value !== null || entry.new_value !== null) && (
                <span className="block text-gray-600">
                  {fmt(entry.original_value)} → {fmt(entry.new_value)}
                </span>
              )}
              {entry.note && <span className="block text-gray-500">“{entry.note}”</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface AssessmentSummaryProps {
  assessment: AssessmentView;
  audit: AuditEntry[];
  action?: ReactNode;
  children?: ReactNode;
}

/**
 * Shared, read-only assessment view used by both the reception/admin panel and
 * the doctor review panel. Interactive controls are supplied via `children` so
 * each role keeps only its own actions.
 */
export function AssessmentSummary({
  assessment: a,
  audit,
  action,
  children,
}: AssessmentSummaryProps) {
  const level = a.effective.level;
  const decision = a.validation.doctorDecision;
  const decisionByName = a.validation.finalDoctorName ?? "the assigned doctor";

  return (
    <Card className="p-5">
      <CardHeader
        title={`${a.patient.fullName} · ${a.patient.patientId}`}
        description={`${a.patient.age} y/o ${a.patient.sex} · ${a.patient.visitPurpose} · Queue ${a.patient.queueNumber ?? "—"} · ${a.patient.patientStatus}`}
        action={action ?? <AssessmentStatusBadges assessment={a} />}
      />

      <p className="mt-3 rounded-lg bg-orange-light px-3 py-2 text-xs text-orange-dark">
        AI-generated preliminary assessment, not a diagnosis. Requires validation by a qualified healthcare professional.
      </p>

      {level <= 2 && a.validation.status === "PENDING" && (
        <p role="alert" className="mt-3 rounded-lg bg-red px-3 py-2 text-sm font-semibold text-white">
          {level === 1 ? "CRITICAL" : "EMERGENCY"} – immediate staff assessment required. Do not wait for AI processing or the ordinary queue.
        </p>
      )}

      {a.status === "failed" && (
        <p className="mt-3 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-700">
          The AI analysis was unavailable for this patient. The level shown comes from safety rules or a provisional default and needs staff assessment.
          {a.error ? ` (${a.error})` : ""}
        </p>
      )}

      <dl className="mt-4 divide-y divide-gray-100">
        <Row label="Patient said">{a.patient.chiefComplaint}</Row>
        <Row label="Duration / severity">
          {a.patient.symptomDuration ?? "Not provided"} · {a.patient.symptomSeverity ? `${a.patient.symptomSeverity}/10` : "severity not provided"}
        </Row>
        <Row label="History / conditions">
          {[a.patient.medicalHistory, a.patient.existingConditions].filter(Boolean).join("; ") || "Not provided"}
        </Row>
        <Row label="Medications / allergies">
          {[a.patient.currentMedications, a.patient.allergies && `Allergies: ${a.patient.allergies}`]
            .filter(Boolean)
            .join("; ") || "Not provided"}
        </Row>
        <Row label="Primary symptoms"><List items={a.primarySymptoms} /></Row>
        <Row label="Secondary symptoms"><List items={a.secondarySymptoms} /></Row>
        <Row label="Relevant history"><List items={a.relevantHistory} /></Row>
        <Row label="Potential concerns"><List items={a.potentialConcerns} /></Row>
        <Row label="Warning signs"><List items={a.warningSigns} /></Row>
        <Row label="Recommended action">{a.recommendedAction ?? "—"}</Row>
        <Row label="AI confidence">{a.confidence ?? "n/a"}</Row>
        <Row label="Missing information"><List items={a.missingInformation} empty="None" /></Row>
        <Row label="Classification">
          {LEVEL_LABELS[level]}
          {a.validation.finalLevel !== null && a.validation.finalLevel !== a.aiLevel && (
            <span className="text-gray-500"> (system proposed {LEVEL_LABELS[a.aiLevel]})</span>
          )}
        </Row>
        <Row label="Why">{a.classificationReason}</Row>
        <Row label="Department">
          {a.effective.department ?? "—"}
          {a.departmentReason && <span className="block text-gray-500">{a.departmentReason}</span>}
        </Row>
        <Row label="Doctor">
          {a.validation.doctorDecision === "REJECTED" ? (
            <span className="font-semibold text-red-dark">
              Declined by {decisionByName} – awaiting reassignment
            </span>
          ) : a.effective.doctorName ? (
            a.effective.doctorName
          ) : (
            <span className="font-semibold text-red-dark">Pending assignment – no eligible doctor</span>
          )}
          {a.validation.finalDoctorId === null && a.recommendedDoctor && (
            <span className="block text-gray-500">Recommended, not yet validated by staff</span>
          )}
        </Row>
        <Row label="Doctor response">
          {decision === "PENDING" ? (
            a.validation.finalDoctorId ? (
              <span className="font-medium text-orange-dark">Awaiting doctor review</span>
            ) : (
              "—"
            )
          ) : (
            <>
              <Badge tone={doctorDecisionTone(decision)}>{doctorDecisionLabel(decision)}</Badge>
              {decision === "REJECTED" && a.validation.doctorDecisionNote && (
                <span className="mt-1 block text-gray-600">
                  Reason: {a.validation.doctorDecisionNote}
                </span>
              )}
              {a.validation.doctorDecisionAt && (
                <span className="mt-1 block text-gray-500">
                  {new Date(a.validation.doctorDecisionAt).toLocaleString()}
                </span>
              )}
            </>
          )}
        </Row>
        <Row label="Assessed at">{new Date(a.createdAt).toLocaleString()} (v{a.version})</Row>
        <Row label="Staff validation">
          {a.validation.status}
          {a.validation.validatedByName && ` by ${a.validation.validatedByName}`}
          {a.validation.validatedAt && ` · ${new Date(a.validation.validatedAt).toLocaleString()}`}
        </Row>
      </dl>

      {children && (
        <div className="mt-5 space-y-5 border-t border-gray-200 pt-5">{children}</div>
      )}

      <AuditHistory audit={audit} />
    </Card>
  );
}
