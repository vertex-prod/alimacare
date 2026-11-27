import type { Metadata } from "next";

import { SignupForm } from "./SignupForm";

export const metadata: Metadata = {
  title: "Sign up — AlimaCare Admin",
};

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-medical-blue-light/60 via-gray-50 to-white px-4 py-10">
      <SignupForm />
    </main>
  );
}
