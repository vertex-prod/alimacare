"use client";

import { ArrowRightLeft, Clock3, RefreshCw, User } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { StatusActions } from "@/components/admin/StatusActions";
import { TransferDialog } from "@/components/admin/TransferDialog";
import {
  DepartmentBadge,
  PriorityBadge,
  PurposeBadge,
  StatusBadge,
} from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageLoading } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  cn,
  displayPatientName,
  formatDate,
  formatTime,
  formatWait,
  waitMinutes,
} from "@/lib/format";
import { DEFAULT_DEPARTMENTS, departmentLabel } from "@/lib/labels";
import type { AppointmentStatus, PatientListItem, QueueResponse } from "@/lib/types";
import { useApi } from "@/lib/use-api";

const LANES: { key: string; title: string; statuses: AppointmentStatus[]; hint: string }[] =
  [
    {
      key: "pending",
      title: "Pending reception",
      statuses: ["PENDING_RECEPTION"],
      hint: "New QR intakes to review and approve.",
    },
    {
      key: "waiting",
      title: "Waiting",
      statuses: ["APPROVED", "WAITING"],
      hint: "Approved and waiting to be called.",
    },
    {
      key: "serving",
      title: "Now serving",
      statuses: ["CALLED", "ONGOING"],
      hint: "Called to the counter or in consultation.",
    },
  ];

/** Emergency first, then priority lanes, then first come first served. */
function queueOrder(a: PatientListItem, b: PatientListItem): number {
  const rank = (patient: PatientListItem) =>
    patient.visit_purpose === "emergency" ? 0 : patient.priority_lane !== "regular" ? 1 : 2;

  return (
    rank(a) - rank(b) ||
    new Date(a.registration_datetime).getTime() -
      new Date(b.registration_datetime).getTime()
  );
}

function QueueCard({
  patient,
  onChanged,
  onTransfer,
}: {
  patient: PatientListItem;
  onChanged: () => void;
  onTransfer: (patient: PatientListItem) => void;
}) {
  const waited = waitMinutes(patient.registration_datetime);
  const urgent = patient.visit_purpose === "emergency";

  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-3 shadow-sm",
        urgent ? "border-red/40 ring-1 ring-red/20" : "border-gray-200"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg font-bold text-gray-900">
              {patient.queue_number ?? "—"}
            </span>
            <DepartmentBadge code={patient.department} />
          </div>
          <Link
            href={`/admin/patients/${patient.id}`}
            className="mt-0.5 block truncate text-sm font-medium text-gray-800 hover:text-medical-blue"
          >
            {displayPatientName(patient)}
          </Link>
          <p className="text-xs text-gray-400">
            {patient.age} yrs · {patient.sex}
          </p>
        </div>
        <StatusBadge status={patient.status} />
      </div>

      <p className="mt-2 line-clamp-2 text-xs text-gray-600">{patient.chief_complaint}</p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <PurposeBadge purpose={patient.visit_purpose} />
        {patient.priority_lane !== "regular" ? (
          <PriorityBadge lane={patient.priority_lane} />
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1">
          <Clock3 className="h-3.5 w-3.5" />
          {formatTime(patient.registration_datetime)} · {formatWait(waited)}
        </span>
        {patient.assigned_doctor || patient.assigned_room ? (
          <span className="inline-flex items-center gap-1">
            <User className="h-3.5 w-3.5" />
            {[patient.assigned_doctor, patient.assigned_room].filter(Boolean).join(" · ")}
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-gray-100 pt-3">
        <StatusActions patient={patient} onChanged={onChanged} compact />
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onTransfer(patient)}
          title="Transfer to another department"
        >
          <ArrowRightLeft className="h-3.5 w-3.5" />
          Transfer
        </Button>
      </div>
    </div>
  );
}

export function QueueView() {
  const [department, setDepartment] = useState<string>("ALL");
  const [transferring, setTransferring] = useState<PatientListItem | null>(null);
  const { data, error, loading, reload } = useApi<QueueResponse>("/api/admin/queue", {
    refreshMs: 5_000,
  });

  const departments = useMemo(() => {
    const codes = new Set<string>(DEFAULT_DEPARTMENTS);
    for (const patient of data?.patients ?? []) codes.add(patient.department);
    return Array.from(codes);
  }, [data]);

  const visible = useMemo(
    () =>
      (data?.patients ?? [])
        .filter((patient) => department === "ALL" || patient.department === department)
        .sort(queueOrder),
    [data, department]
  );

  const header = (
    <PageHeader
      eyebrow="Operations"
      title="Live queue"
      description={
        data
          ? `Active tickets for ${formatDate(`${data.date}T12:00:00+08:00`)}. Refreshes every 10 seconds.`
          : "Active tickets for today."
      }
      actions={
        <Button variant="secondary" onClick={reload}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      }
    />
  );

  if (loading && !data) {
    return (
      <>
        {header}
        <PageLoading label="Loading the queue…" />
      </>
    );
  }

  if (!data) {
    return (
      <>
        {header}
        <EmptyState
          title="Could not load the queue"
          description={error ?? "Please try again."}
          action={<Button onClick={reload}>Try again</Button>}
        />
      </>
    );
  }

  return (
    <>
      {header}

      {error ? (
        <p className="mb-4 rounded-lg bg-orange-light px-3 py-2 text-sm text-orange-dark">
          Showing the last loaded queue: {error}
        </p>
      ) : null}

      <div className="mb-5 flex flex-wrap gap-2">
        {["ALL", ...departments].map((code) => {
          const count =
            code === "ALL"
              ? data.patients.length
              : data.patients.filter((patient) => patient.department === code).length;

          return (
            <button
              key={code}
              type="button"
              onClick={() => setDepartment(code)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                department === code
                  ? "border-medical-blue bg-medical-blue text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              )}
              title={code === "ALL" ? "All departments" : departmentLabel(code)}
            >
              {code === "ALL" ? "All" : code}{" "}
              <span className="ml-1 opacity-75">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {LANES.map((lane) => {
          const patients = visible.filter((patient) =>
            lane.statuses.includes(patient.status)
          );

          return (
            <section key={lane.key} className="rounded-2xl bg-gray-100/70 p-3">
              <div className="mb-3 flex items-baseline justify-between px-1">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">{lane.title}</h2>
                  <p className="text-xs text-gray-500">{lane.hint}</p>
                </div>
                <span className="text-lg font-bold text-gray-700">{patients.length}</span>
              </div>
              <div className="space-y-3">
                {patients.length ? (
                  patients.map((patient) => (
                    <QueueCard
                      key={patient.id}
                      patient={patient}
                      onChanged={reload}
                      onTransfer={setTransferring}
                    />
                  ))
                ) : (
                  <p className="rounded-xl border border-dashed border-gray-300 px-3 py-8 text-center text-sm text-gray-400">
                    No patients
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {transferring ? (
        <TransferDialog
          key={transferring.id}
          patient={transferring}
          open
          onClose={() => setTransferring(null)}
          onTransferred={reload}
        />
      ) : null}
    </>
  );
}
