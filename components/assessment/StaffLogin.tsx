"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { createStaffBrowserClient } from "@/lib/supabase-browser";

interface StaffLoginProps {
  title: string;
  description: string;
  redirectTo: string;
}

export function StaffLogin({ title, description, redirectTo }: StaffLoginProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const supabase = createStaffBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError("Invalid email or password.");
        return;
      }

      // Confirm the account is an active staff member before entering.
      const me = await fetch("/api/auth/me", { cache: "no-store" });

      if (!me.ok) {
        await supabase.auth.signOut();
        setError("This account is not authorised for staff access.");
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("Sign-in is unavailable right now. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center">
      <Card className="w-full p-6">
        <CardHeader title={title} description={description} />
        <CardBody className="mt-6">
          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">
              Email
              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-medical-blue focus:outline-none focus:ring-1 focus:ring-medical-blue"
              />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Password
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-medical-blue focus:outline-none focus:ring-1 focus:ring-medical-blue"
              />
            </label>
            {error && (
              <p role="alert" className="rounded-lg bg-red-light px-3 py-2 text-sm text-red-dark">
                {error}
              </p>
            )}
            <Button type="submit" fullWidth disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <p className="mt-4 text-xs text-gray-500">
            Authorised hospital personnel only. Access is logged.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
