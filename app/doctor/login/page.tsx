import { StaffShell } from "@/components/layout/StaffShell";
import { StaffLogin } from "@/components/assessment/StaffLogin";

export default function DoctorLoginPage() {
  return (
    <StaffShell>
      <StaffLogin
        title="Doctor sign-in"
        description="View your assigned patients and their preliminary assessments."
        redirectTo="/doctor"
      />
    </StaffShell>
  );
}
