"use client";

import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  DepartmentBadge,
  PriorityBadge,
  PurposeBadge,
  StatusBadge,
} from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Select } from "@/components/ui/form";
import { TableSkeleton } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { displayPatientName, formatDateTime } from "@/lib/format";
import {
  DEFAULT_DEPARTMENTS,
  STATUSES,
  STATUS_LABELS,
  VISIT_PURPOSE_SHORT_LABELS,
} from "@/lib/labels";
import type { PatientsResponse, VisitPurpose } from "@/lib/types";
import { useApi } from "@/lib/use-api";

const PAGE_SIZE = 25;

interface Filters {
  q: string;
  status: string;
  department: string;
  purpose: string;
  from: string;
  to: string;
}

const EMPTY: Filters = { q: "", status: "", department: "", purpose: "", from: "", to: "" };

export function PatientsView() {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Debounce the free-text search so typing does not fire a request per key.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((current) => (current.q === search ? current : { ...current, q: search }));
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [search]);

  const path = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });

    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value);
    }

    return `/api/admin/patients?${params.toString()}`;
  }, [filters, page]);

  const { data, error, loading, reload } = useApi<PatientsResponse>(path, {
    refreshMs: 5_000,
  });

  const update = (key: keyof Filters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const hasFilters = search !== "" || Object.values(filters).some(Boolean);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <PageHeader
        eyebrow="Records"
        title="Patient records"
        description="Every intake submitted through the patient form. Search by name, patient ID, ticket, or phone number."
      />

      <Card className="mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_minmax(0,2fr)]">
          <div className="relative md:col-span-2 xl:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, AC-…, OPD-001, phone"
              className="pl-9"
              aria-label="Search patients"
            />
          </div>
          <Select
            value={filters.status}
            onChange={(event) => update("status", event.target.value)}
            aria-label="Status"
          >
            <option value="">All statuses</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
          <Select
            value={filters.department}
            onChange={(event) => update("department", event.target.value)}
            aria-label="Department"
          >
            <option value="">All departments</option>
            {DEFAULT_DEPARTMENTS.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
          <Select
            value={filters.purpose}
            onChange={(event) => update("purpose", event.target.value)}
            aria-label="Visit purpose"
          >
            <option value="">All visit types</option>
            {(Object.keys(VISIT_PURPOSE_SHORT_LABELS) as VisitPurpose[]).map((purpose) => (
              <option key={purpose} value={purpose}>
                {VISIT_PURPOSE_SHORT_LABELS[purpose]}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-2 md:col-span-2 xl:col-span-1">
            <Input
              type="date"
              value={filters.from}
              onChange={(event) => update("from", event.target.value)}
              aria-label="From date"
              title="From date"
            />
            <Input
              type="date"
              value={filters.to}
              onChange={(event) => update("to", event.target.value)}
              aria-label="To date"
              title="To date"
            />
          </div>
        </div>
        {hasFilters ? (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setFilters(EMPTY);
              setPage(1);
            }}
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800"
          >
            <X className="h-3.5 w-3.5" />
            Clear filters
          </button>
        ) : null}
      </Card>

      {loading && !data ? (
        <TableSkeleton rows={8} />
      ) : !data ? (
        <EmptyState
          title="Could not load patient records"
          description={error ?? "Please try again."}
          action={<Button onClick={reload}>Try again</Button>}
        />
      ) : (
        <Card className="overflow-hidden">
          {error ? (
            <p className="bg-orange-light px-4 py-2 text-sm text-orange-dark">{error}</p>
          ) : null}
          {data.patients.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Visit</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Registered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.patients.map((patient) => (
                  <TableRow key={patient.id}>
                    <TableCell>
                      <Link
                        href={`/admin/patients/${patient.id}`}
                        className="font-medium text-gray-900 hover:text-medical-blue"
                      >
                        {displayPatientName(patient)}
                      </Link>
                      <p className="text-xs text-gray-400">
                        {patient.patient_id} · {patient.age} yrs · {patient.sex}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-gray-900">
                          {patient.queue_number ?? "—"}
                        </span>
                        <DepartmentBadge code={patient.department} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <PurposeBadge purpose={patient.visit_purpose} />
                    </TableCell>
                    <TableCell>
                      <PriorityBadge lane={patient.priority_lane} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={patient.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-gray-500">
                      {formatDateTime(patient.registration_datetime)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-5">
              <EmptyState
                title="No matching patients"
                description={
                  hasFilters
                    ? "Try a different search or clear the filters."
                    : "Intakes from the patient form will appear here."
                }
              />
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 text-sm text-gray-500">
            <span>
              {data.total === 0
                ? "0 records"
                : `${(data.page - 1) * data.pageSize + 1}–${Math.min(
                    data.page * data.pageSize,
                    data.total
                  )} of ${data.total} records`}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span>
                Page {data.page} of {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
