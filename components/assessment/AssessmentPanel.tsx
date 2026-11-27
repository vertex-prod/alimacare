"use client";

import { useState } from "react";
import type { AssessmentView } from "@/lib/db/AssessmentRepository";
import { DEPARTMENTS } from "@/lib/ai/types";
import { Button } from "@/components/ui/Button";
import {
  AssessmentSummary,
  LEVEL_LABELS,
  type AuditEntry,
  type DoctorOption,
} from "./AssessmentSummary";

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
    <AssessmentSummary assessment={a} audit={audit}>
      {error && (
        <p role="alert" className="rounded-lg bg-red-light px-3 py-2 text-sm text-red-dark">
          {error}
        </p>
      )}

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
                {a.effective.doctorId ? "Reassign doctor" : "Assign doctor"}
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
                {a.effective.doctorId ? "Reassign doctor" : "Assign doctor"}
              </Button>
            </div>
            {a.validation.doctorDecision !== "PENDING" && (
              <p className="text-xs text-gray-500">
                Choosing a different doctor resets the acceptance to “Awaiting doctor”.
              </p>
            )}
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
          Changing the classification, department or doctor is limited to reception and admin staff.
        </p>
      )}
    </AssessmentSummary>
  );
}
