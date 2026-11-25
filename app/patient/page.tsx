"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ClassificationBadge } from "@/components/ui/Badge";
import type { Patient, PatientClassification } from "@/lib/types";

interface PublicDoctor {
  id: string;
  fullName: string;
  specialization: string;
}

const CLASSIFICATIONS: PatientClassification[] = ["I", "II", "III"];

const classificationLabels: Record<PatientClassification, string> = {
  I: "Class I - Normal",
  II: "Class II - Assessment",
  III: "Class III - Emergency",
};

export default function RegistrationPage() {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "confirmation">("form");
  const [doctors, setDoctors] = useState<PublicDoctor[]>([]);
  const [created, setCreated] = useState<Patient | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    serviceType: "Check-up / Consultation",
    fullName: "",
    age: "",
    sex: "Male" as "Male" | "Female" | "Other",
    contactNumber: "",
    classification: "I" as PatientClassification,
    recommendedDoctor: "",
    appointmentTime: "",
  });

  useEffect(() => {
    let cancelled = false;

    fetch("/api/doctors", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return [];
        const payload = await response.json();
        return Array.isArray(payload) ? (payload as PublicDoctor[]) : [];
      })
      .then((payload) => {
        if (!cancelled) setDoctors(payload);
      })
      .catch(() => {
        // The form still works without a recommended doctor.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (step !== "confirmation" || !created) return;

    const timer = setTimeout(() => {
      router.push(`/patient/${created.id}`);
    }, 2_500);

    return () => clearTimeout(timer);
  }, [step, created, router]);

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      // Send an absolute timestamp so the server does not have to guess the
      // patient's timezone from a `datetime-local` value.
      const payloadBody = {
        ...form,
        appointmentTime: form.appointmentTime
          ? new Date(form.appointmentTime).toISOString()
          : undefined,
        recommendedDoctor: form.recommendedDoctor || undefined,
      };

      const response = await fetch("/api/patient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadBody),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error ?? "Registration failed.");
      }

      setCreated(payload as Patient);
      setStep("confirmation");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to register patient. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <Card className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {step === "form" ? "Patient Registration" : "Confirmation"}
          </h2>

          {step === "form" && (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="serviceType"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Service Type
                  </label>
                  <select
                    id="serviceType"
                    className="w-full rounded-lg border border-gray-300 py-2 pl-3 text-sm focus:border-medical-blue"
                    required
                    value={form.serviceType}
                    onChange={(event) => update("serviceType", event.target.value)}
                  >
                    <option value="Check-up / Consultation">
                      Check-up / Consultation
                    </option>
                    <option value="Emergency">Emergency</option>
                  </select>
                </div>

                <div>
                  <span className="block text-sm font-medium text-gray-700 mb-1">
                    Classification
                  </span>
                  <div className="space-y-2">
                    {CLASSIFICATIONS.map((classification) => (
                      <label
                        key={classification}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="radio"
                          name="classification"
                          value={classification}
                          checked={form.classification === classification}
                          onChange={() => update("classification", classification)}
                          className="rounded border-gray-300 focus:ring-2 focus:ring-medical-blue"
                        />
                        <ClassificationBadge classification={classification} />
                        <span className="text-sm font-medium text-gray-700">
                          {classificationLabels[classification]}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label
                  htmlFor="fullName"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Full Name
                </label>
                <input
                  id="fullName"
                  type="text"
                  placeholder="Enter full name"
                  value={form.fullName}
                  onChange={(event) => update("fullName", event.target.value)}
                  className="w-full rounded-lg border border-gray-300 py-2 pl-3 text-sm focus:border-medical-blue"
                  maxLength={120}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="age"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Age
                  </label>
                  <input
                    id="age"
                    type="number"
                    placeholder="e.g., 34"
                    value={form.age}
                    onChange={(event) => update("age", event.target.value)}
                    className="w-full rounded-lg border border-gray-300 py-2 pl-3 text-sm focus:border-medical-blue"
                    min="0"
                    max="150"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="sex"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Sex
                  </label>
                  <select
                    id="sex"
                    value={form.sex}
                    onChange={(event) =>
                      update("sex", event.target.value as typeof form.sex)
                    }
                    className="w-full rounded-lg border border-gray-300 py-2 pl-3 text-sm focus:border-medical-blue"
                    required
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="contactNumber"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Contact Number
                  </label>
                  <input
                    id="contactNumber"
                    type="tel"
                    placeholder="+63 912 345 6789"
                    value={form.contactNumber}
                    onChange={(event) =>
                      update("contactNumber", event.target.value)
                    }
                    className="w-full rounded-lg border border-gray-300 py-2 pl-3 text-sm focus:border-medical-blue"
                    required
                    pattern="[0-9+\-\(\) ]{7,20}"
                  />
                </div>

                <div>
                  <label
                    htmlFor="recommendedDoctor"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Recommended Doctor (Optional)
                  </label>
                  <select
                    id="recommendedDoctor"
                    value={form.recommendedDoctor}
                    onChange={(event) =>
                      update("recommendedDoctor", event.target.value)
                    }
                    className="w-full rounded-lg border border-gray-300 py-2 pl-3 text-sm focus:border-medical-blue"
                  >
                    <option value="">None</option>
                    {doctors.map((doctor) => (
                      <option key={doctor.id} value={doctor.fullName}>
                        {doctor.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="appointmentTime"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Appointment Time (Optional)
                </label>
                <input
                  id="appointmentTime"
                  type="datetime-local"
                  value={form.appointmentTime}
                  onChange={(event) =>
                    update("appointmentTime", event.target.value)
                  }
                  className="w-full rounded-lg border border-gray-300 py-2 pl-3 text-sm focus:border-medical-blue"
                />
              </div>

              {error && (
                <p className="rounded-lg bg-red-light px-3 py-2 text-sm text-red-dark">
                  {error}
                </p>
              )}

              <Button type="submit" fullWidth disabled={submitting}>
                {submitting ? "Submitting…" : "Continue"}
              </Button>
            </form>
          )}

          {step === "confirmation" && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-medical-blue-light flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-medical-blue"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Registration Submitted
              </h3>
              <p className="text-zinc-600 mb-4">
                Please stand by. Reception is reviewing your registration and
                checking doctor availability.
              </p>
              {created && (
                <p className="text-sm text-gray-700 mb-2">
                  Patient ID:{" "}
                  <strong className="font-mono">{created.patientId}</strong>
                </p>
              )}
              <p className="text-sm text-gray-500">
                Status:{" "}
                <strong className="text-orange-dark">
                  PENDING RECEPTION
                </strong>
              </p>
              <p className="mt-4 text-xs text-gray-400">
                Redirecting to your status page…
              </p>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
