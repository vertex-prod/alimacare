import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in — AlimaCare Admin",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-medical-blue-light/60 via-gray-50 to-white px-4 py-10">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
