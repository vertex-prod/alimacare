"use client";

import { useState } from "react";
import type { AssessmentView } from "@/lib/db/AssessmentRepository";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  AssessmentSummary,
  doctorDecisionLabel,
  doctorDecisionTone,
  type AuditEntry,
} from "@/components/assessment/AssessmentSummary";

interface DoctorReviewPanelProps {
  assessment: AssessmentView;
  audit: AuditEntry[];
  busy: boolean;
  error: string | null;
  onAccept: () => Promise<boolean>;
  onDecline: (note: string) => Promise<boolean>;
}

export function DoctorReviewPanel({
  assessment: a,
  audit,
  busy,
  error,
  onAccept,
  onDecline,
}: DoctorReviewPanelProps) {
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);

  const decision = a.validation.doctorDecision;
  const needsReview = decision === "PENDING";

  async function submitDecline() {
    if (!note.trim()) {
      setNoteError("A reason is required so reception can reassign safely.");
      return;
    }

    setNoteError(null);

    if (await onDecline(note.trim())) {
      setDeclining(false);
      setNote("");
    }
  }

  return (
    <AssessmentSummary assessment={a} audit={audit}>
      {error && (
        <p role="alert" className="rounded-lg bg-red-light px-3 py-2 text-sm text-red-dark">
          {error}
        </p>
      )}

      {needsReview ? (
        <div className="rounded-xl border border-orange-light bg-orange-light/40 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Reception assigned this patient to you</h3>
              <p className="mt-1 text-sm text-gray-600">
                Review the intake and AI assessment, then accept the case or decline it with a reason.
              </p>
            </div>
            <Badge tone={doctorDecisionTone(decision)} dot>
              {doctorDecisionLabel(decision)}
            </Badge>
          </div>

          {!declining ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="success" disabled={busy} onClick={() => void onAccept()}>
                Accept patient
              </Button>
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => {
                  setDeclining(true);
                  setNoteError(null);
                }}
              >
                Decline assignment
              </Button>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Reason for declining
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={500}
                  rows={3}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="e.g. Outside my specialty; please reassign to Cardiology."
                />
              </label>
              <p className="text-xs text-gray-500">
                The patient stays active and returns to reception for reassignment. No visit is cancelled.
              </p>
              {noteError && (
                <p role="alert" className="text-sm text-red-dark">
                  {noteError}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="danger" disabled={busy || !note.trim()} onClick={() => void submitDecline()}>
                  {busy ? "Declining…" : "Confirm decline"}
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    setDeclining(false);
                    setNote("");
                    setNoteError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : decision === "ACCEPTED" ? (
        <div className="rounded-xl border border-soft-green-light bg-soft-green-light/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-soft-green-dark">You accepted this patient</h3>
              <p className="mt-1 text-sm text-gray-600">
                They are now in your waiting queue. Reception can see that the assignment was accepted.
              </p>
            </div>
            <Badge tone="success" dot>
              {doctorDecisionLabel(decision)}
            </Badge>
          </div>
          {a.validation.doctorDecisionAt && (
            <p className="mt-2 text-xs text-gray-500">
              Accepted {new Date(a.validation.doctorDecisionAt).toLocaleString()}
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-red-light bg-red-light/40 p-4">
          <h3 className="text-sm font-semibold text-red-dark">Assignment declined</h3>
          {a.validation.doctorDecisionNote && (
            <p className="mt-1 text-sm text-gray-600">Reason: {a.validation.doctorDecisionNote}</p>
          )}
          <p className="mt-1 text-sm text-gray-600">
            Reception will reassign this patient to another doctor.
          </p>
        </div>
      )}
    </AssessmentSummary>
  );
}
