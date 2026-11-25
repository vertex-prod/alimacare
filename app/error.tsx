"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Page error:", error);
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md p-6 text-center">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h1>
        <p className="text-sm text-gray-600 mb-5">The page could not be displayed. Your data has not been changed.</p>
        <Button onClick={reset} fullWidth>
          Try Again
        </Button>
      </Card>
    </main>
  );
}