import type { Metadata } from "next";
import { Suspense } from "react";

import { ExportView } from "@/components/admin/ExportView";
import { PageLoading } from "@/components/ui/Loading";

export const metadata: Metadata = { title: "Export" };

export default function ExportPage() {
  // ExportView defaults the range to today's date, so it renders per request
  // instead of being frozen into the prerendered shell.
  return (
    <Suspense fallback={<PageLoading />}>
      <ExportView />
    </Suspense>
  );
}
