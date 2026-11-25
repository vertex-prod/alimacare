"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { Hourglass, CheckCircle, ArrowLeft } from "lucide-react";
import type { AppointmentStatus, PublicPatient } from "@/lib/types";

const TERMINAL_STATUSES: AppointmentStatus[] = [
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
  "ARCHIVED",
];

const statusLabels: Record<string, string> = {
  PENDING_RECEPTION: "Please Stand By",
  APPROVED: "Approved",
  WAITING: "Waiting for Doctor",
  CALLED: "Your Turn!",
  ONGOING: "Consultation in Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No Show",
  ARCHIVED: "Archived",
};

export function PatientStatusClient({ patientId }: { patientId: string }) {
  const router = useRouter();

  const [patient, setPatient] = useState<PublicPatient | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    const fetchPatient = async () => {
      try {
        const response = await fetch(`/api/patient/${patientId}`, {
          cache: "no-store",
        });

        if (response.status === 404) {
          if (!cancelled) {
            setNotFound(true);
            setLoading(false);
            if (interval) {
              clearInterval(interval);
              interval = undefined;
            }
          }
          return;
        }

        if (!response.ok) {
          throw new Error("Could not load your status.");
        }

        const data = (await response.json()) as PublicPatient;
        if (cancelled) return;

        setPatient(data);
        setNotFound(false);
        setError(null);
        setLoading(false);

        if (TERMINAL_STATUSES.includes(data.status) && interval) {
          clearInterval(interval);
          interval = undefined;
        }
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : "Could not load your status right now."
        );
        setLoading(false);
      }
    };

    fetchPatient();
    interval = setInterval(fetchPatient, 5_000);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [patientId, reloadKey]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Hourglass className="w-12 h-12 text-medical-blue mx-auto mb-4 animate-spin" />
          <p className="text-gray-600">Loading patient status…</p>
        </div>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <Card className="p-6 text-center">
          <p className="text-red-600">Patient not found.</p>
          <Button onClick={() => router.push("/patient")} className="mt-4">
            Go to Registration
          </Button>
        </Card>
      </main>
    );
  }

  if (!patient) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <Card className="p-6 text-center">
          <p className="text-red-600">
            {error ?? "We could not load this patient record."}
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <Button onClick={() => setReloadKey((key) => key + 1)}>
              Try Again
            </Button>
            <Button onClick={() => router.push("/patient")} variant="outline">
              Go to Registration
            </Button>
          </div>
        </Card>
      </main>
    );
  }

  const currentStatus = statusLabels[patient.status] ?? patient.status;
  const hasQueue =
    patient.queueNumber &&
    (patient.status === "WAITING" ||
      patient.status === "CALLED" ||
      patient.status === "ONGOING");

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg space-y-6">
        <Card className="p-6">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {patient.fullName}
            </h2>
            <p className="text-sm text-gray-500">
              Patient ID: {patient.patientId}
            </p>
          </div>

          {error && (
            <p className="mb-4 rounded-lg bg-orange-light px-3 py-2 text-sm text-orange-dark">
              {error} Retrying automatically…
            </p>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Status</span>
              <StatusBadge status={patient.status} />
            </div>

            <div className="p-3 bg-medical-blue-light/30 rounded-lg text-center">
              <p className="text-medical-blue-dark font-medium">
                {currentStatus}
              </p>
            </div>

            {patient.status === "PENDING_RECEPTION" && (
              <div className="text-center py-4">
                <Hourglass className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                <p className="text-sm text-gray-600">
                  Waiting for reception to assign a doctor and room…
                </p>
              </div>
            )}

            {hasQueue && (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-blue-50 rounded-lg text-center">
                  <p className="text-xs text-gray-600">Queue Number</p>
                  <p className="text-2xl font-bold text-medical-blue">
                    {patient.queueNumber}
                  </p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg text-center">
                  <p className="text-xs text-gray-600">Room</p>
                  <p className="text-2xl font-bold text-green-700">
                    {patient.assignedRoom ?? "—"}
                  </p>
                </div>
              </div>
            )}

            {patient.status === "CALLED" && (
              <div className="p-3 bg-green-100 rounded-lg text-center">
                <CheckCircle className="w-6 h-6 text-green-600 mx-auto mb-1" />
                <p className="text-green-800 font-medium">
                  Please proceed to Room {patient.assignedRoom ?? "—"}
                </p>
              </div>
            )}

            {patient.status === "ONGOING" && (
              <div className="p-3 bg-medical-blue-light/50 rounded-lg text-center">
                <p className="text-medical-blue-dark font-medium">
                  Consultation in Progress
                </p>
              </div>
            )}

            {patient.assignedDoctor && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600">Assigned Doctor</p>
                <p className="text-sm font-medium text-gray-900">
                  {patient.assignedDoctor}
                </p>
              </div>
            )}

            {patient.status === "WAITING" &&
              patient.estimatedWaitMinutes != null && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600">Estimated Wait</p>
                  <p className="text-sm font-medium text-gray-900">
                    {patient.estimatedWaitMinutes} minutes
                  </p>
                </div>
              )}

            {patient.completedTime && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600">Completed At</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(patient.completedTime).toLocaleString()}
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 flex gap-3">
            <Button
              onClick={() => router.push("/patient")}
              variant="outline"
              className="flex-1"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Registration
            </Button>
          </div>

          {!TERMINAL_STATUSES.includes(patient.status) && (
            <p className="mt-4 text-center text-xs text-gray-400">
              This page refreshes automatically every 5 seconds.
            </p>
          )}
        </Card>
      </div>
    </main>
  );
}
