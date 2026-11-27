import { StaffShell } from "@/components/layout/StaffShell";
import { StaffLogin } from "@/components/assessment/StaffLogin";

export default function AdminLoginPage() {
  return (
    <StaffShell>
      <StaffLogin
        title="Reception & Admin sign-in"
        description="Review AI assessments and manage the patient queue."
        redirectTo="/admin"
      />
    </StaffShell>
  );
}
