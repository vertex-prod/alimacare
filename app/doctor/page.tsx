import { StaffShell } from "@/components/layout/StaffShell";
import { DoctorDashboard } from "@/components/doctor/DoctorDashboard";

export default function DoctorPage() {
  return (
    <StaffShell>
      <DoctorDashboard />
    </StaffShell>
  );
}
