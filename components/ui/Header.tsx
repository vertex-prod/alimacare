"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export const navItems = [
  { href: "/admin", label: "Dashboard" },
  { href: "/patient", label: "Patient Registration" },
  { href: "/admin/login", label: "Reception Admin" },
  { href: "/doctor/login", label: "Doctor Dashboard" },
];

export function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-blur]:bg-white/80">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-lg border border-medical-blue-light bg-medical-blue-light/50 p-1">
            <span className="w-2 h-2 rounded-full bg-medical-blue"></span>
            <span className="w-2 h-2 rounded-full bg-medical-blue"></span>
            <span className="w-2 h-2 rounded-full bg-medical-blue"></span>
          </div>
          <Link href="/" className="flex items-center gap-2">
            <span className="text-medical-blue-dark font-bold tracking-tight">AlimaCare</span>
            <span className="text-sm font-medium text-gray-600 hidden sm:block">
              Hospital Patient Flow
            </span>
          </Link>
        </div>

        <nav className="hidden md:flex items-center gap-8">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-sm font-medium transition-colors ${
                pathname === item.href
                  ? "text-medical-blue-dark"
                  : "text-gray-700 hover:text-medical-blue"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4 ml-auto">
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <span className="w-4 h-4 rounded-full bg-medical-blue text-white flex items-center justify-center text-[10px]">
              M
            </span>
            <span>Staff Portal</span>
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
                pathname === item.href
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
