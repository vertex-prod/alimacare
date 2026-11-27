import type { Metadata } from "next";

import { PatientsView } from "@/components/admin/PatientsView";

export const metadata: Metadata = { title: "Patient records" };

export default function PatientsPage() {
  return <PatientsView />;
}
