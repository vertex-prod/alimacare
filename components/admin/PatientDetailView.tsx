"use client";

import { ArrowLeft, ArrowRightLeft, Save } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type ReactNode } from "react";

import { StatusActions } from "@/components/admin/StatusActions";
import { TransferDialog } from "@/components/admin/TransferDialog";
import {
  Badge,
  DepartmentBadge,
  PriorityBadge,
  PurposeBadge,
  StatusBadge,
} from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField, Input, Select } from "@/components/ui/form";
import { PageLoading } from "@/components/ui/Loading";
import { useToast } from "@/components/ui/Toast";
import { apiSend } from "@/lib/client-api";
import {
  displayPatientName,
  formatDate,
  formatDateTime,
  formatWait,
  waitMinutes,
} from "@/lib/format";
import {
  CIVIL_STATUS_LABELS,
  departmentLabel,
  GUARDIAN_RELATIONSHIP_LABELS,
  PAYMENT_TYPE_LABELS,
  PRIORITY_LANE_LABELS,
  RESPONDENT_ROLE_LABELS,
  ROOM_PREFERENCE_LABELS,
  STATUS_LABELS,
  VISIT_PURPOSE_LABELS,
} from "@/lib/labels";
import type { PatientDetailResponse, PatientRow, PriorityLane } from "@/lib/types";
import { useApi } from "@/lib/use-api";

function Field({ label, children }: { label: string; children: ReactNode }) {
  const empty = children === null || children === undefined || children === "";

  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-gray-800">{empty ? "—" : children}</dd>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card className="p-5">
      <CardHeader title={title} />
      <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">{children}</dl>
    </Card>
  );
}

function yesNo(value: boolean | null): string | null {
  if (value === null) return null;
  return value ? "Yes" : "No";
}

function QueueEditor({
  patient,
  onSaved,
}: {
  patient: PatientRow;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [doctor, setDoctor] = useState(patient.assigned_doctor ?? "");
  const [room, setRoom] = useState(patient.assigned_room ?? "");
  const [wait, setWait] = useState(
    patient.estimated_wait_minutes === null ? "" : String(patient.estimated_wait_minutes)
  );
  const [lane, setLane] = useState<PriorityLane>(patient.priority_lane);
  const [busy, setBusy] = useState(false);

  const dirty =
    doctor !== (patient.assigned_doctor ?? "") ||
    room !== (patient.assigned_room ?? "") ||
    wait !==
      (patient.estimated_wait_minutes === null
        ? ""
        : String(patient.estimated_wait_minutes)) ||
    lane !== patient.priority_lane;

  const save = async () => {
    setBusy(true);

    try {
      await apiSend(`/api/admin/patients/${patient.id}`, "PATCH", {
        assignedDoctor: doctor,
        assignedRoom: room,
        estimatedWaitMinutes: wait,
        priorityLane: lane,
      });
      toast.success("Queue details saved.");
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Assigned doctor">
          <Input value={doctor} onChange={(e) => setDoctor(e.target.value)} maxLength={120} />
        </FormField>
        <FormField label="Room / counter">
          <Input value={room} onChange={(e) => setRoom(e.target.value)} maxLength={60} />
        </FormField>
        <FormField label="Priority lane">
          <Select value={lane} onChange={(e) => setLane(e.target.value as PriorityLane)}>
            {(Object.keys(PRIORITY_LANE_LABELS) as PriorityLane[]).map((key) => (
              <option key={key} value={key}>
                {PRIORITY_LANE_LABELS[key]}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Manual wait estimate (min)" hint="Blank = 10 min per patient ahead.">
          <Input
            type="number"
            min={0}
            max={1440}
            value={wait}
            onChange={(e) => setWait(e.target.value)}
          />
        </FormField>
      </div>
      <Button onClick={save} disabled={!dirty || busy} size="sm">
        <Save className="h-4 w-4" />
        {busy ? "Saving…" : "Save queue details"}
      </Button>
    </div>
  );
}

export function PatientDetailView() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [transferOpen, setTransferOpen] = useState(false);
  const { data, error, loading, reload } = useApi<PatientDetailResponse>(
    id ? `/api/admin/patients/${id}` : null,
    { refreshMs: 5_000 }
  );

  const back = (
    <Link
      href="/admin/patients"
      className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800"
    >
      <ArrowLeft className="h-4 w-4" />
      Patient records
    </Link>
  );

  if (loading && !data) {
    return (
      <>
        {back}
        <PageLoading label="Loading patient…" />
      </>
    );
  }

  if (!data) {
    return (
      <>
        {back}
        <EmptyState
          title="Could not load this patient"
          description={error ?? "The record may have been removed."}
          action={<Button onClick={reload}>Try again</Button>}
        />
      </>
    );
  }

  const { patient, events } = data;
  const isEmergency = patient.visit_purpose === "emergency";

  return (
    <>
      {back}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-medical-blue">
            {patient.patient_id}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900">
            {displayPatientName(patient)}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={patient.status} />
            <PurposeBadge purpose={patient.visit_purpose} />
            <PriorityBadge lane={patient.priority_lane} />
            {patient.identity_unknown ? <Badge tone="danger">Identity unknown</Badge> : null}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Section title="Patient identity">
            <Field label="Full name">{patient.full_name}</Field>
            <Field label="Filled out by">{RESPONDENT_ROLE_LABELS[patient.respondent_role]}</Field>
            <Field label="Date of birth">{patient.dob ? formatDate(`${patient.dob}T12:00:00+08:00`) : null}</Field>
            <Field label="Age">{`${patient.age} years${!patient.dob && isEmergency ? " (approx.)" : ""}`}</Field>
            <Field label="Sex">{patient.sex}</Field>
            <Field label="Civil status">
              {patient.civil_status ? CIVIL_STATUS_LABELS[patient.civil_status] : null}
            </Field>
            <Field label="Mobile number">{patient.contact_number}</Field>
            <Field label="Home address">{patient.address}</Field>
          </Section>

          <Section title="Visit">
            <Field label="Visit purpose">{VISIT_PURPOSE_LABELS[patient.visit_purpose]}</Field>
            <Field label="Department">{departmentLabel(patient.department)}</Field>
            <div className="sm:col-span-2">
              <Field label={isEmergency ? "Symptoms / incident" : "Chief complaint"}>
                {patient.chief_complaint}
              </Field>
            </div>
            <Field label="Known allergies">{patient.allergies}</Field>
            {patient.visit_purpose === "diagnostic" ? (
              <Field label="Doctor's request slip">{yesNo(patient.has_request_slip)}</Field>
            ) : null}
          </Section>

          <Section title="Billing">
            <Field label="Payment type">{PAYMENT_TYPE_LABELS[patient.payment_type]}</Field>
            <Field label="HMO provider">{patient.hmo_provider}</Field>
            <Field label="HMO number">{patient.hmo_no}</Field>
            <Field label="PhilHealth PIN">{patient.philhealth_pin}</Field>
            {isEmergency ? (
              <>
                <Field label="Employer">{patient.employer_name}</Field>
                <Field label="Preferred room">
                  {patient.room_preference ? ROOM_PREFERENCE_LABELS[patient.room_preference] : null}
                </Field>
              </>
            ) : null}
          </Section>

          <Section title="Emergency contact">
            <Field label="Name">{patient.emergency_contact_name}</Field>
            <Field label="Relationship">{patient.emergency_contact_relationship}</Field>
            <Field label="Mobile number">{patient.emergency_contact_number}</Field>
          </Section>

          {patient.guardian_full_name || patient.respondent_role === "guardian" ? (
            <Section title={isEmergency ? "Guardian / informant" : "Guardian"}>
              <Field label="Full name">{patient.guardian_full_name}</Field>
              <Field label="Relationship">
                {patient.guardian_relationship
                  ? GUARDIAN_RELATIONSHIP_LABELS[patient.guardian_relationship]
                  : null}
              </Field>
              <Field label="Mobile number">{patient.guardian_contact_number}</Field>
              <Field label="Valid ID type">{patient.guardian_id_type}</Field>
            </Section>
          ) : null}

          <Card className="p-5">
            <CardHeader title="Consent & signature" />
            <div className="mt-4 flex flex-wrap items-start gap-6">
              <Field label="Privacy consent">{patient.consent_given ? "Given" : "Not given"}</Field>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  Signature
                </p>
                {patient.signature_data?.startsWith("data:image/png;base64,") ? (
                  // eslint-disable-next-line @next/next/no-img-element -- data URL from the intake form
                  <img
                    src={patient.signature_data}
                    alt={`Signature for ${patient.full_name}`}
                    className="mt-2 h-28 max-w-full rounded-lg border border-gray-200 bg-white object-contain p-2"
                  />
                ) : (
                  <p className="mt-0.5 text-sm text-gray-500">No signature on file.</p>
                )}
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <CardHeader title="Queue" />
            <div className="mt-4 rounded-xl bg-gray-50 p-4 text-center">
              <p className="font-mono text-3xl font-bold text-gray-900">
                {patient.queue_number ?? "—"}
              </p>
              <div className="mt-1 flex items-center justify-center gap-2 text-xs text-gray-500">
                <DepartmentBadge code={patient.department} />
                {patient.queue_date ? formatDate(`${patient.queue_date}T12:00:00+08:00`) : null}
              </div>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3">
              <Field label="Registered">{formatDateTime(patient.registration_datetime)}</Field>
              <Field label="Called">{patient.called_time ? formatDateTime(patient.called_time) : null}</Field>
              <Field label="Started">
                {patient.consultation_start_time ? formatDateTime(patient.consultation_start_time) : null}
              </Field>
              <Field label="Completed">
                {patient.completed_time ? formatDateTime(patient.completed_time) : null}
              </Field>
              <Field label="Waited">
                {formatWait(
                  waitMinutes(
                    patient.registration_datetime,
                    patient.called_time ?? patient.completed_time ?? undefined
                  )
                )}
              </Field>
            </dl>

            <div className="mt-5 border-t border-gray-100 pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Change status
              </p>
              <StatusActions patient={patient} onChanged={reload} />
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => setTransferOpen(true)}
              >
                <ArrowRightLeft className="h-4 w-4" />
                Transfer department
              </Button>
            </div>

            <div className="mt-5 border-t border-gray-100 pt-4">
              <QueueEditor
                key={patient.updated_at}
                patient={patient}
                onSaved={reload}
              />
            </div>
          </Card>

          <Card className="p-5">
            <CardHeader title="Status history" description="From queue_events, newest first." />
            {events.length ? (
              <ol className="mt-4 space-y-4 border-l border-gray-200 pl-4">
                {events.map((event) => (
                  <li key={event.id} className="relative">
                    <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-medical-blue" />
                    <p className="text-sm font-medium text-gray-800">
                      {STATUS_LABELS[event.status]}
                      {event.queue_number ? (
                        <span className="ml-1.5 font-mono text-xs text-gray-400">
                          {event.queue_number}
                        </span>
                      ) : null}
                    </p>
                    {event.notes ? <p className="text-sm text-gray-600">{event.notes}</p> : null}
                    <p className="text-xs text-gray-400">
                      {formatDateTime(event.created_at)}
                      {event.performed_by ? ` · ${event.performed_by}` : ""}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 text-sm text-gray-500">No history recorded.</p>
            )}
          </Card>
        </div>
      </div>

      <TransferDialog
        key={`${patient.id}-${patient.department}`}
        patient={patient}
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        onTransferred={reload}
      />
    </>
  );
}
