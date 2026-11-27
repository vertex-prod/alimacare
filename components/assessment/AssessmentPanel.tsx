"use client";

import { useState } from "react";
import type { AssessmentView } from "@/lib/db/AssessmentRepository";
import { DEPARTMENTS } from "@/lib/ai/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
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

type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "muted";

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

const LEVEL_LABELS = [
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
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

interface PanelProps {
  assessment: AssessmentView;
  audit: AuditEntry[];
  role: "ADMIN" | "RECEPTION" | "DOCTOR";
  doctors: DoctorOption[];
  busy: boolean;
  error: string | null;
  onAction: (path: string, body: Record<string, unknown>) => Promise<boolean>;
}

export function AssessmentPanel({ assessment: a, audit, role, doctors, busy, error, onAction }: PanelProps) {
  const [newLevel, setNewLevel] = useState("");
  const [classNote, setClassNote] = useState("");
  const [department, setDepartment] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [override, setOverride] = useState(false);
  const [doctorNote, setDoctorNote] = useState("");
  const [flagNote, setFlagNote] = useState("");

  const canEditDecision = role === "ADMIN" || role === "RECEPTION";
  const level = a.effective.level;
  const departmentDoctors = doctors.filter(
    (d) => d.department === (a.effective.department ?? "")
  );
  const otherDoctors = doctors.filter((d) => d.department !== (a.effective.department ?? ""));

  return (
    <Card className="p-5">
      <CardHeader
        title={`${a.patient.fullName} · ${a.patient.patientId}`}
        description={`${a.patient.age} y/o ${a.patient.sex} · ${a.patient.visitPurpose} · Queue ${a.patient.queueNumber ?? "—"} · ${a.patient.patientStatus}`}
        action={
          <div className="flex flex-col items-end gap-1">
            <Badge tone={levelTone(level)} dot>
              {a.effective.label}
            </Badge>
            <Badge tone={validationTone(a.validation.status)}>{a.validation.status}</Badge>
          </div>
        }
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
          {a.effective.doctorName ?? (
            <span className="font-semibold text-red-dark">Pending assignment – no eligible doctor</span>
          )}
          {a.validation.finalDoctorId === null && a.recommendedDoctor && (
            <span className="block text-gray-500">Recommended, not yet validated by staff</span>
          )}
        </Row>
        <Row label="Assessed at">{new Date(a.createdAt).toLocaleString()} (v{a.version})</Row>
        <Row label="Staff validation">
          {a.validation.status}
          {a.validation.validatedByName && ` by ${a.validation.validatedByName}`}
          {a.validation.validatedAt && ` · ${new Date(a.validation.validatedAt).toLocaleString()}`}
        </Row>
      </dl>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-light px-3 py-2 text-sm text-red-dark">
          {error}
        </p>
      )}

      <div className="mt-5 space-y-5 border-t border-gray-200 pt-5">
        <div className="flex flex-wrap gap-2">
          <Button variant="success" disabled={busy} onClick={() => onAction(`${a.id}/approve`, {})}>
            Approve AI assessment
          </Button>
          <Button
            variant="danger"
            disabled={busy || level === 1}
            onClick={() => onAction(`${a.id}/escalate`, {})}
          >
            Escalate patient priority
          </Button>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm text-gray-700">
            Flag for review (reason)
            <input
              value={flagNote}
              onChange={(e) => setFlagNote(e.target.value)}
              maxLength={500}
              className="mt-1 block w-72 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            />
          </label>
          <Button
            variant="secondary"
            disabled={busy || !flagNote.trim()}
            onClick={async () => {
              if (await onAction(`${a.id}/flag`, { note: flagNote })) setFlagNote("");
            }}
          >
            Flag AI assessment for review
          </Button>
        </div>

        {canEditDecision ? (
          <>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-sm text-gray-700">
                Change classification
                <select
                  value={newLevel}
                  onChange={(e) => setNewLevel(e.target.value)}
                  className="mt-1 block rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                >
                  <option value="">Select level…</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {LEVEL_LABELS[n]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-gray-700">
                Reason {Number(newLevel) > level ? "(required to lower)" : "(optional)"}
                <input
                  value={classNote}
                  onChange={(e) => setClassNote(e.target.value)}
                  maxLength={500}
                  className="mt-1 block w-64 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                />
              </label>
              <Button
                variant="secondary"
                disabled={busy || !newLevel}
                onClick={async () => {
                  if (await onAction(`${a.id}/classification`, { level: Number(newLevel), note: classNote })) {
                    setNewLevel("");
                    setClassNote("");
                  }
                }}
              >
                Change medical classification
              </Button>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <label className="text-sm text-gray-700">
                Change recommended department
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="mt-1 block rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                >
                  <option value="">Select department…</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                variant="secondary"
                disabled={busy || !department}
                onClick={async () => {
                  if (await onAction(`${a.id}/department`, { department })) setDepartment("");
                }}
              >
                Change department
              </Button>
              <span className="text-xs text-gray-500">The doctor is re-picked from live availability.</span>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-sm text-gray-700">
                  Reassign doctor
                  <select
                    value={doctorId}
                    onChange={(e) => setDoctorId(e.target.value)}
                    className="mt-1 block max-w-sm rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                  >
                    <option value="">Select doctor…</option>
                    <optgroup label={a.effective.department ?? "Department"}>
                      {departmentDoctors.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.fullName} · {d.status} · {d.activeConsultations + d.queuedPatients} patient(s)
                          {d.onDutyNow ? "" : " · off schedule"}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Other departments">
                      {otherDoctors.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.fullName} ({d.department}) · {d.status}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </label>
                <label className="text-sm text-gray-700">
                  Note
                  <input
                    value={doctorNote}
                    onChange={(e) => setDoctorNote(e.target.value)}
                    maxLength={500}
                    className="mt-1 block w-56 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                  />
                </label>
                <Button
                  variant="secondary"
                  disabled={busy || !doctorId || (override && !doctorNote.trim())}
                  onClick={async () => {
                    if (await onAction(`${a.id}/doctor`, { doctorId, override, note: doctorNote })) {
                      setDoctorId("");
                      setDoctorNote("");
                      setOverride(false);
                    }
                  }}
                >
                  Reassign doctor
                </Button>
              </div>
              {level <= 2 && (
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
                  Emergency override: assign even if the doctor is not ordinarily eligible (a reason is required)
                </label>
              )}
            </div>
          </>
        ) : (
          <p className="text-xs text-gray-500">
            Changing the classification, department or doctor is limited to reception and admin staff. You can approve, escalate or flag this assessment.
          </p>
        )}
      </div>

      <div className="mt-6 border-t border-gray-200 pt-4">
        <h3 className="text-sm font-semibold text-gray-900">Audit history</h3>
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
    </Card>
  );
}
