import type { Metadata } from "next";
import { Suspense } from "react";

import { PatientDetailView } from "@/components/admin/PatientDetailView";
import { PageLoading } from "@/components/ui/Loading";

export const metadata: Metadata = { title: "Patient" };

export default function PatientDetailPage() {
  return (
    <Suspense fallback={<PageLoading label="Loading patient…" />}>
      <PatientDetailView />
    </Suspense>
  );
}
