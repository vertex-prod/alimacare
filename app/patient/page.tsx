"use client";

import {
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BedDouble,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  CreditCard,
  FlaskConical,
  HeartPulse,
  Loader2,
  MapPin,
  PenLine,
  Phone,
  ShieldCheck,
  Siren,
  Stethoscope,
  User,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  SignaturePad,
  type SignaturePadHandle,
} from "@/components/patient/SignaturePad";
import { IntakeTicket } from "@/components/patient/IntakeTicket";
import {
  PAYMENT_TYPE_LABELS,
  VISIT_PURPOSE_LABELS,
} from "@/lib/intake-labels";
import type {
  CivilStatus,
  GuardianRelationship,
  Patient,
  PaymentType,
  PriorityLane,
  RespondentRole,
  RoomPreference,
  VisitPurpose,
} from "@/lib/types";

type Sex = "Male" | "Female" | "Other";
type RequestSlip = "yes" | "no" | "";
type Step = "router" | "form" | "ticket";

interface FormState {
  fullName: string;
  identityUnknown: boolean;
  dob: string;
  age: string;
  sex: Sex;
  civilStatus: CivilStatus;
  address: string;
  contactNumber: string;
  chiefComplaint: string;
  allergies: string;
  symptomDuration: string;
  symptomSeverity: string;
  medicalHistory: string;
  currentMedications: string;
  hasRequestSlip: RequestSlip;
  priorityLane: PriorityLane;
  paymentType: PaymentType;
  hmoProvider: string;
  hmoNo: string;
  philhealthPin: string;
  employerName: string;
  roomPreference: RoomPreference | "";
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactNumber: string;
  guardianFullName: string;
  guardianRelationship: GuardianRelationship;
  guardianContactNumber: string;
  guardianIdType: string;
  consentGiven: boolean;
}

const INITIAL_FORM: FormState = {
  fullName: "",
  identityUnknown: false,
  dob: "",
  age: "",
  sex: "Male",
  civilStatus: "single",
  address: "",
  contactNumber: "",
  chiefComplaint: "",
  allergies: "",
  symptomDuration: "",
  symptomSeverity: "",
  medicalHistory: "",
  currentMedications: "",
  hasRequestSlip: "",
  priorityLane: "regular",
  paymentType: "cash",
  hmoProvider: "",
  hmoNo: "",
  philhealthPin: "",
  employerName: "",
  roomPreference: "",
  emergencyContactName: "",
  emergencyContactRelationship: "",
  emergencyContactNumber: "",
  guardianFullName: "",
  guardianRelationship: "parent",
  guardianContactNumber: "",
  guardianIdType: "",
  consentGiven: false,
};

const ROLE_OPTIONS: Array<{
  value: RespondentRole;
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    value: "self",
    title: "Self",
    description: "I am the patient filling out my own details.",
    icon: User,
  },
  {
    value: "guardian",
    title: "Guardian / Companion",
    description: "I am filling this out for someone else.",
    icon: Users,
  },
];

const PURPOSE_OPTIONS: Array<{
  value: VisitPurpose;
  title: string;
  description: string;
  icon: LucideIcon;
  tone: ChoiceTone;
}> = [
  {
    value: "consultation",
    title: "Check-up / Consultation",
    description: "Routine visit, follow-up, or doctor consultation.",
    icon: Stethoscope,
    tone: "blue",
  },
  {
    value: "diagnostic",
    title: "Diagnostic Assessment",
    description: "Laboratory tests, imaging, or a doctor's request slip.",
    icon: FlaskConical,
    tone: "green",
  },
  {
    value: "emergency",
    title: "Emergency / For Admission",
    description: "Urgent care, ER triage, or hospital admission.",
    icon: Siren,
    tone: "red",
  },
];

const PRIORITY_OPTIONS: Array<{
  value: PriorityLane;
  title: string;
  description: string;
}> = [
  {
    value: "regular",
    title: "Regular",
    description: "Standard queue",
  },
  {
    value: "senior_citizen",
    title: "Senior Citizen",
    description: "Priority lane",
  },
  {
    value: "pwd",
    title: "PWD",
    description: "Priority lane",
  },
  {
    value: "pregnant",
    title: "Pregnant",
    description: "Priority lane",
  },
];

const PAYMENT_OPTIONS: PaymentType[] = ["cash", "hmo", "philhealth"];

const CIVIL_STATUS_OPTIONS: Array<{
  value: CivilStatus;
  label: string;
}> = [
  { value: "single", label: "Single" },
  { value: "married", label: "Married" },
  { value: "widowed", label: "Widowed" },
  { value: "separated", label: "Separated" },
  { value: "other", label: "Other" },
];

const RELATIONSHIP_OPTIONS: Array<{
  value: GuardianRelationship;
  label: string;
}> = [
  { value: "parent", label: "Parent" },
  { value: "spouse", label: "Spouse" },
  { value: "child", label: "Child" },
  { value: "relative", label: "Relative" },
  { value: "other", label: "Other" },
];

const ROOM_OPTIONS: Array<{
  value: RoomPreference;
  label: string;
}> = [
  { value: "ward", label: "Ward" },
  { value: "semi_private", label: "Semi-Private" },
  { value: "private", label: "Private" },
  { value: "suite", label: "Suite" },
];

const ID_TYPE_OPTIONS = [
  "Philippine ID (PhilSys)",
  "Driver's License",
  "Passport",
  "UMID",
  "Company ID",
  "Other",
];

const FEATURES: Array<{
  icon: LucideIcon;
  title: string;
  description: string;
}> = [
  {
    icon: Users,
    title: "Patient or companion",
    description: "The form adapts to who is filling it out.",
  },
  {
    icon: ClipboardList,
    title: "One adaptive intake",
    description: "Check-up, diagnostics, or emergency care.",
  },
  {
    icon: Clock3,
    title: "Live queue ticket",
    description: "Your number and position update on your phone.",
  },
];

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm transition placeholder:text-gray-400 focus:border-medical-blue focus:outline-none focus:ring-4 focus:ring-medical-blue/10 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500";

type ChoiceTone = "blue" | "green" | "red";

const CHOICE_TONES: Record<
  ChoiceTone,
  { icon: string; selected: string; check: string }
> = {
  blue: {
    icon: "bg-medical-blue-light text-medical-blue-dark",
    selected: "border-medical-blue bg-medical-blue-light/30 ring-1 ring-medical-blue",
    check: "text-medical-blue",
  },
  green: {
    icon: "bg-soft-green-light text-soft-green-dark",
    selected: "border-soft-green bg-soft-green-light/30 ring-1 ring-soft-green",
    check: "text-soft-green-dark",
  },
  red: {
    icon: "bg-red-light text-red-dark",
    selected: "border-red bg-red-light/40 ring-1 ring-red",
    check: "text-red",
  },
};

function FieldLabel({
  htmlFor,
  children,
  optional = false,
  required = false,
}: {
  htmlFor?: string;
  children: ReactNode;
  optional?: boolean;
  required?: boolean;
}) {
  const text = (
    <span className="text-sm font-medium text-gray-700">
      {children}
      {required && <span className="ml-0.5 text-red">*</span>}
    </span>
  );

  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-3">
      {htmlFor ? <label htmlFor={htmlFor}>{text}</label> : text}
      {optional && (
        <span className="text-xs font-normal text-gray-400">Optional</span>
      )}
    </div>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-medical-blue-light text-medical-blue-dark">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-gray-500">
          {title}
        </h2>
        <p className="mt-0.5 text-sm text-gray-400">{description}</p>
      </div>
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`flex items-center justify-center rounded-2xl ${
          compact
            ? "h-10 w-10 bg-medical-blue text-white"
            : "h-11 w-11 bg-white/15 text-white backdrop-blur"
        }`}
      >
        <HeartPulse className="h-5 w-5" />
      </span>
      <div>
        <p
          className={`text-lg font-semibold tracking-tight ${
            compact ? "text-gray-900" : "text-white"
          }`}
        >
          AlimaCare
        </p>
        <p
          className={`text-xs ${compact ? "text-gray-400" : "text-white/75"}`}
        >
          Adaptive hospital intake
        </p>
      </div>
    </div>
  );
}

function ChoiceCard({
  selected,
  onSelect,
  icon: Icon,
  title,
  description,
  tone = "blue",
}: {
  selected: boolean;
  onSelect: () => void;
  icon: LucideIcon;
  title: string;
  description: string;
  tone?: ChoiceTone;
}) {
  const palette = CHOICE_TONES[tone];

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`group flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition ${
        selected
          ? palette.selected
          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
      }`}
    >
      <span
        className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
          selected ? palette.icon : "bg-gray-100 text-gray-500"
        }`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-gray-900">
          {title}
        </span>
        <span className="mt-0.5 block text-xs leading-5 text-gray-500">
          {description}
        </span>
      </span>
      <CheckCircle2
        className={`mt-0.5 h-5 w-5 shrink-0 ${
          selected ? palette.check : "text-transparent"
        }`}
      />
    </button>
  );
}

function ageFromDob(dob: string): number | null {
  if (!dob) return null;

  const birth = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const month = today.getMonth() - birth.getMonth();

  if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

export default function RegistrationPage() {
  const [step, setStep] = useState<Step>("router");
  const [role, setRole] = useState<RespondentRole | null>(null);
  const [purpose, setPurpose] = useState<VisitPurpose | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [created, setCreated] = useState<Patient | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signatureRef = useRef<SignaturePadHandle>(null);

  const computedAge = useMemo(() => ageFromDob(form.dob), [form.dob]);
  const isEmergency = purpose === "emergency";
  const isGuardian = role === "guardian";

  const update = <K extends keyof FormState>(
    key: K,
    value: FormState[K]
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleDobChange = (value: string) => {
    const age = ageFromDob(value);
    setForm((current) => ({
      ...current,
      dob: value,
      age: age !== null ? String(age) : "",
    }));
  };

  const handleUnknownToggle = (checked: boolean) => {
    setForm((current) => ({
      ...current,
      identityUnknown: checked,
      fullName: checked ? "Unknown / Unconscious" : "",
    }));
  };

  const scrollTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const startForm = () => {
    if (!role || !purpose) return;

    // Clear answers that only belong to a previous branch of the router.
    setForm((current) => {
      let next = current;

      if (purpose !== "emergency" && current.identityUnknown) {
        next = { ...next, identityUnknown: false, fullName: "" };
      }

      if (purpose !== "diagnostic") {
        next = { ...next, hasRequestSlip: "" };
      }

      if (purpose !== "emergency") {
        next = {
          ...next,
          employerName: "",
          roomPreference: "",
          guardianIdType: "",
        };
      }

      if (role !== "guardian" && purpose !== "emergency") {
        next = {
          ...next,
          guardianFullName: "",
          guardianContactNumber: "",
          guardianIdType: "",
        };
      }

      return next;
    });

    setError(null);
    setStep("form");
    scrollTop();
  };

  const backToRouter = () => {
    setError(null);
    setStep("router");
    scrollTop();
  };

  const resetForm = () => {
    setCreated(null);
    setStep("router");
    setRole(null);
    setPurpose(null);
    setForm(INITIAL_FORM);
    setError(null);
    signatureRef.current?.clear();
    scrollTop();
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!role || !purpose) {
      setStep("router");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (!form.consentGiven) {
        throw new Error("Please accept the data privacy consent.");
      }

      if (purpose === "diagnostic" && !form.hasRequestSlip) {
        throw new Error(
          "Please indicate whether you have a doctor's request slip."
        );
      }

      if (isGuardian && !form.guardianFullName.trim()) {
        throw new Error("Guardian full name is required.");
      }

      if (isGuardian && !form.guardianContactNumber.trim()) {
        throw new Error("Guardian mobile number is required.");
      }

      const signature = signatureRef.current?.toDataURL() ?? undefined;

      if (!isEmergency && !signature) {
        throw new Error("Please add your signature before submitting.");
      }

      if (form.dob) {
        const dobTime = new Date(`${form.dob}T00:00:00`).getTime();
        if (Number.isFinite(dobTime) && dobTime > Date.now()) {
          throw new Error("Date of birth cannot be in the future.");
        }
      }

      const age = computedAge ?? (form.age ? Number(form.age) : undefined);

      if (
        age === undefined ||
        !Number.isInteger(age) ||
        age < 0 ||
        age > 150
      ) {
        throw new Error(
          isEmergency
            ? "Enter an approximate age or a date of birth."
            : "Date of birth is required."
        );
      }

      const paymentType: PaymentType = isEmergency
        ? form.philhealthPin.trim()
          ? "philhealth"
          : form.hmoNo.trim()
            ? "hmo"
            : "cash"
        : form.paymentType;

      const payloadBody = {
        respondentRole: role,
        visitPurpose: purpose,
        fullName: form.identityUnknown
          ? "Unknown / Unconscious"
          : form.fullName.trim(),
        identityUnknown: isEmergency ? form.identityUnknown : false,
        dob: form.dob || undefined,
        age,
        sex: form.sex,
        civilStatus: isEmergency ? undefined : form.civilStatus,
        address: form.address.trim() || undefined,
        contactNumber: form.contactNumber.trim() || undefined,
        chiefComplaint: form.chiefComplaint.trim(),
        allergies: form.allergies.trim() || undefined,
        symptomDuration:
          purpose !== "diagnostic"
            ? form.symptomDuration.trim() || undefined
            : undefined,
        symptomSeverity:
          purpose !== "diagnostic" && form.symptomSeverity
            ? Number(form.symptomSeverity)
            : undefined,
        medicalHistory:
          purpose !== "diagnostic"
            ? form.medicalHistory.trim() || undefined
            : undefined,
        currentMedications:
          purpose !== "diagnostic"
            ? form.currentMedications.trim() || undefined
            : undefined,
        hasRequestSlip:
          purpose === "diagnostic" ? form.hasRequestSlip === "yes" : undefined,
        priorityLane: isEmergency ? "regular" : form.priorityLane,
        paymentType,
        hmoProvider: form.hmoProvider.trim() || undefined,
        hmoNo: form.hmoNo.trim() || undefined,
        philhealthPin: form.philhealthPin.trim() || undefined,
        employerName: isEmergency
          ? form.employerName.trim() || undefined
          : undefined,
        roomPreference:
          isEmergency && form.roomPreference
            ? form.roomPreference
            : undefined,
        emergencyContactName: !isEmergency
          ? form.emergencyContactName.trim() || undefined
          : undefined,
        emergencyContactRelationship: !isEmergency
          ? form.emergencyContactRelationship.trim() || undefined
          : undefined,
        emergencyContactNumber: !isEmergency
          ? form.emergencyContactNumber.trim() || undefined
          : undefined,
        guardianFullName:
          isGuardian || isEmergency
            ? form.guardianFullName.trim() || undefined
            : undefined,
        guardianRelationship:
          isGuardian ||
          (isEmergency && form.guardianFullName.trim())
            ? form.guardianRelationship
            : undefined,
        guardianContactNumber:
          isGuardian || isEmergency
            ? form.guardianContactNumber.trim() || undefined
            : undefined,
        guardianIdType: isEmergency
          ? form.guardianIdType.trim() || undefined
          : undefined,
        signatureData: signature,
        consentGiven: form.consentGiven,
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
      setStep("ticket");
      scrollTop();
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

  if (step === "ticket" && created) {
    return <IntakeTicket patient={created} onReset={resetForm} />;
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f3f7fc] px-4 py-8 sm:px-6 lg:px-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-medical-blue/10 blur-3xl" />
        <div className="absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-soft-green/10 blur-3xl" />
      </div>

      <div className="relative mx-auto grid w-full min-w-0 max-w-6xl gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <aside className="relative hidden overflow-hidden rounded-[2rem] bg-gradient-to-br from-medical-blue-dark via-medical-blue to-[#3b82f6] p-8 text-white shadow-xl shadow-medical-blue/20 lg:flex lg:flex-col lg:justify-between">
          <div
            aria-hidden="true"
            className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-white/5"
          />

          <div className="relative">
            <Brand />

            <div className="mt-16 max-w-sm">
              <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
                <Clock3 className="h-3.5 w-3.5" />
                About 2 minutes to complete
              </p>
              <h1 className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight">
                One form. Every kind of visit.
              </h1>
              <p className="mt-4 text-sm leading-6 text-white/75">
                Whether you are the patient or a companion, the intake adapts
                to your visit — then gives you a live queue ticket you can
                track from your phone.
              </p>
            </div>

            <ul className="mt-10 space-y-4">
              {FEATURES.map((feature) => {
                const Icon = feature.icon;
                return (
                  <li key={feature.title} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                      <Icon className="h-4 w-4 text-white/85" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {feature.title}
                      </p>
                      <p className="mt-0.5 text-xs leading-5 text-white/75">
                        {feature.description}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="relative mt-12 space-y-4">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-white/80" />
                <p className="text-xs leading-5 text-white/75">
                  Your information is kept private and is only used to manage
                  this visit.
                </p>
              </div>
            </div>
            <p className="flex items-start gap-2 text-xs leading-5 text-white/70">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              For life-threatening emergencies, approach the nearest staff
              member immediately.
            </p>
          </div>
        </aside>

        <section className="min-w-0 rounded-[2rem] border border-white/70 bg-white/90 p-5 shadow-xl shadow-slate-200/60 backdrop-blur sm:p-8">
          <div className="mb-6 lg:hidden">
            <Brand compact />
          </div>

          {step === "router" ? (
            <div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-medical-blue">
                    Step 1 of 2
                  </p>
                  <h2 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                    Let&apos;s route your visit
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Two quick questions help us show only the fields you need.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-soft-green-light px-3 py-1 text-xs font-semibold text-soft-green-dark">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Secure intake
                </span>
              </div>

              <div className="mt-7">
                <h3 className="text-sm font-semibold text-gray-900">
                  Who is filling out this form?
                </h3>
                <p className="mt-0.5 text-xs text-gray-400">
                  This changes whose details we ask for first.
                </p>
                <div
                  role="radiogroup"
                  aria-label="Who is filling out this form?"
                  className="mt-3 grid gap-3 sm:grid-cols-2"
                >
                  {ROLE_OPTIONS.map((option) => (
                    <ChoiceCard
                      key={option.value}
                      selected={role === option.value}
                      onSelect={() => setRole(option.value)}
                      icon={option.icon}
                      title={option.title}
                      description={option.description}
                    />
                  ))}
                </div>
              </div>

              <div className="mt-7">
                <h3 className="text-sm font-semibold text-gray-900">
                  What brings you in today?
                </h3>
                <p className="mt-0.5 text-xs text-gray-400">
                  Emergency visits switch to a fast-track form.
                </p>
                <div
                  role="radiogroup"
                  aria-label="What brings you in today?"
                  className="mt-3 space-y-3"
                >
                  {PURPOSE_OPTIONS.map((option) => (
                    <ChoiceCard
                      key={option.value}
                      selected={purpose === option.value}
                      onSelect={() => setPurpose(option.value)}
                      icon={option.icon}
                      title={option.title}
                      description={option.description}
                      tone={option.tone}
                    />
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={startForm}
                disabled={!role || !purpose}
                className="group mt-7 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-medical-blue px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-medical-blue/20 transition hover:bg-medical-blue-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-medical-blue focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </button>

              <p className="mt-4 text-center text-xs leading-5 text-gray-400">
                If this is a life-threatening emergency, go straight to ER
                triage. Do not wait to finish the form.
              </p>
            </div>
          ) : (
            <div>
              <button
                type="button"
                onClick={backToRouter}
                className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 transition hover:text-gray-900"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Change answers
              </button>

              <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-medical-blue">
                    Step 2 of 2
                  </p>
                  <h2 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                    {isEmergency
                      ? "Emergency intake"
                      : isGuardian
                        ? "Patient & guardian details"
                        : "Tell us about your visit"}
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Fields marked with <span className="text-red">*</span> are
                    required.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-soft-green-light px-3 py-1 text-xs font-semibold text-soft-green-dark">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Secure form
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                  {isGuardian ? (
                    <Users className="h-3.5 w-3.5" />
                  ) : (
                    <User className="h-3.5 w-3.5" />
                  )}
                  {isGuardian ? "Guardian / companion" : "Self"}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    isEmergency
                      ? "bg-red-light text-red-dark"
                      : "bg-medical-blue-light text-medical-blue-dark"
                  }`}
                >
                  {isEmergency ? (
                    <Siren className="h-3.5 w-3.5" />
                  ) : (
                    <ClipboardList className="h-3.5 w-3.5" />
                  )}
                  {purpose ? VISIT_PURPOSE_LABELS[purpose] : ""}
                </span>
              </div>

              {isEmergency && (
                <div className="mt-5 overflow-hidden rounded-2xl border border-red-200 bg-red-light">
                  <div className="flex items-start gap-3 p-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red text-white">
                      <Siren className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-red-dark">
                        Emergency? Go straight to ER triage.
                      </p>
                      <p className="mt-1 text-xs leading-5 text-red-dark/80">
                        If the patient has chest pain, difficulty breathing,
                        severe bleeding, or is unconscious, do not wait to
                        finish this form. Staff will assist you at the
                        emergency room.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={onSubmit} className="mt-6 space-y-7">
                <fieldset
                  disabled={submitting}
                  className="m-0 space-y-7 border-0 p-0"
                >
                  {isGuardian && (
                    <>
                      <section className="space-y-4">
                        <SectionHeading
                          icon={Users}
                          title={
                            isEmergency
                              ? "Guardian / informant"
                              : "Guardian details"
                          }
                          description={
                            isEmergency
                              ? "Who is with the patient right now?"
                              : "The person filling out this form for the patient."
                          }
                        />

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="sm:col-span-2">
                            <FieldLabel
                              htmlFor="guardianFullName"
                              required
                            >
                              Full name
                            </FieldLabel>
                            <input
                              id="guardianFullName"
                              type="text"
                              autoComplete="name"
                              placeholder="e.g. Ana Santos"
                              value={form.guardianFullName}
                              onChange={(event) =>
                                update("guardianFullName", event.target.value)
                              }
                              className={inputClass}
                              maxLength={120}
                              required
                            />
                          </div>

                          <div>
                            <FieldLabel
                              htmlFor="guardianRelationship"
                              required
                            >
                              Relationship to patient
                            </FieldLabel>
                            <select
                              id="guardianRelationship"
                              value={form.guardianRelationship}
                              onChange={(event) =>
                                update(
                                  "guardianRelationship",
                                  event.target
                                    .value as GuardianRelationship
                                )
                              }
                              className={inputClass}
                              required
                            >
                              {RELATIONSHIP_OPTIONS.map((option) => (
                                <option
                                  key={option.value}
                                  value={option.value}
                                >
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <FieldLabel
                              htmlFor="guardianContactNumber"
                              required
                            >
                              Mobile number
                            </FieldLabel>
                            <input
                              id="guardianContactNumber"
                              type="tel"
                              inputMode="tel"
                              autoComplete="tel"
                              placeholder="+63 912 345 6789"
                              value={form.guardianContactNumber}
                              onChange={(event) =>
                                update(
                                  "guardianContactNumber",
                                  event.target.value
                                )
                              }
                              className={inputClass}
                              pattern="(?:[0-9]|\+|\s|\(|\)|-){7,20}"
                              minLength={7}
                              maxLength={20}
                              required
                            />
                          </div>

                          {isEmergency && (
                            <div className="sm:col-span-2">
                              <FieldLabel
                                htmlFor="guardianIdType"
                                optional
                              >
                                Valid ID type
                              </FieldLabel>
                              <select
                                id="guardianIdType"
                                value={form.guardianIdType}
                                onChange={(event) =>
                                  update(
                                    "guardianIdType",
                                    event.target.value
                                  )
                                }
                                className={inputClass}
                              >
                                <option value="">Select ID type</option>
                                {ID_TYPE_OPTIONS.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      </section>

                      <div className="h-px bg-gray-100" />
                    </>
                  )}

                  <section className="space-y-4">
                    <SectionHeading
                      icon={User}
                      title="Patient identity"
                      description={
                        isEmergency
                          ? "Fast-track what you know. Staff will complete the rest."
                          : "Use the patient's full legal name."
                      }
                    />

                    {isEmergency && (
                      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-orange/30 bg-orange-light/40 p-3">
                        <input
                          type="checkbox"
                          checked={form.identityUnknown}
                          onChange={(event) =>
                            handleUnknownToggle(event.target.checked)
                          }
                          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-medical-blue focus:ring-medical-blue"
                        />
                        <span>
                          <span className="block text-sm font-semibold text-gray-900">
                            Unknown / unconscious patient
                          </span>
                          <span className="text-xs leading-5 text-gray-500">
                            Check this if the patient cannot be identified
                            right now.
                          </span>
                        </span>
                      </label>
                    )}

                    <div>
                      <FieldLabel
                        htmlFor="fullName"
                        required={!form.identityUnknown}
                      >
                        Patient full name
                      </FieldLabel>
                      <div className="relative">
                        <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input
                          id="fullName"
                          type="text"
                          autoComplete="name"
                          placeholder="e.g. Maria Santos"
                          value={form.fullName}
                          onChange={(event) =>
                            update("fullName", event.target.value)
                          }
                          className={`${inputClass} pl-10`}
                          maxLength={120}
                          disabled={form.identityUnknown}
                          required={!form.identityUnknown}
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <FieldLabel
                          htmlFor="dob"
                          required={!isEmergency}
                          optional={isEmergency}
                        >
                          Date of birth
                        </FieldLabel>
                        <div className="relative">
                          <CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                          <input
                            id="dob"
                            type="date"
                            value={form.dob}
                            onChange={(event) =>
                              handleDobChange(event.target.value)
                            }
                            className={`${inputClass} pl-10`}
                            required={!isEmergency}
                          />
                        </div>
                      </div>

                      <div>
                        <FieldLabel
                          htmlFor="age"
                          required={isEmergency && !form.dob}
                        >
                          {isEmergency ? "Approximate age" : "Age"}
                        </FieldLabel>
                        <input
                          id="age"
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={150}
                          placeholder="e.g. 34"
                          value={form.age}
                          onChange={(event) =>
                            update("age", event.target.value)
                          }
                          className={inputClass}
                          readOnly={Boolean(form.dob)}
                          required={isEmergency && !form.dob}
                        />
                        {form.dob && (
                          <p className="mt-1.5 text-xs text-gray-400">
                            Auto-calculated from date of birth.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <FieldLabel htmlFor="sex" required>
                          Sex
                        </FieldLabel>
                        <select
                          id="sex"
                          value={form.sex}
                          onChange={(event) =>
                            update("sex", event.target.value as Sex)
                          }
                          className={inputClass}
                          required
                        >
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      {!isEmergency && (
                        <div>
                          <FieldLabel htmlFor="civilStatus" required>
                            Civil status
                          </FieldLabel>
                          <select
                            id="civilStatus"
                            value={form.civilStatus}
                            onChange={(event) =>
                              update(
                                "civilStatus",
                                event.target.value as CivilStatus
                              )
                            }
                            className={inputClass}
                            required
                          >
                            {CIVIL_STATUS_OPTIONS.map((option) => (
                              <option
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {!isEmergency && (
                      <>
                        <div>
                          <FieldLabel htmlFor="address" required>
                            Home address
                          </FieldLabel>
                          <div className="relative">
                            <MapPin className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" />
                            <input
                              id="address"
                              type="text"
                              autoComplete="street-address"
                              placeholder="House no., street, barangay, city"
                              value={form.address}
                              onChange={(event) =>
                                update("address", event.target.value)
                              }
                              className={`${inputClass} pl-10`}
                              maxLength={240}
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <FieldLabel
                            htmlFor="contactNumber"
                            required={!isGuardian}
                            optional={isGuardian}
                          >
                            Patient mobile number
                          </FieldLabel>
                          <div className="relative">
                            <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <input
                              id="contactNumber"
                              type="tel"
                              inputMode="tel"
                              autoComplete="tel"
                              placeholder="+63 912 345 6789"
                              value={form.contactNumber}
                              onChange={(event) =>
                                update("contactNumber", event.target.value)
                              }
                              className={`${inputClass} pl-10`}
                              pattern="(?:[0-9]|\+|\s|\(|\)|-){7,20}"
                              minLength={7}
                              maxLength={20}
                              required={!isGuardian}
                            />
                          </div>
                          {isGuardian && (
                            <p className="mt-1.5 text-xs text-gray-400">
                              Optional for minors or patients without a phone.
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </section>

                  <div className="h-px bg-gray-100" />

                  <section className="space-y-4">
                    <SectionHeading
                      icon={ClipboardList}
                      title="Visit information"
                      description="Tell the care team what is happening."
                    />

                    <div>
                      <FieldLabel htmlFor="chiefComplaint" required>
                        {isEmergency
                          ? "Symptoms / incident"
                          : "Chief complaint"}
                      </FieldLabel>
                      <textarea
                        id="chiefComplaint"
                        rows={3}
                        placeholder={
                          isEmergency
                            ? "e.g. Chest pain since 30 minutes ago"
                            : "e.g. Fever and cough for three days"
                        }
                        value={form.chiefComplaint}
                        onChange={(event) =>
                          update("chiefComplaint", event.target.value)
                        }
                        className={inputClass}
                        maxLength={500}
                        required
                      />
                    </div>

                    <div>
                      <FieldLabel htmlFor="allergies" optional>
                        Known allergies
                      </FieldLabel>
                      <textarea
                        id="allergies"
                        rows={2}
                        placeholder="e.g. Penicillin, shellfish — or write 'None known'"
                        value={form.allergies}
                        onChange={(event) =>
                          update("allergies", event.target.value)
                        }
                        className={inputClass}
                        maxLength={500}
                      />
                    </div>

                    {purpose !== "diagnostic" && (
                      <>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <FieldLabel htmlFor="symptomDuration" optional>
                              How long have you had these symptoms?
                            </FieldLabel>
                            <input
                              id="symptomDuration"
                              type="text"
                              placeholder="e.g. 3 days, since this morning"
                              value={form.symptomDuration}
                              onChange={(event) =>
                                update("symptomDuration", event.target.value)
                              }
                              className={inputClass}
                              maxLength={200}
                            />
                          </div>
                          <div>
                            <FieldLabel htmlFor="symptomSeverity" optional>
                              How severe is it? (1 = mild, 10 = worst)
                            </FieldLabel>
                            <select
                              id="symptomSeverity"
                              value={form.symptomSeverity}
                              onChange={(event) =>
                                update("symptomSeverity", event.target.value)
                              }
                              className={inputClass}
                            >
                              <option value="">Not sure / skip</option>
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                                <option key={n} value={n}>
                                  {n}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <FieldLabel htmlFor="medicalHistory" optional>
                            Medical history / existing conditions
                          </FieldLabel>
                          <textarea
                            id="medicalHistory"
                            rows={2}
                            placeholder="e.g. Hypertension, diabetes, asthma — or write 'None'"
                            value={form.medicalHistory}
                            onChange={(event) =>
                              update("medicalHistory", event.target.value)
                            }
                            className={inputClass}
                            maxLength={1000}
                          />
                        </div>

                        <div>
                          <FieldLabel htmlFor="currentMedications" optional>
                            Current medications
                          </FieldLabel>
                          <textarea
                            id="currentMedications"
                            rows={2}
                            placeholder="e.g. Losartan 50 mg daily — or write 'None'"
                            value={form.currentMedications}
                            onChange={(event) =>
                              update("currentMedications", event.target.value)
                            }
                            className={inputClass}
                            maxLength={1000}
                          />
                        </div>
                      </>
                    )}

                    {purpose === "diagnostic" && (
                      <div>
                        <FieldLabel required>
                          Do you have a doctor&apos;s request slip?
                        </FieldLabel>
                        <div
                          role="radiogroup"
                          aria-label="Doctor's request slip"
                          className="grid gap-3 sm:grid-cols-2"
                        >
                          <ChoiceCard
                            selected={form.hasRequestSlip === "yes"}
                            onSelect={() =>
                              update("hasRequestSlip", "yes")
                            }
                            icon={CheckCircle2}
                            title="Yes, I have a slip"
                            description="A request from my doctor for tests or imaging."
                            tone="green"
                          />
                          <ChoiceCard
                            selected={form.hasRequestSlip === "no"}
                            onSelect={() => update("hasRequestSlip", "no")}
                            icon={AlertCircle}
                            title="No slip yet"
                            description="I will ask the doctor or reception for one."
                            tone="blue"
                          />
                        </div>
                      </div>
                    )}
                  </section>

                  <div className="h-px bg-gray-100" />

                  {isEmergency ? (
                    <section className="space-y-4">
                      <SectionHeading
                        icon={BedDouble}
                        title="Admission & billing"
                        description="Share what you know now; admitting can complete the rest."
                      />

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <FieldLabel htmlFor="philhealthPin" optional>
                            PhilHealth PIN
                          </FieldLabel>
                          <input
                            id="philhealthPin"
                            type="text"
                            inputMode="numeric"
                            placeholder="e.g. 12-345678901-2"
                            value={form.philhealthPin}
                            onChange={(event) =>
                              update("philhealthPin", event.target.value)
                            }
                            className={inputClass}
                            maxLength={40}
                          />
                        </div>

                        <div>
                          <FieldLabel htmlFor="hmoNo" optional>
                            HMO card / number
                          </FieldLabel>
                          <input
                            id="hmoNo"
                            type="text"
                            placeholder="e.g. Maxicare 00012345"
                            value={form.hmoNo}
                            onChange={(event) =>
                              update("hmoNo", event.target.value)
                            }
                            className={inputClass}
                            maxLength={40}
                          />
                        </div>

                        <div>
                          <FieldLabel htmlFor="employerName" optional>
                            Employer name
                          </FieldLabel>
                          <input
                            id="employerName"
                            type="text"
                            placeholder="e.g. ABC Corporation"
                            value={form.employerName}
                            onChange={(event) =>
                              update("employerName", event.target.value)
                            }
                            className={inputClass}
                            maxLength={120}
                          />
                        </div>

                        <div>
                          <FieldLabel htmlFor="roomPreference" optional>
                            Preferred room
                          </FieldLabel>
                          <select
                            id="roomPreference"
                            value={form.roomPreference}
                            onChange={(event) =>
                              update(
                                "roomPreference",
                                event.target.value as RoomPreference | ""
                              )
                            }
                            className={inputClass}
                          >
                            <option value="">No preference</option>
                            {ROOM_OPTIONS.map((option) => (
                              <option
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {!isGuardian && (
                        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                          <div className="flex items-start gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-medical-blue shadow-sm ring-1 ring-gray-200">
                              <Users className="h-4 w-4" />
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">
                                Informant / guarantor
                              </p>
                              <p className="text-xs leading-5 text-gray-500">
                                Optional. Add a companion we can contact.
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 grid gap-4 sm:grid-cols-2">
                            <div>
                              <FieldLabel
                                htmlFor="informantName"
                                optional
                              >
                                Full name
                              </FieldLabel>
                              <input
                                id="informantName"
                                type="text"
                                placeholder="e.g. Ana Santos"
                                value={form.guardianFullName}
                                onChange={(event) =>
                                  update(
                                    "guardianFullName",
                                    event.target.value
                                  )
                                }
                                className={inputClass}
                                maxLength={120}
                              />
                            </div>

                            <div>
                              <FieldLabel
                                htmlFor="informantRelationship"
                                optional
                              >
                                Relationship
                              </FieldLabel>
                              <select
                                id="informantRelationship"
                                value={form.guardianRelationship}
                                onChange={(event) =>
                                  update(
                                    "guardianRelationship",
                                    event.target
                                      .value as GuardianRelationship
                                  )
                                }
                                className={inputClass}
                              >
                                {RELATIONSHIP_OPTIONS.map((option) => (
                                  <option
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <FieldLabel
                                htmlFor="informantContact"
                                optional
                              >
                                Mobile number
                              </FieldLabel>
                              <input
                                id="informantContact"
                                type="tel"
                                inputMode="tel"
                                placeholder="+63 912 345 6789"
                                value={form.guardianContactNumber}
                                onChange={(event) =>
                                  update(
                                    "guardianContactNumber",
                                    event.target.value
                                  )
                                }
                                className={inputClass}
                                pattern="(?:[0-9]|\+|\s|\(|\)|-){7,20}"
                                minLength={7}
                                maxLength={20}
                              />
                            </div>

                            <div>
                              <FieldLabel
                                htmlFor="informantIdType"
                                optional
                              >
                                Valid ID type
                              </FieldLabel>
                              <select
                                id="informantIdType"
                                value={form.guardianIdType}
                                onChange={(event) =>
                                  update(
                                    "guardianIdType",
                                    event.target.value
                                  )
                                }
                                className={inputClass}
                              >
                                <option value="">Select ID type</option>
                                {ID_TYPE_OPTIONS.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      )}
                    </section>
                  ) : (
                    <>
                      <section className="space-y-4">
                        <SectionHeading
                          icon={CreditCard}
                          title="Priority & billing"
                          description="This helps us route your ticket fairly."
                        />

                        <div>
                          <FieldLabel required>Priority lane</FieldLabel>
                          <div
                            role="radiogroup"
                            aria-label="Priority lane"
                            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                          >
                            {PRIORITY_OPTIONS.map((option) => {
                              const selected =
                                form.priorityLane === option.value;

                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  role="radio"
                                  aria-checked={selected}
                                  onClick={() =>
                                    update("priorityLane", option.value)
                                  }
                                  className={`rounded-xl border px-3 py-2.5 text-left transition ${
                                    selected
                                      ? "border-medical-blue bg-medical-blue-light/40 ring-1 ring-medical-blue"
                                      : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                                  }`}
                                >
                                  <span className="block text-sm font-semibold text-gray-900">
                                    {option.title}
                                  </span>
                                  <span className="mt-0.5 block text-[11px] leading-4 text-gray-500">
                                    {option.description}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <FieldLabel required>Payment type</FieldLabel>
                          <div
                            role="radiogroup"
                            aria-label="Payment type"
                            className="grid grid-cols-3 gap-2"
                          >
                            {PAYMENT_OPTIONS.map((option) => {
                              const selected =
                                form.paymentType === option;

                              return (
                                <button
                                  key={option}
                                  type="button"
                                  role="radio"
                                  aria-checked={selected}
                                  onClick={() =>
                                    update("paymentType", option)
                                  }
                                  className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                                    selected
                                      ? "border-medical-blue bg-medical-blue-light/40 text-medical-blue-dark ring-1 ring-medical-blue"
                                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                                  }`}
                                >
                                  {PAYMENT_TYPE_LABELS[option]}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {form.paymentType === "hmo" && (
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <FieldLabel
                                htmlFor="hmoProvider"
                                optional
                              >
                                HMO provider
                              </FieldLabel>
                              <input
                                id="hmoProvider"
                                type="text"
                                placeholder="e.g. Maxicare"
                                value={form.hmoProvider}
                                onChange={(event) =>
                                  update(
                                    "hmoProvider",
                                    event.target.value
                                  )
                                }
                                className={inputClass}
                                maxLength={120}
                              />
                            </div>

                            <div>
                              <FieldLabel htmlFor="hmoNo" required>
                                HMO / member number
                              </FieldLabel>
                              <input
                                id="hmoNo"
                                type="text"
                                placeholder="e.g. 00012345"
                                value={form.hmoNo}
                                onChange={(event) =>
                                  update("hmoNo", event.target.value)
                                }
                                className={inputClass}
                                maxLength={40}
                                required
                              />
                            </div>
                          </div>
                        )}

                        {form.paymentType === "philhealth" && (
                          <div>
                            <FieldLabel htmlFor="philhealthPin" required>
                              PhilHealth PIN
                            </FieldLabel>
                            <input
                              id="philhealthPin"
                              type="text"
                              inputMode="numeric"
                              placeholder="e.g. 12-345678901-2"
                              value={form.philhealthPin}
                              onChange={(event) =>
                                update(
                                  "philhealthPin",
                                  event.target.value
                                )
                              }
                              className={inputClass}
                              maxLength={40}
                              required
                            />
                          </div>
                        )}
                      </section>

                      <div className="h-px bg-gray-100" />

                      <section className="space-y-4">
                        <SectionHeading
                          icon={Phone}
                          title="Emergency contact"
                          description="Someone we can reach if we cannot contact you."
                        />

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <FieldLabel
                              htmlFor="emergencyContactName"
                              required
                            >
                              Full name
                            </FieldLabel>
                            <input
                              id="emergencyContactName"
                              type="text"
                              placeholder="e.g. Ana Santos"
                              value={form.emergencyContactName}
                              onChange={(event) =>
                                update(
                                  "emergencyContactName",
                                  event.target.value
                                )
                              }
                              className={inputClass}
                              maxLength={120}
                              required
                            />
                          </div>

                          <div>
                            <FieldLabel
                              htmlFor="emergencyContactRelationship"
                              required
                            >
                              Relationship
                            </FieldLabel>
                            <input
                              id="emergencyContactRelationship"
                              type="text"
                              placeholder="e.g. Spouse"
                              value={form.emergencyContactRelationship}
                              onChange={(event) =>
                                update(
                                  "emergencyContactRelationship",
                                  event.target.value
                                )
                              }
                              className={inputClass}
                              maxLength={60}
                              required
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <FieldLabel
                              htmlFor="emergencyContactNumber"
                              required
                            >
                              Contact number
                            </FieldLabel>
                            <input
                              id="emergencyContactNumber"
                              type="tel"
                              inputMode="tel"
                              placeholder="+63 912 345 6789"
                              value={form.emergencyContactNumber}
                              onChange={(event) =>
                                update(
                                  "emergencyContactNumber",
                                  event.target.value
                                )
                              }
                              className={inputClass}
                              pattern="(?:[0-9]|\+|\s|\(|\)|-){7,20}"
                              minLength={7}
                              maxLength={20}
                              required
                            />
                          </div>
                        </div>
                      </section>
                    </>
                  )}

                  <div className="h-px bg-gray-100" />

                  <section className="space-y-4">
                    <SectionHeading
                      icon={PenLine}
                      title="Consent & signature"
                      description={
                        isEmergency
                          ? "ER care / admission consent."
                          : isGuardian
                            ? "Signing on behalf of the patient."
                            : "Confirm and sign your intake."
                      }
                    />

                    <div>
                      <FieldLabel
                        required={!isEmergency}
                        optional={isEmergency}
                      >
                        {isGuardian ? "Guardian signature" : "Patient signature"}
                      </FieldLabel>
                      <SignaturePad ref={signatureRef} />
                      {isEmergency && (
                        <p className="mt-1.5 text-xs leading-5 text-orange-dark">
                          If the patient cannot sign, staff will record verbal
                          consent at triage.
                        </p>
                      )}
                      {isGuardian && !isEmergency && (
                        <p className="mt-1.5 text-xs leading-5 text-gray-400">
                          By signing, you confirm you are authorized to provide
                          information for this patient.
                        </p>
                      )}
                    </div>

                    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <input
                        type="checkbox"
                        checked={form.consentGiven}
                        onChange={(event) =>
                          update("consentGiven", event.target.checked)
                        }
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-medical-blue focus:ring-medical-blue"
                        required
                      />
                      <span className="text-xs leading-5 text-gray-600">
                        <span className="font-semibold text-gray-900">
                          {isEmergency
                            ? "Emergency care consent."
                            : "Data privacy consent."}
                        </span>{" "}
                        {isEmergency ? (
                          <>
                            I consent to the patient receiving emergency
                            assessment and treatment, and to AlimaCare
                            collecting and processing these details for this
                            visit in line with the Data Privacy Act of 2012 (RA
                            10173).
                          </>
                        ) : (
                          <>
                            I consent to AlimaCare collecting and processing
                            these details for{" "}
                            {isGuardian ? "the patient's" : "my"} visit, in
                            line with the Data Privacy Act of 2012 (RA 10173).
                            I understand my information is shared only with the
                            care team handling this visit.
                          </>
                        )}
                      </span>
                    </label>
                  </section>

                  {error && (
                    <div
                      role="alert"
                      className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-light px-4 py-3 text-sm text-red-dark"
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}
                </fieldset>

                <div className="space-y-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-medical-blue px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-medical-blue/20 transition hover:bg-medical-blue-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-medical-blue focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Submitting your intake…
                      </>
                    ) : (
                      <>
                        Submit intake & get ticket
                        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                      </>
                    )}
                  </button>
                  <p className="text-center text-xs leading-5 text-gray-400">
                    By submitting, you confirm that the information above is
                    accurate. Your details are handled confidentially.
                  </p>
                </div>
              </form>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
