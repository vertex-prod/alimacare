import { Suspense } from "react";
import { Hourglass } from "lucide-react";
import { PatientStatusClient } from "@/components/patient/PatientStatusClient";

function LoadingStatus() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Hourglass className="w-12 h-12 text-medical-blue mx-auto mb-4 animate-spin" />
        <p className="text-gray-600">Loading patient status…</p>
      </div>
    </main>
  );
}

async function PatientStatusLoader({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PatientStatusClient patientId={id} />;
}

export default function PatientStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // With Cache Components, `params` must be awaited inside a Suspense
  // boundary so the rest of the route can prerender.
  return (
    <Suspense fallback={<LoadingStatus />}>
      <PatientStatusLoader params={params} />
    </Suspense>
  );
}
