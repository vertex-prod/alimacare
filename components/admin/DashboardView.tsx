"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Stethoscope,
  Users,
} from "lucide-react";
import Link from "next/link";

import { DepartmentBadge, PurposeBadge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardsSkeleton, TableSkeleton } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { displayPatientName, formatDate, formatTime } from "@/lib/format";
import { departmentLabel } from "@/lib/labels";
import type { DashboardData } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export function DashboardView() {
  const { data, error, loading, reload } = useApi<DashboardData>(
    "/api/admin/dashboard",
    { refreshMs: 10_000 }
  );

  const header = (
    <PageHeader
      eyebrow="Overview"
      title="Dashboard"
      description={
        data
          ? `Today's patient flow — ${formatDate(`${data.today}T12:00:00+08:00`)}. Updates live.`
          : "Today's patient flow."
      }
    />
  );

  if (loading && !data) {
    return (
      <>
        {header}
        <CardsSkeleton />
        <div className="mt-6">
          <TableSkeleton />
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        {header}
        <EmptyState
          title="Could not load the dashboard"
          description={error ?? "Please try again."}
          action={<Button onClick={reload}>Try again</Button>}
        />
      </>
    );
  }

  const { counts } = data;
  const waiting = counts.PENDING_RECEPTION + counts.APPROVED + counts.WAITING;
  const serving = counts.CALLED + counts.ONGOING;
  return (
    <>
      {header}

      {error ? (
        <p className="mb-4 rounded-lg bg-orange-light px-3 py-2 text-sm text-orange-dark">
          Showing the last loaded data: {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Registered today"
          value={data.total}
          icon={<Users />}
          tone="blue"
          hint={`${data.priority} priority lane`}
        />
        <StatCard
          label="Waiting"
          value={waiting}
          icon={<Clock3 />}
          tone="orange"
          hint={`${counts.PENDING_RECEPTION} pending reception`}
        />
        <StatCard
          label="Being served"
          value={serving}
          icon={<Stethoscope />}
          tone="info"
          hint={`${counts.CALLED} called · ${counts.ONGOING} ongoing`}
        />
        <StatCard
          label="Completed"
          value={counts.COMPLETED}
          icon={<CheckCircle2 />}
          tone="green"
          hint={`${counts.NO_SHOW} no-show · ${counts.CANCELLED} cancelled`}
        />
        <StatCard
          label="Emergency intakes"
          value={data.emergencies}
          icon={<AlertTriangle />}
          tone="red"
        />
      </div>

      <div className="mt-6">
        <Card className="p-5">
          <CardHeader
            title="Departments"
            description="Today's tickets per department."
            action={
              <Link
                href="/admin/queue"
                className="text-sm font-medium text-medical-blue hover:underline"
              >
                Open live queue →
              </Link>
            }
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {data.departments.map((department) => (
              <div
                key={department.code}
                className="rounded-lg border border-gray-200 p-4"
              >
                <div className="flex items-center justify-between">
                  <DepartmentBadge code={department.code} />
                  <span className="text-2xl font-bold text-gray-900">
                    {department.active}
                  </span>
                </div>
                <p className="mt-2 text-xs font-medium text-gray-500">
                  {departmentLabel(department.code)}
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-gray-600">
                  <dt>Pending</dt>
                  <dd className="text-right font-semibold">{department.pending}</dd>
                  <dt>Waiting</dt>
                  <dd className="text-right font-semibold">{department.waiting}</dd>
                  <dt>Serving</dt>
                  <dd className="text-right font-semibold">{department.serving}</dd>
                  <dt>Completed</dt>
                  <dd className="text-right font-semibold">{department.completed}</dd>
                </dl>
              </div>
            ))}
          </div>
        </Card>

      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="p-5 pb-3">
          <CardHeader
            title="Latest registrations"
            description="Most recent intakes from the QR form today."
            action={
              <Link
                href="/admin/patients"
                className="text-sm font-medium text-medical-blue hover:underline"
              >
                All records →
              </Link>
            }
          />
        </div>
        {data.recent.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Visit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Registered</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.recent.map((patient) => (
                <TableRow key={patient.id}>
                  <TableCell className="font-mono font-semibold text-gray-900">
                    {patient.queue_number ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/admin/patients/${patient.id}`}
                      className="font-medium text-gray-900 hover:text-medical-blue"
                    >
                      {displayPatientName(patient)}
                    </Link>
                    <p className="text-xs text-gray-400">{patient.patient_id}</p>
                  </TableCell>
                  <TableCell>
                    <PurposeBadge purpose={patient.visit_purpose} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={patient.status} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-gray-500">
                    {formatTime(patient.registration_datetime)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="p-5 pt-0">
            <EmptyState
              title="No registrations yet today"
              description="New intakes from the patient QR form will appear here."
            />
          </div>
        )}
      </Card>
    </>
  );
}
