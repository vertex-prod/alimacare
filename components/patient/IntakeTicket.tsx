"use client";

import { useEffect, useSyncExternalStore, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Hash,
  Hourglass,
  MapPin,
  Printer,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/Badge";
import { TicketQr } from "@/components/patient/TicketQr";
import {
  departmentLabel,
  PAYMENT_TYPE_LABELS,
  PRIORITY_LANE_LABELS,
  VISIT_PURPOSE_LABELS,
} from "@/lib/intake-labels";
import type {
  AppointmentStatus,
  Patient,
  PublicPatient,
} from "@/lib/types";

const TERMINAL_STATUSES: AppointmentStatus[] = [
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
  "ARCHIVED",
];

const subscribeToNothing = () => () => {};
const getOrigin = () => window.location.origin;
const getServerOrigin = () => "";

const STATUS_MESSAGES: Record<AppointmentStatus, string> = {
  PENDING_RECEPTION:
    "Reception is reviewing your intake and will confirm your lane shortly.",
  APPROVED:
    "Your visit has been approved. Please stay near the waiting area.",
  WAITING:
    "You are in the queue. Watch the screen for your ticket number.",
  CALLED: "It is your turn. Please proceed to the assigned counter or room.",
  ONGOING: "Your consultation is in progress.",
  COMPLETED: "Your visit is complete. Thank you for choosing AlimaCare.",
  CANCELLED:
    "This ticket was cancelled. Please speak with reception if you need help.",
  NO_SHOW:
    "This ticket was marked as a no-show. Please speak with reception.",
  ARCHIVED: "This ticket has been archived.",
};

export function IntakeTicket({
  patient,
  onReset,
}: {
  patient: Patient;
  onReset: () => void;
}) {
  const [live, setLive] = useState<PublicPatient>({
    patientId: patient.patientId,
    fullName: patient.fullName,
    status: patient.status,
    visitPurpose: patient.visitPurpose,
    department: patient.department,
    priorityLane: patient.priorityLane,
    queueNumber: patient.queueNumber,
    queuePosition:
      patient.patientsAhead !== undefined
        ? patient.patientsAhead + 1
        : undefined,
    patientsAhead: patient.patientsAhead,
    estimatedWaitMinutes: patient.estimatedWaitMinutes,
  });
  const origin = useSyncExternalStore(
    subscribeToNothing,
    getOrigin,
    getServerOrigin
  );

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    const load = async () => {
      try {
        // The internal UUID keeps patient references from being enumerable.
        const response = await fetch(
          `/api/patient/${encodeURIComponent(patient.id)}`,
          { cache: "no-store" }
        );

        if (!response.ok) return;

        const data = (await response.json()) as PublicPatient;
        if (cancelled || !data?.status || !data?.patientId) return;

        setLive(data);

        if (TERMINAL_STATUSES.includes(data.status) && timer) {
          clearInterval(timer);
          timer = undefined;
        }
      } catch {
        // Keep the ticket calm; the next poll will retry.
      }
    };

    load();
    timer = setInterval(load, 5_000);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [patient.id]);

  const ticketNumber = live.queueNumber ?? patient.queueNumber ?? "—";
  const department = live.department ?? patient.department;
  const purpose = live.visitPurpose ?? patient.visitPurpose;
  const priorityLane = live.priorityLane ?? patient.priorityLane;
  const isEmergency = purpose === "emergency";
  const isTerminal = TERMINAL_STATUSES.includes(live.status);
  const qrValue = origin
    ? `${origin}/patient/${encodeURIComponent(patient.id)}`
    : "";

  const statusMessage =
    isEmergency && live.status === "PENDING_RECEPTION"
      ? "ER triage has been alerted. If this is life-threatening, proceed to the emergency room now."
      : STATUS_MESSAGES[live.status];

  const positionLabel =
    live.queuePosition === 0
      ? "Now serving"
      : live.queuePosition !== undefined
        ? String(live.queuePosition)
        : "—";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f3f7fc] px-4 py-8 sm:px-6 lg:py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-medical-blue/10 blur-3xl" />
        <div className="absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-soft-green/10 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-3xl">
        <div className="mb-6 flex items-center justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-gray-200"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-medical-blue text-white">
              <ShieldCheck className="h-4 w-4" />
            </span>
            AlimaCare
          </Link>
        </div>

        <div className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/90 shadow-xl shadow-slate-200/60 backdrop-blur">
          <div className="relative overflow-hidden bg-gradient-to-br from-medical-blue-dark via-medical-blue to-[#3b82f6] px-6 py-8 text-white sm:px-10">
            <div
              aria-hidden="true"
              className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-white/10"
            />
            <div
              aria-hidden="true"
              className="absolute -bottom-16 left-10 h-40 w-40 rounded-full bg-white/5"
            />

            <div className="relative text-center">
              <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white/85">
                {live.status === "CALLED" ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin [animation-duration:3s]" />
                )}
                Registration received
              </p>
              <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Please wait at the moment
              </h1>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-white/80">
                {statusMessage}
              </p>
            </div>
          </div>

          <div className="p-5 sm:p-8">
            <div className="relative overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
              <div className="grid sm:grid-cols-[1.35fr_1fr]">
                <div className="p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                    Your ticket
                  </p>
                  <p className="mt-1 font-mono text-5xl font-black tracking-tight text-medical-blue-dark sm:text-6xl">
                    {ticketNumber}
                  </p>
                  <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-gray-600">
                    <MapPin className="h-4 w-4 text-medical-blue" />
                    {departmentLabel(department)}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <StatusBadge status={live.status} />
                    {!isEmergency && (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
                        {PRIORITY_LANE_LABELS[priorityLane]}
                      </span>
                    )}
                    {isEmergency && patient.roomPreference && (
                      <span className="inline-flex items-center rounded-full bg-red-light px-2.5 py-0.5 text-xs font-semibold text-red-dark">
                        {patient.roomPreference.replace("_", "-")}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center border-t border-dashed border-gray-200 bg-gray-50/70 p-6 sm:border-l sm:border-t-0">
                  <TicketQr value={qrValue} size={180} />
                  <p className="mt-3 max-w-[190px] text-center text-xs leading-5 text-gray-400">
                    Scan at the desk to open this ticket
                  </p>
                </div>
              </div>
            </div>

            {isEmergency && (
              <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-light/70 px-4 py-3 text-sm text-red-dark">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  If the patient is unconscious, bleeding severely, or having
                  trouble breathing, go straight to ER triage. Do not wait for
                  this form.
                </p>
              </div>
            )}

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-center">
                <Hash className="mx-auto h-4 w-4 text-medical-blue" />
                <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-400">
                  Position
                </p>
                <p className="mt-0.5 text-lg font-bold text-gray-900">
                  {positionLabel}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-center">
                <Users className="mx-auto h-4 w-4 text-orange-dark" />
                <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-400">
                  Ahead
                </p>
                <p className="mt-0.5 text-lg font-bold text-gray-900">
                  {live.patientsAhead ?? "—"}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-center">
                <Clock3 className="mx-auto h-4 w-4 text-soft-green-dark" />
                <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-400">
                  Est. wait
                </p>
                <p className="mt-0.5 text-lg font-bold text-gray-900">
                  {live.estimatedWaitMinutes !== undefined
                    ? `${live.estimatedWaitMinutes} min`
                    : "—"}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-center">
                <Hourglass className="mx-auto h-4 w-4 text-gray-500" />
                <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-400">
                  Patient ID
                </p>
                <p className="mt-0.5 break-all font-mono text-xs font-bold text-gray-900">
                  {live.patientId}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-gray-100 bg-white p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  Patient
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {live.fullName}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {VISIT_PURPOSE_LABELS[purpose]}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  Billing
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {PAYMENT_TYPE_LABELS[patient.paymentType]}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {patient.assignedDoctor
                    ? `Doctor: ${patient.assignedDoctor}`
                    : "Reception will confirm your lane."}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href={`/patient/${encodeURIComponent(patient.id)}`}
                className="group inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-medical-blue px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-medical-blue/20 transition hover:bg-medical-blue-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-medical-blue focus-visible:ring-offset-2"
              >
                Open live status
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-medical-blue focus-visible:ring-offset-2"
              >
                <Printer className="h-4 w-4" />
                Print ticket
              </button>
              <button
                type="button"
                onClick={onReset}
                className="inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-medical-blue focus-visible:ring-offset-2"
              >
                Register another
              </button>
            </div>

            {!isTerminal && (
              <p className="mt-4 text-center text-xs text-gray-400">
                This ticket refreshes automatically every 5 seconds.
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
