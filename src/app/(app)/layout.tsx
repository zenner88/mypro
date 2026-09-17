"use client";

import * as React from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, FolderKanban, Users, FileText, Receipt, Wallet,
  FolderOpen, BarChart3, Settings as SettingsIcon, Menu, X, Search,
  Bell, ChevronDown, LogOut, UserCircle, KeyRound, Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

const NAV_SECTIONS = [
  {
    title: "HOMEPAGE",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    title: "PROJECTS & CLIENTS",
    items: [
      { href: "/projects", label: "Projects", icon: FolderKanban },
      { href: "/clients", label: "Clients", icon: Users },
      { href: "/quotations", label: "Quotations", icon: FileText },
    ],
  },
  {
    title: "FINANCIALS",
    items: [
      { href: "/invoices", label: "Invoices", icon: Receipt },
      { href: "/payments", label: "Payments", icon: Wallet, badge: "New" },
      { href: "/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    title: "SYSTEM & MEDIA",
    items: [
      { href: "/documents", label: "Documents", icon: FolderOpen },
      { href: "/settings", label: "Settings", icon: SettingsIcon },
    ],
  },
];

type Notification = {
  type: string;
  level: "warning" | "danger" | "info";
  message: string;
  href?: string;
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [notifications, setNotifications] = React.useState<Notification[]>([]);

  React.useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => setNotifications(d.items ?? []))
      .catch(() => {});
  }, [pathname]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (search.trim()) router.push(`/search?q=${encodeURIComponent(search.trim())}`);
  }

  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      {/* Sidebar — desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden lg:flex w-64 flex-col border-r border-slate-200/80 bg-white no-print shadow-[2px_0_15px_-3px_rgba(0,0,0,0.02)]">
        {/* Brand Header */}
        <div className="flex h-16 items-center gap-3 border-b border-slate-100 px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-black text-base shadow-md shadow-emerald-600/25">
            M
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-bold tracking-tight text-slate-900">MYPro</span>
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Studio Workspace</span>
          </div>
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 space-y-6 overflow-y-auto px-4 py-5 scrollbar-thin">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="space-y-1">
              <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {section.title}
              </p>
              <div className="mt-2 space-y-1">
                {section.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200",
                        active
                          ? "bg-gradient-to-r from-emerald-50 to-teal-50/60 text-emerald-700 shadow-xs border-l-4 border-emerald-600"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon
                          className={cn(
                            "h-4 w-4 transition-colors",
                            active ? "text-emerald-600" : "text-slate-400 group-hover:text-slate-600"
                          )}
                        />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Sidebar Footer User Box */}
        <div className="border-t border-slate-100 p-4">
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-2.5 border border-slate-200/60">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-xs font-bold text-white shadow-xs">
              {session?.user?.name?.charAt(0).toUpperCase() ?? "U"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-slate-800">{session?.user?.name ?? "User"}</p>
              <p className="truncate text-[11px] font-semibold text-emerald-600">
                {session?.user?.plan === "PRO" ? "Pro Plan (Unlimited)" : "Free Tier (1 Proj / 3 Inv)"}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Sidebar — mobile drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden no-print">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-2xl animate-fade-in">
            <div className="flex h-16 items-center justify-between border-b px-5">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-sm">
                  M
                </div>
                <span className="text-lg font-bold">MYPro</span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Tutup menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-6 overflow-y-auto p-4 scrollbar-thin">
              {NAV_SECTIONS.map((section) => (
                <div key={section.title} className="space-y-1">
                  <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {section.title}
                  </p>
                  <div className="mt-2 space-y-1">
                    {section.items.map((item) => {
                      const active = pathname === item.href || pathname.startsWith(item.href + "/");
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                            active ? "bg-emerald-50 text-emerald-700 font-bold" : "text-slate-600 hover:bg-slate-50"
                          )}
                        >
                          <item.icon className={cn("h-4 w-4", active ? "text-emerald-600" : "text-slate-400")} />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Container */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        {/* Topbar Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-slate-200/70 bg-white/80 px-6 backdrop-blur-md no-print">
          <button
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Buka menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Pill Search Input */}
          <form onSubmit={handleSearch} className="relative hidden max-w-md flex-1 sm:block">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search project, client, invoice..."
              className="h-10 w-full rounded-full border border-slate-200 bg-slate-50/80 pl-10 pr-4 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
          </form>

          <div className="ml-auto flex items-center gap-2">
            {/* Quick Action Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="hidden sm:inline-flex bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-4 shadow-sm">
                  <Plus className="h-4 w-4" /> Quick Add
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-xl p-1.5">
                <DropdownMenuItem onClick={() => router.push("/projects?new=1")} className="rounded-lg text-xs font-semibold py-2">
                  <FolderKanban className="h-4 w-4 text-emerald-600" /> New Project
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/invoices")} className="rounded-lg text-xs font-semibold py-2">
                  <Receipt className="h-4 w-4 text-emerald-600" /> New Invoice
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/clients")} className="rounded-lg text-xs font-semibold py-2">
                  <Users className="h-4 w-4 text-emerald-600" /> New Client
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Notifications Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="relative rounded-full p-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                  aria-label="Notifikasi"
                >
                  <Bell className="h-5 w-5" />
                  {notifications.length > 0 && (
                    <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-xs animate-pulse">
                      {notifications.length}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 rounded-2xl p-2 shadow-xl border-slate-200">
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Notifications</span>
                  <Badge variant="outline" className="text-[10px] rounded-full">{notifications.length} Unread</Badge>
                </div>
                <DropdownMenuSeparator className="my-1" />
                {notifications.length === 0 ? (
                  <p className="px-3 py-8 text-center text-xs text-slate-400">
                    No new notifications 👍
                  </p>
                ) : (
                  <div className="max-h-80 overflow-y-auto space-y-1">
                    {notifications.slice(0, 8).map((n, i) => (
                      <DropdownMenuItem
                        key={i}
                        className="flex flex-col items-start gap-1 rounded-xl p-2.5 transition-colors cursor-pointer"
                        onClick={() => n.href && router.push(n.href)}
                      >
                        <span className="flex w-full items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-800">{n.type}</span>
                          <span className="text-[10px] text-slate-400">Just now</span>
                        </span>
                        <span className="text-xs text-slate-600 leading-relaxed">{n.message}</span>
                      </DropdownMenuItem>
                    ))}
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Profile Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5 rounded-full p-1 pl-1.5 pr-3 hover:bg-slate-100 transition-colors">
                  <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-xs font-extrabold text-white shadow-xs">
                    {session?.user?.name?.charAt(0).toUpperCase() ?? "U"}
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-white" />
                  </div>
                  <span className="hidden text-xs font-bold text-slate-700 md:inline">{session?.user?.name}</span>
                  <ChevronDown className="hidden h-3.5 w-3.5 text-slate-400 md:inline" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60 rounded-2xl p-2 shadow-xl border-slate-200">
                <DropdownMenuLabel className="px-3 py-2 text-xs font-bold text-slate-900 flex items-center justify-between">
                  <span className="truncate max-w-[120px]">{session?.user?.email}</span>
                  <Badge className="text-[10px] bg-emerald-100 text-emerald-800 hover:bg-emerald-100">{session?.user?.plan ?? "FREE"}</Badge>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {session?.user?.role === "ADMIN" && (
                  <DropdownMenuItem onClick={() => router.push("/settings?tab=users")} className="rounded-xl text-xs font-bold py-2 text-emerald-700 bg-emerald-50">
                    <Users className="h-4 w-4 text-emerald-600" /> Kelola Users (Admin)
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => router.push("/settings?tab=profile")} className="rounded-xl text-xs font-semibold py-2">
                  <UserCircle className="h-4 w-4 text-slate-500" /> Profil Saya
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/settings?tab=profile")} className="rounded-xl text-xs font-semibold py-2">
                  <KeyRound className="h-4 w-4 text-slate-500" /> Ganti Password
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })} className="rounded-xl text-xs font-semibold py-2 text-rose-600 focus:text-rose-700">
                  <LogOut className="h-4 w-4" /> Keluar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
