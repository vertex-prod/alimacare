"use client";

import { AlertCircle, HeartPulse, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField, Input } from "@/components/ui/form";
import { apiSend } from "@/lib/client-api";

export function SignupForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [signupCode, setSignupCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);

    try {
      await apiSend("/api/auth/signup", "POST", {
        username,
        password,
        signupCode,
      });
      router.replace("/admin");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign up.");
      setBusy(false);
    }
  };

  return (
    <Card className="w-full max-w-sm p-6 sm:p-8">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-medical-blue text-white shadow-sm">
          <HeartPulse className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">Create admin account</h1>
        <p className="mt-1 text-sm text-gray-500">
          You need the sign-up code from your administrator.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <FormField label="Username" hint="3–40 letters, numbers, . - _">
          <Input
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
            autoFocus
          />
        </FormField>
        <FormField label="Password" hint="At least 8 characters">
          <Input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </FormField>
        <FormField label="Confirm password">
          <Input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            required
          />
        </FormField>
        <FormField label="Sign-up code">
          <Input
            type="password"
            autoComplete="off"
            value={signupCode}
            onChange={(event) => setSignupCode(event.target.value)}
            required
          />
        </FormField>

        {error ? (
          <p className="flex items-start gap-2 rounded-lg bg-red-light px-3 py-2 text-sm text-red-dark">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        ) : null}

        <Button type="submit" fullWidth size="lg" disabled={busy}>
          <UserPlus className="h-4 w-4" />
          {busy ? "Creating account…" : "Sign up"}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-gray-500">
        Already have an account?{" "}
        <Link href="/admin/login" className="font-semibold text-medical-blue hover:underline">
          Sign in
        </Link>
      </p>
    </Card>
  );
}
