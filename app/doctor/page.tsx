import { StaffShell } from "@/components/layout/StaffShell";
import { AssessmentDashboard } from "@/components/assessment/AssessmentDashboard";

export default function DoctorPage() {
  return (
    <StaffShell>
      <AssessmentDashboard mode="doctor" />
    </StaffShell>
  );
}
