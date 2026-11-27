"use client";

import { AlertCircle, HeartPulse, Lock } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField, Input } from "@/components/ui/form";
import { apiSend } from "@/lib/client-api";

/** Only allow same-site admin paths as the post-login destination. */
function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/admin") || value.startsWith("//")) {
    return "/admin";
  }

  return value === "/admin/login" ? "/admin" : value;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await apiSend("/api/auth/login", "POST", { username, password });
      router.replace(safeNext(searchParams.get("next")));
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign in.");
      setBusy(false);
    }
  };

  return (
    <Card className="w-full max-w-sm p-6 sm:p-8">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-medical-blue text-white shadow-sm">
          <HeartPulse className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">AlimaCare Admin</h1>
        <p className="mt-1 text-sm text-gray-500">
          Sign in to manage the patient queue and records.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <FormField label="Username">
          <Input
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
            autoFocus
          />
        </FormField>
        <FormField label="Password">
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
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
          <Lock className="h-4 w-4" />
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </Card>
  );
}
