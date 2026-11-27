"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export const navItems = [
  { href: "/admin", label: "Dashboard", match: "/admin" },
  { href: "/patient", label: "Patient Registration", match: "/patient" },
  { href: "/admin/login", label: "Reception Admin", match: "/admin/login" },
  { href: "/doctor/login", label: "Doctor Dashboard", match: "/doctor" },
];

export function activeNavMatch(pathname: string, items: { match: string }[]) {
  let best = "";

  for (const item of items) {
    if (
      (pathname === item.match || pathname.startsWith(`${item.match}/`)) &&
      item.match.length > best.length
    ) {
      best = item.match;
    }
  }

  return best;
}

export function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const activeMatch = activeNavMatch(pathname, navItems);

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-blur]:bg-white/80">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex shrink-0 items-center">
          <Link href="/" className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-medical-blue-dark font-bold tracking-tight">AlimaCare</span>
            <span className="hidden text-sm font-medium text-gray-600 xl:block">
              Hospital Patient Flow
            </span>
          </Link>
        </div>

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-3 whitespace-nowrap md:flex lg:gap-6">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-[13px] font-medium transition-colors lg:text-sm ${
                item.match === activeMatch
                  ? "text-medical-blue-dark"
                  : "text-gray-700 hover:text-medical-blue"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 lg:gap-4">
          <button className="flex items-center gap-2 rounded-lg border border-gray-200 px-2.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 lg:px-4">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-medical-blue text-[10px] text-white">
              M
            </span>
            <span className="hidden lg:inline">Staff Portal</span>
          </button>
          <button
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 py-4 space-y-3 animate-in slide-in-from-top duration-200">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-3 py-2 rounded-lg ${
                item.match === activeMatch
                  ? "bg-medical-blue-light text-medical-blue-dark font-medium"
                  : "text-gray-700 hover:bg-gray-50 hover:text-medical-blue"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
