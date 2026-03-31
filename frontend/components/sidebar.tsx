"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  ScanSearch,
  RefreshCw,
  BarChart3,
  Settings,
  LogOut,
  ChevronRight,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/scoring", label: "Client Scoring", icon: ScanSearch },
  { href: "/retraining", label: "Model Retraining", icon: RefreshCw },
  { href: "/reporting", label: "Reporting", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <aside className="fixed inset-y-0 left-0 w-64 flex flex-col bg-[#003366] text-white z-30">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-navy-700">
        <div className="w-9 h-9 rounded-lg bg-[#C9A84C] flex items-center justify-center flex-shrink-0">
          <Building2 className="w-5 h-5 text-white" />
        </div>
        <div className="leading-tight">
          <p className="text-xs font-semibold text-[#C9A84C] uppercase tracking-widest">NBB</p>
          <p className="text-sm font-bold">NBO Platform</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "sidebar-link group",
                active
                  ? "bg-[#C9A84C] text-white"
                  : "text-blue-100 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className="w-4.5 h-4.5 flex-shrink-0" size={18} />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight size={14} className="opacity-70" />}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-navy-700 space-y-2">
        {session?.user && (
          <div className="px-2 py-2">
            <p className="text-xs text-blue-200 truncate">{session.user.name}</p>
            <p className="text-xs text-blue-300 truncate">{session.user.email}</p>
            <span className="mt-1 inline-block text-[10px] px-2 py-0.5 rounded-full bg-[#C9A84C]/20 text-[#C9A84C] font-semibold">
              {(session.user as typeof session.user & { role?: string }).role ?? "RM"}
            </span>
          </div>
        )}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="sidebar-link w-full text-blue-200 hover:bg-white/10 hover:text-white"
        >
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
