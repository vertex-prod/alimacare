"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AssessmentView } from "@/lib/db/AssessmentRepository";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { createStaffBrowserClient } from "@/lib/supabase-browser";
import {
  AssessmentPanel,
  levelTone,
  validationTone,
  type AuditEntry,
  type DoctorOption,
} from "./AssessmentPanel";

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

const POLL_MS = 5000;
const STATUSES = ["AVAILABLE", "BUSY", "ON_BREAK", "OFF_DUTY", "UNAVAILABLE"];

export function AssessmentDashboard({ mode }: { mode: "admin" | "doctor" }) {
  const router = useRouter();
  const loginPath = mode === "doctor" ? "/doctor/login" : "/admin/login";

  const [me, setMe] = useState<Me | null>(null);
  const [queue, setQueue] = useState<AssessmentView[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [onlyMine, setOnlyMine] = useState(mode === "doctor");

  const refresh = useCallback(async () => {
    try {
      const [meRes, queueRes, alertRes, docRes] = await Promise.all([
        fetch("/api/auth/me", { cache: "no-store" }),
        fetch("/api/assessment/queue", { cache: "no-store" }),
        fetch("/api/assessment/alerts", { cache: "no-store" }),
        fetch("/api/doctors/availability", { cache: "no-store" }),
      ]);

      if (meRes.status === 401 || meRes.status === 403) {
        router.replace(loginPath);
        return;
      }

      if (meRes.ok) setMe((await meRes.json()) as Me);
      if (queueRes.ok) setQueue(((await queueRes.json()) as { assessments: AssessmentView[] }).assessments);
      if (alertRes.ok) setAlerts(((await alertRes.json()) as { alerts: AlertItem[] }).alerts);
      if (docRes.ok) setDoctors(((await docRes.json()) as { doctors: DoctorOption[] }).doctors);

      setLoadError(queueRes.ok ? null : "Could not load assessments. Retrying…");
    } catch {
      setLoadError("Connection problem. Retrying…");
    }
  }, [router, loginPath]);

  useEffect(() => {
    // Polling keeps new Level 1-2 alerts visible without a manual refresh.
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

    const res = await fetch(`/api/assessment/${patientUuid}`, { cache: "no-store" });

    if (res.ok) setDetail((await res.json()) as Detail);
  }, []);

  async function act(path: string, body: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/assessment/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await res.json().catch(() => ({}))) as Partial<Detail> & { error?: string };

      if (!res.ok || !payload.assessment) {
        setActionError(payload.error ?? "The action could not be completed.");
        return false;
      }

      setDetail({ assessment: payload.assessment, audit: payload.audit ?? [] });
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
      router.replace(loginPath);
    }
  }

  const visible = queue.filter(
    (a) => !onlyMine || !me?.doctorId || a.effective.doctorId === me.doctorId
  );
  const editableDoctors = doctors.filter((d) => me?.role !== "DOCTOR" || d.id === me.doctorId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {mode === "doctor" ? "Doctor dashboard" : "Reception dashboard"}
          </h1>
          <p className="text-sm text-gray-500">
            {me ? `${me.fullName} · ${me.role}` : "Loading…"} · AI assessments are preliminary and need staff validation.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={signOut}>
          Sign out
        </Button>
      </div>

      {alerts.length > 0 && (
        <section aria-live="assertive" className="space-y-2 rounded-xl border-2 border-red bg-red-light p-4">
          <h2 className="font-bold text-red-dark">
            {alerts.length} critical / emergency patient{alerts.length === 1 ? "" : "s"} awaiting staff
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

      <div className="grid gap-6 xl:grid-cols-[minmax(320px,420px)_1fr]">
        <Card className="p-4">
          <CardHeader
            title="Patients by priority"
            description={`${visible.length} active`}
            action={
              mode === "doctor" ? (
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
                  Only mine
                </label>
              ) : undefined
            }
          />
          <ul className="mt-3 divide-y divide-gray-100">
            {visible.length === 0 && <li className="py-6 text-center text-sm text-gray-400">No assessed patients.</li>}
            {visible.map((a) => (
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
                    <Badge tone={validationTone(a.validation.status)}>{a.validation.status}</Badge>
                    {a.effective.department && <Badge tone="neutral">{a.effective.department}</Badge>}
                    {a.pendingAssignment && <Badge tone="warning">No doctor</Badge>}
                    {a.status === "failed" && <Badge tone="muted">AI unavailable</Badge>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-6">
          {detail && me ? (
            <AssessmentPanel
              key={detail.assessment.id}
              assessment={detail.assessment}
              audit={detail.audit}
              role={me.role}
              doctors={doctors}
              busy={busy}
              error={actionError}
              onAction={act}
            />
          ) : (
            <Card className="p-8 text-center text-sm text-gray-400">Select a patient to review the assessment.</Card>
          )}

          <Card className="p-4">
            <CardHeader title="Doctor availability" description="Live status used for assignment" />
            <ul className="mt-3 divide-y divide-gray-100 text-sm">
              {editableDoctors.length === 0 && <li className="py-3 text-gray-400">No doctors registered.</li>}
              {editableDoctors.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    <span className="font-medium">{d.fullName}</span>{" "}
                    <span className="text-gray-500">
                      {d.department} · {d.activeConsultations} active · {d.queuedPatients} queued
                      {d.onDutyNow ? "" : " · off schedule"}
                    </span>
                  </span>
                  <select
                    value={d.status}
                    onChange={(e) => void setDoctorStatus(d.id, e.target.value)}
                    className="rounded-lg border border-gray-300 px-2 py-1 text-xs"
                    aria-label={`Status for ${d.fullName}`}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
