import type { ReactNode } from "react";
import type { AppointmentStatus } from "@/lib/types";

type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "muted";

interface BadgeProps {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}

const toneClasses: Record<Tone, string> = {
  neutral: "bg-gray-100 text-gray-700",
  info: "bg-medical-blue-light text-medical-blue-dark",
  success: "bg-soft-green-light text-soft-green-dark",
  warning: "bg-orange-light text-orange-dark",
  danger: "bg-red-light text-red-dark",
  muted: "bg-gray-200 text-gray-600",
};

const dotToneClasses: Record<Tone, string> = {
  neutral: "bg-gray-400",
  info: "bg-medical-blue",
  success: "bg-soft-green",
  warning: "bg-orange",
  danger: "bg-red",
  muted: "bg-gray-400",
};

export function Badge({ tone = "neutral", children, className = "", dot = false }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${toneClasses[tone]} ${className}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotToneClasses[tone]}`} />}
      {children}
    </span>
  );
}

const statusToneMap: Record<AppointmentStatus, Tone> = {
  PENDING_RECEPTION: "warning",
  APPROVED: "info",
  WAITING: "warning",
  CALLED: "success",
  ONGOING: "info",
  COMPLETED: "success",
  CANCELLED: "muted",
  NO_SHOW: "danger",
  ARCHIVED: "neutral",
};

const statusLabelMap: Record<AppointmentStatus, string> = {
  PENDING_RECEPTION: "Pending Reception",
  APPROVED: "Approved",
  WAITING: "Waiting",
  CALLED: "Called",
  ONGOING: "Ongoing",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
  ARCHIVED: "Archived",
};

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <Badge tone={statusToneMap[status]} dot>
      {statusLabelMap[status]}
    </Badge>
  );
}