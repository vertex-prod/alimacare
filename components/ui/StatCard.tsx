import type { ReactNode } from "react";

import { cn } from "@/lib/format";
import { Card } from "./Card";

type Tone =
  | "blue"
  | "green"
  | "orange"
  | "red"
  | "gray"
  | "info"
  | "success";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: ReactNode;
  tone?: Tone;
  hint?: string;
  className?: string;
}

const toneMap: Record<Tone, { ring: string; icon: string; value: string }> = {
  blue: {
    ring: "bg-medical-blue-light",
    icon: "text-medical-blue-dark",
    value: "text-medical-blue-dark",
  },
  green: {
    ring: "bg-soft-green-light",
    icon: "text-soft-green-dark",
    value: "text-soft-green-dark",
  },
  orange: {
    ring: "bg-orange-light",
    icon: "text-orange-dark",
    value: "text-orange-dark",
  },
  red: {
    ring: "bg-red-light",
    icon: "text-red-dark",
    value: "text-red-dark",
  },
  gray: {
    ring: "bg-gray-100",
    icon: "text-gray-600",
    value: "text-gray-900",
  },
  info: {
    ring: "bg-medical-blue-light",
    icon: "text-medical-blue-dark",
    value: "text-medical-blue-dark",
  },
  success: {
    ring: "bg-soft-green-light",
    icon: "text-soft-green-dark",
    value: "text-soft-green-dark",
  },
};

export function StatCard({
  label,
  value,
  icon,
  tone = "blue",
  hint,
  className,
}: StatCardProps) {
  const styles = toneMap[tone];

  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
            styles.ring
          )}
        >
          <span className={cn(styles.icon, "[&>svg]:h-5 [&>svg]:w-5")}>
            {icon}
          </span>
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-gray-500">{label}</p>
          <p className={cn("text-2xl font-bold leading-tight", styles.value)}>
            {value}
          </p>
          {hint ? (
            <p className="text-[11px] text-gray-400">{hint}</p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
