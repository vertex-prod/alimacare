"use client";

import { Download, FileSpreadsheet, ShieldAlert } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormField, Input } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { todayInTimeZone } from "@/lib/format";

export function ExportView() {
  const toast = useToast();
  const today = todayInTimeZone("Asia/Manila");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState(false);

  const download = async () => {
    if (from > to) {
      toast.error("The start date must be on or before the end date.");
      return;
    }

    setBusy(true);

    try {
      const response = await fetch(
        `/api/admin/export?${new URLSearchParams({ from, to }).toString()}`,
        { cache: "no-store", credentials: "same-origin" }
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? `Export failed (${response.status}).`);
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const filename =
        /filename="([^"]+)"/.exec(disposition)?.[1] ?? `alimacare-patients-${from}.csv`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      toast.success("Export downloaded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Records"
        title="Export"
        description="Download patient intakes as a CSV file that opens in Excel or Google Sheets."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <CardHeader
            title="Patient intake export"
            description="Filtered by queue date (Asia/Manila). Up to one year per file."
          />
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <FormField label="From">
              <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
            </FormField>
            <FormField label="To">
              <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
            </FormField>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={download} disabled={busy || !from || !to}>
              <Download className="h-4 w-4" />
              {busy ? "Preparing…" : "Download CSV"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setFrom(today);
                setTo(today);
              }}
            >
              Today
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start gap-3">
            <FileSpreadsheet className="mt-0.5 h-5 w-5 text-medical-blue" />
            <div className="text-sm text-gray-600">
              <p className="font-semibold text-gray-900">What&apos;s included</p>
              <p className="mt-1">
                Identity, visit, billing, emergency contact, guardian, consent,
                and queue timestamps. Signatures are not exported.
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-start gap-3 rounded-lg bg-orange-light p-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-orange-dark" />
            <p className="text-xs text-orange-dark">
              The file contains personal health information covered by the Data
              Privacy Act of 2012. Store and share it only with authorized staff.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}
