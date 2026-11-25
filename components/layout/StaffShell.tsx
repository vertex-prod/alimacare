"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Header } from "@/components/ui/Header";

export const staffNavItems = [
  { href: "/admin", label: "Dashboard" },
  { href: "/patient", label: "Patient Registration" },
  { href: "/admin/login", label: "Reception Admin" },
  { href: "/doctor/login", label: "Doctor Dashboard" },
];

export function StaffShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-full flex-col">
      <Header />
      <div className="flex flex-1 flex-row">
        {/* Desktop Sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-gray-200 bg-white lg:block">
          <nav className="sticky top-16 flex max-h-[calc(100vh-4rem)] flex-col gap-1 overflow-y-auto p-4">
            {staffNavItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-medical-blue-light text-medical-blue-dark"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}