import { StaffShell } from "@/components/layout/StaffShell";
import { AssessmentDashboard } from "@/components/assessment/AssessmentDashboard";

export default function AdminPage() {
  return (
    <StaffShell>
      <AssessmentDashboard mode="admin" />
    </StaffShell>
  );
}
