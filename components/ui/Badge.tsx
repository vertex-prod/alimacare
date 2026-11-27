import type { ReactNode } from "react";

import { cn } from "@/lib/format";
import {
  PRIORITY_LANE_LABELS,
  STATUS_LABELS,
  STATUS_TONES,
  VISIT_PURPOSE_SHORT_LABELS,
  type BadgeTone,
} from "@/lib/labels";
import type { AppointmentStatus, PriorityLane, VisitPurpose } from "@/lib/types";

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}

const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-gray-100 text-gray-700",
  info: "bg-medical-blue-light text-medical-blue-dark",
  success: "bg-soft-green-light text-soft-green-dark",
  warning: "bg-orange-light text-orange-dark",
  danger: "bg-red-light text-red-dark",
  muted: "bg-gray-200 text-gray-600",
};

const dotToneClasses: Record<BadgeTone, string> = {
  neutral: "bg-gray-400",
  info: "bg-medical-blue",
  success: "bg-soft-green",
  warning: "bg-orange",
  danger: "bg-red",
  muted: "bg-gray-400",
};

export function Badge({
  tone = "neutral",
  children,
  className,
  dot = false,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold",
        toneClasses[tone],
        className
      )}
    >
      {dot ? (
        <span className={cn("h-1.5 w-1.5 rounded-full", dotToneClasses[tone])} />
      ) : null}
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <Badge tone={STATUS_TONES[status]} dot>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function PriorityBadge({ lane }: { lane: PriorityLane }) {
  return (
    <Badge tone={lane === "regular" ? "neutral" : "info"}>
      {PRIORITY_LANE_LABELS[lane]}
    </Badge>
  );
}

export function PurposeBadge({ purpose }: { purpose: VisitPurpose }) {
  const tone: BadgeTone =
    purpose === "emergency"
      ? "danger"
      : purpose === "diagnostic"
        ? "info"
        : "neutral";

  return <Badge tone={tone}>{VISIT_PURPOSE_SHORT_LABELS[purpose]}</Badge>;
}

export function DepartmentBadge({ code }: { code: string }) {
  const tone: BadgeTone =
    code === "ER" ? "danger" : code === "LAB" ? "info" : "neutral";

  return (
    <Badge tone={tone} className="font-mono">
      {code}
    </Badge>
  );
}
