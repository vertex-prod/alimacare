"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Stethoscope, UserCheck, Users } from "lucide-react";
import type { AssessmentView } from "@/lib/db/AssessmentRepository";
import type { AppointmentStatus } from "@/lib/types";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatCard } from "@/components/ui/StatCard";
import { createStaffBrowserClient } from "@/lib/supabase-browser";
import {
  doctorDecisionLabel,
  doctorDecisionTone,
  levelTone,
  validationTone,
  type AuditEntry,
  type DoctorOption,
} from "@/components/assessment/AssessmentSummary";
import { DoctorReviewPanel } from "./DoctorReviewPanel";

interface Me {
  fullName: string;
  role: "ADMIN" | "RECEPTION" | "DOCTOR";
  doctorId: string | null;
}

interface AlertItem {
  assessmentId: string;
  patientId: string;
  fullName: string;
  level: number;
  label: string;
  chiefComplaint: string;
  warningSigns: string[];
  createdAt: string;
}

interface Detail {
  assessment: AssessmentView;
  audit: AuditEntry[];
}

type Tab = "pending" | "accepted";

const POLL_MS = 5000;
const STATUSES = ["AVAILABLE", "BUSY", "ON_BREAK", "OFF_DUTY", "UNAVAILABLE"];

export function DoctorDashboard() {
  const router = useRouter();

  const [me, setMe] = useState<Me | null>(null);
  const [queue, setQueue] = useState<AssessmentView[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [tab, setTab] = useState<Tab>("pending");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [meRes, queueRes, alertRes, docRes] = await Promise.all([
        fetch("/api/auth/me", { cache: "no-store" }),
        fetch("/api/assessment/queue", { cache: "no-store" }),
        fetch("/api/assessment/alerts", { cache: "no-store" }),
        fetch("/api/doctors/availability", { cache: "no-store" }),
      ]);

      if (meRes.status === 401 || meRes.status === 403) {
        router.replace("/doctor/login");
        return;
      }

      if (meRes.ok) setMe((await meRes.json()) as Me);
      if (queueRes.ok) setQueue(((await queueRes.json()) as { assessments: AssessmentView[] }).assessments);
      if (alertRes.ok) setAlerts(((await alertRes.json()) as { alerts: AlertItem[] }).alerts);
      if (docRes.ok) setDoctors(((await docRes.json()) as { doctors: DoctorOption[] }).doctors);

      setLoadError(queueRes.ok ? null : "Could not load your assigned patients. Retrying…");
    } catch {
      setLoadError("Connection problem. Retrying…");
    }
  }, [router]);

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const timer = setInterval(refresh, POLL_MS);

    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [refresh]);

  const open = useCallback(async (patientUuid: string) => {
    setSelected(patientUuid);
    setActionError(null);
    setNotice(null);

    const res = await fetch(`/api/assessment/${patientUuid}`, { cache: "no-store" });

    if (res.ok) {
      setDetail((await res.json()) as Detail);
    } else {
      setDetail(null);
      setActionError("Could not load this patient's assessment.");
    }
  }, []);

  async function decide(kind: "accept" | "decline", note?: string): Promise<boolean> {
    if (!detail) return false;

    setBusy(true);
    setActionError(null);
    setNotice(null);

    try {
      const res = await fetch(`/api/assessment/${detail.assessment.id}/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kind === "decline" ? { note } : {}),
      });
      const payload = (await res.json().catch(() => ({}))) as Partial<Detail> & { error?: string };

      if (!res.ok || !payload.assessment) {
        setActionError(payload.error ?? "The action could not be completed.");
        return false;
      }

      if (kind === "accept") {
        setDetail({ assessment: payload.assessment, audit: payload.audit ?? [] });
        setTab("accepted");
        setNotice("Patient accepted. They are now in your waiting queue.");
      } else {
        setDetail(null);
        setSelected(null);
        setTab("pending");
        setNotice("Assignment declined. Reception will reassign the patient.");
      }

      await refresh();

      return true;
    } catch {
      setActionError("Connection problem. The change was not confirmed; check before retrying.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function setDoctorStatus(doctorId: string, status: string) {
    await fetch("/api/doctors/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doctorId, status }),
    });
    await refresh();
  }

  async function signOut() {
    try {
      await createStaffBrowserClient().auth.signOut();
    } finally {
      router.replace("/doctor/login");
    }
  }

  const mine = queue.filter((a) => !me?.doctorId || a.effective.doctorId === me.doctorId);
  const pending = mine.filter((a) => a.validation.doctorDecision === "PENDING");
  const accepted = mine.filter((a) => a.validation.doctorDecision === "ACCEPTED");
  const inConsultation = mine.filter(
    (a) => a.patient.patientStatus === "CALLED" || a.patient.patientStatus === "ONGOING"
  );
  const listed = tab === "pending" ? pending : accepted;
  const myDoctor = doctors.find((d) => d.id === me?.doctorId) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Doctor dashboard</h1>
          <p className="text-sm text-gray-500">
            {me ? `${me.fullName} · ${me.role}` : "Loading…"} · Review patients assigned to you by reception.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={signOut}>
          Sign out
        </Button>
      </div>

      {alerts.length > 0 && (
        <section aria-live="assertive" className="space-y-2 rounded-xl border-2 border-red bg-red-light p-4">
          <h2 className="font-bold text-red-dark">
            {alerts.length} critical / emergency patient{alerts.length === 1 ? "" : "s"} awaiting you
          </h2>
          {alerts.map((al) => (
            <div key={al.assessmentId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2">
              <div className="text-sm">
                <Badge tone="danger" dot>
                  {al.label}
                </Badge>{" "}
                <span className="font-semibold">{al.fullName}</span> ({al.patientId}) – {al.chiefComplaint}
                {al.warningSigns.length > 0 && (
                  <span className="block text-red-dark">Warning signs: {al.warningSigns.join("; ")}</span>
                )}
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  const match = queue.find((q) => q.id === al.assessmentId);

                  if (match) void open(match.patient.uuid);
                }}
              >
                Open
              </Button>
            </div>
          ))}
        </section>
      )}

      {loadError && <p className="text-sm text-orange-dark">{loadError}</p>}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Awaiting my review"
          value={pending.length}
          icon={<ClipboardCheck />}
          tone={pending.length > 0 ? "orange" : "gray"}
          hint="Assignments from reception"
        />
        <StatCard
          label="Accepted"
          value={accepted.length}
          icon={<UserCheck />}
          tone="green"
          hint="Patients in my queue"
        />
        <StatCard
          label="In consultation"
          value={inConsultation.length}
          icon={<Stethoscope />}
          tone="blue"
          hint="Called or ongoing"
        />
      </div>

      {notice && (
        <p role="status" className="rounded-lg bg-soft-green-light px-3 py-2 text-sm text-soft-green-dark">
          {notice}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(320px,420px)_1fr]">
        <Card className="p-4">
          <CardHeader
            title="Assigned patients"
            description={`${mine.length} active patient${mine.length === 1 ? "" : "s"}`}
          />

          <div className="mt-3 flex gap-1 rounded-lg bg-gray-100 p-1" role="tablist" aria-label="Patient filters">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "pending"}
              onClick={() => setTab("pending")}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                tab === "pending" ? "bg-white text-medical-blue-dark shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Needs review ({pending.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "accepted"}
              onClick={() => setTab("accepted")}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                tab === "accepted" ? "bg-white text-medical-blue-dark shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Accepted ({accepted.length})
            </button>
          </div>

          {listed.length === 0 ? (
            <div className="mt-3">
              <EmptyState
                title={tab === "pending" ? "No patients awaiting review" : "No accepted patients yet"}
                description={
                  tab === "pending"
                    ? "New assignments from reception will appear here automatically."
                    : "Accept an assignment to add the patient to your queue."
                }
                icon={<Users className="h-8 w-8" />}
              />
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-gray-100">
              {listed.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => void open(a.patient.uuid)}
                    className={`w-full px-2 py-3 text-left transition-colors hover:bg-gray-50 ${
                      selected === a.patient.uuid ? "bg-medical-blue-light/40" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-gray-900">{a.patient.fullName}</span>
                      <Badge tone={levelTone(a.effective.level)}>L{a.effective.level}</Badge>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-gray-500">{a.patient.chiefComplaint}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge tone={doctorDecisionTone(a.validation.doctorDecision)}>
                        {doctorDecisionLabel(a.validation.doctorDecision)}
                      </Badge>
                      <StatusBadge status={a.patient.patientStatus as AppointmentStatus} />
                      <Badge tone={validationTone(a.validation.status)}>{a.validation.status}</Badge>
                      {a.effective.department && <Badge tone="neutral">{a.effective.department}</Badge>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          {detail && me ? (
            <DoctorReviewPanel
              key={detail.assessment.id}
              assessment={detail.assessment}
              audit={detail.audit}
              busy={busy}
              error={actionError}
              onAccept={() => decide("accept")}
              onDecline={(note) => decide("decline", note)}
            />
          ) : (
            <Card className="p-8 text-center text-sm text-gray-400">
              Select an assigned patient to review their intake and AI assessment.
            </Card>
          )}

          {me?.doctorId && (
            <Card className="p-4">
              <CardHeader title="My availability" description="Reception uses this when assigning patients" />
              {myDoctor ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    <span className="font-medium">{myDoctor.department}</span>{" "}
                    <span className="text-gray-500">
                      · {myDoctor.activeConsultations} active · {myDoctor.queuedPatients} queued
                      {myDoctor.onDutyNow ? "" : " · off schedule"}
                    </span>
                  </span>
                  <select
                    value={myDoctor.status}
                    onChange={(e) => void setDoctorStatus(myDoctor.id, e.target.value)}
                    className="rounded-lg border border-gray-300 px-2 py-1 text-xs"
                    aria-label="My availability status"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="mt-3 text-sm text-gray-400">No doctor profile is linked to this account.</p>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
