"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { FormField, Input, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { apiSend } from "@/lib/client-api";
import {
  STATUS_ACTION_LABELS,
  STATUS_LABELS,
  STATUS_TRANSITIONS,
} from "@/lib/labels";
import type { AppointmentStatus, PatientListItem, PatientRow } from "@/lib/types";

type Target = Pick<
  PatientListItem,
  "id" | "full_name" | "status" | "queue_number" | "assigned_doctor" | "assigned_room"
>;

const DESTRUCTIVE: AppointmentStatus[] = ["CANCELLED", "NO_SHOW", "ARCHIVED"];

/** Statuses shown as the main button for each current status. */
const PRIMARY_NEXT: Partial<Record<AppointmentStatus, AppointmentStatus>> = {
  PENDING_RECEPTION: "APPROVED",
  APPROVED: "CALLED",
  WAITING: "CALLED",
  CALLED: "ONGOING",
  ONGOING: "COMPLETED",
};

function variantFor(status: AppointmentStatus, primary: boolean) {
  if (DESTRUCTIVE.includes(status)) return "secondary" as const;
  if (status === "COMPLETED") return "success" as const;
  return primary ? ("primary" as const) : ("secondary" as const);
}

export function StatusActions({
  patient,
  onChanged,
  size = "sm",
  compact = false,
}: {
  patient: Target;
  onChanged: (patient: PatientRow) => void;
  size?: "sm" | "md";
  /** Show only the main next step plus cancel/no-show. */
  compact?: boolean;
}) {
  const toast = useToast();
  const [pending, setPending] = useState<AppointmentStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState("");
  const [doctor, setDoctor] = useState("");
  const [room, setRoom] = useState("");

  const allowed = STATUS_TRANSITIONS[patient.status];
  const primary = PRIMARY_NEXT[patient.status];
  const actions = compact
    ? allowed.filter(
        (status) => status === primary || status === "NO_SHOW" || status === "CANCELLED"
      )
    : allowed;

  const open = (status: AppointmentStatus) => {
    setNotes("");
    setDoctor(patient.assigned_doctor ?? "");
    setRoom(patient.assigned_room ?? "");
    setPending(status);
  };

  const submit = async () => {
    if (!pending) return;

    setBusy(true);

    try {
      const body: Record<string, unknown> = { status: pending, notes };

      if (pending === "APPROVED" || pending === "CALLED") {
        body.assignedDoctor = doctor;
        body.assignedRoom = room;
      }

      const result = await apiSend<{ patient: PatientRow }>(
        `/api/admin/patients/${patient.id}/status`,
        "POST",
        body
      );

      toast.success(
        `${patient.queue_number ?? patient.full_name}: ${STATUS_LABELS[pending]}.`
      );
      setPending(null);
      onChanged(result.patient);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update status.");
    } finally {
      setBusy(false);
    }
  };

  if (!actions.length) return null;

  const needsAssignment = pending === "APPROVED" || pending === "CALLED";

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {actions.map((status) => (
          <Button
            key={status}
            size={size}
            variant={variantFor(status, status === primary)}
            onClick={() => open(status)}
            className={DESTRUCTIVE.includes(status) ? "text-red-dark" : undefined}
          >
            {STATUS_ACTION_LABELS[status] ?? STATUS_LABELS[status]}
          </Button>
        ))}
      </div>

      <Modal
        open={pending !== null}
        onClose={() => (busy ? undefined : setPending(null))}
        title={
          pending
            ? `${STATUS_ACTION_LABELS[pending] ?? STATUS_LABELS[pending]} — ${
                patient.queue_number ?? ""
              }`
            : ""
        }
        description={`${patient.full_name} · ${STATUS_LABELS[patient.status]} → ${
          pending ? STATUS_LABELS[pending] : ""
        }`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPending(null)} disabled={busy}>
              Back
            </Button>
            <Button
              variant={pending && DESTRUCTIVE.includes(pending) ? "danger" : "primary"}
              onClick={submit}
              disabled={busy}
            >
              {busy ? "Saving…" : "Confirm"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {needsAssignment ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Assigned doctor">
                <Input
                  value={doctor}
                  onChange={(event) => setDoctor(event.target.value)}
                  maxLength={120}
                  placeholder="Dr. Santos"
                />
              </FormField>
              <FormField label="Room / counter">
                <Input
                  value={room}
                  onChange={(event) => setRoom(event.target.value)}
                  maxLength={60}
                  placeholder="Room 3"
                />
              </FormField>
            </div>
          ) : null}
          <FormField label="Note (optional)" hint="Saved in the patient's status history.">
            <Textarea
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={300}
            />
          </FormField>
        </div>
      </Modal>
    </>
  );
}
