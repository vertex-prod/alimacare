import Link from "next/link";

interface SidebarProps {
  items: { href: string; label: string }[];
  activePath: string;
}

export function Sidebar({ items, activePath }: SidebarProps) {
  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:pl-0 lg:pr-4 lg:pt-16">
      <div className="flex-1 flex flex-col min-h-0 border-r border-gray-200 bg-white/60 rounded-r-2xl py-6 pr-4">
        <nav className="flex-1 px-4 space-y-1.5">
          {items.map((item) => {
            const isActive = activePath === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  isActive
                    ? "bg-medical-blue-light text-medical-blue-dark shadow-sm"
                    : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                {isActive && (
                  <span className="w-1.5 h-6 rounded-full bg-medical-blue"></span>
                )}
                <span className={isActive ? "ml-1" : ""}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-4 mt-6">
          <div className="rounded-xl bg-medical-blue-light/40 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-soft-green animate-pulse"></span>
              <span className="text-xs font-semibold text-medical-blue-dark">
                System Online
              </span>
            </div>
            <p className="text-[11px] text-gray-600 leading-relaxed">
              Real-time queue updates active. Patients are being managed by reception and doctors.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}