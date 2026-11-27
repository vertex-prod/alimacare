"use client";

import {
  ClipboardList,
  Download,
  HeartPulse,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";

import { ToastProvider } from "@/components/ui/Toast";
import { apiGet, apiSend } from "@/lib/client-api";
import { cn } from "@/lib/format";
import type { AdminSession } from "@/lib/types";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/queue", label: "Live queue", icon: ListOrdered },
  { href: "/admin/patients", label: "Patient records", icon: ClipboardList },
  { href: "/admin/export", label: "Export", icon: Download },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

function NavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-medical-blue-light text-medical-blue-dark"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function ActiveNavLinks({ onNavigate }: { onNavigate: () => void }) {
  return <NavLinks pathname={usePathname()} onNavigate={onNavigate} />;
}

export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let active = true;

    apiGet<AdminSession>("/api/auth/session")
      .then((session) => {
        if (active) setUsername(session.username);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  const signOut = async () => {
    setSigningOut(true);

    try {
      await apiSend("/api/auth/logout", "POST");
    } finally {
      router.replace("/admin/login");
      router.refresh();
    }
  };

  const nav = (
    // usePathname() is request data under Cache Components, so the active
    // highlight streams in; the fallback renders the same links unhighlighted.
    <Suspense fallback={<NavLinks pathname="" onNavigate={() => setOpen(false)} />}>
      <ActiveNavLinks onNavigate={() => setOpen(false)} />
    </Suspense>
  );

  const brand = (
    <div className="flex items-center gap-2.5 px-1">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-medical-blue text-white">
        <HeartPulse className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-bold text-gray-900">AlimaCare</p>
        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
          Admin panel
        </p>
      </div>
    </div>
  );

  return (
    <ToastProvider>
      <div className="min-h-screen bg-gray-50">
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-gray-200 bg-white p-4 lg:flex">
          {brand}
          <div className="mt-8 flex-1">{nav}</div>
        </aside>

        {open ? (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
            <div
              className="absolute inset-0 bg-gray-900/40"
              onClick={() => setOpen(false)}
            />
            <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-white p-4 shadow-xl">
              <div className="flex items-center justify-between">
                {brand}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-8">{nav}</div>
            </aside>
          </div>
        ) : null}

        <div className="lg:pl-60">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-gray-200 bg-white/90 px-4 backdrop-blur sm:px-6">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex-1" />
            <div className="flex items-center gap-3">
              {username ? (
                <span className="hidden text-sm text-gray-500 sm:inline">
                  Signed in as{" "}
                  <span className="font-semibold text-gray-800">{username}</span>
                </span>
              ) : null}
              <button
                type="button"
                onClick={signOut}
                disabled={signingOut}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </header>

          <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
