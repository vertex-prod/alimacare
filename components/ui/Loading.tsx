import { Loader2 } from "lucide-react";

import { cn } from "@/lib/format";

export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      className={cn("h-4 w-4 animate-spin", className)}
      aria-hidden="true"
    />
  );
}

export function PageLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-sm text-gray-500">
      <Spinner className="h-6 w-6 text-medical-blue" />
      <p>{label}</p>
    </div>
  );
}

export function CardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="h-24 animate-pulse rounded-xl border border-gray-200 bg-white"
        />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="h-10 animate-pulse rounded-lg bg-gray-100"
        />
      ))}
    </div>
  );
}
