"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { FormField, Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { apiSend } from "@/lib/client-api";
import { DEFAULT_DEPARTMENTS, departmentLabel } from "@/lib/labels";
import type { PatientRow } from "@/lib/types";

export function TransferDialog({
  patient,
  open,
  onClose,
  onTransferred,
}: {
  patient: Pick<PatientRow, "id" | "full_name" | "department" | "queue_number">;
  open: boolean;
  onClose: () => void;
  onTransferred: (patient: PatientRow) => void;
}) {
  const toast = useToast();
  const options = DEFAULT_DEPARTMENTS.filter((code) => code !== patient.department);
  const [department, setDepartment] = useState<string>(options[0] ?? "OPD");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);

    try {
      const result = await apiSend<{ patient: PatientRow }>(
        `/api/admin/patients/${patient.id}`,
        "PATCH",
        { department, reason }
      );

      toast.success(
        `${patient.queue_number ?? patient.full_name} transferred to ${department}.`
      );
      setReason("");
      onTransferred(result.patient);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Transfer failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => (busy ? undefined : onClose())}
      title={`Transfer ${patient.queue_number ?? "patient"}`}
      description={`${patient.full_name} is currently in ${departmentLabel(
        patient.department
      )}. The ticket number stays the same.`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Back
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Transferring…" : "Transfer"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Move to department">
          <Select
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
          >
            {options.map((code) => (
              <option key={code} value={code}>
                {code} — {departmentLabel(code)}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Reason (optional)">
          <Input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={300}
            placeholder="Needs laboratory work-up"
          />
        </FormField>
      </div>
    </Modal>
  );
}
