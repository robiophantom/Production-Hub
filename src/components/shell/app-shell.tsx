"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  Menu,
  Plus,
  X,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_LABELS } from "@/lib/constants";
import { logoutAction } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/types";
import {
  canCreateOrder,
  isNavActive,
  mobileNavForRole,
  navForRole,
} from "./nav";

const SIDEBAR_STORAGE_KEY = "ca_sidebar_collapsed";
const sidebarListeners = new Set<() => void>();

function subscribeSidebar(callback: () => void) {
  sidebarListeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    sidebarListeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function getSidebarSnapshot() {
  return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
}

function getSidebarServerSnapshot() {
  return false;
}

function setSidebarStored(collapsed: boolean) {
  window.localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "1" : "0");
  for (const listener of sidebarListeners) listener();
}

export function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(
    subscribeSidebar,
    getSidebarSnapshot,
    getSidebarServerSnapshot,
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);

  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setMobileOpen(false);
  }

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  const toggleCollapsed = () => {
    setSidebarStored(!collapsed);
  };

  const sections = navForRole(user.role);
  const mobileItems = mobileNavForRole(user.role);

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:shadow-lg"
      >
        Skip to content
      </a>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-line bg-white transition-[width] duration-200 lg:flex",
          collapsed ? "w-[76px]" : "w-[264px]",
        )}
      >
        <div
          className={cn(
            "flex h-16 shrink-0 items-center border-b border-line",
            collapsed ? "justify-center px-2" : "px-5",
          )}
        >
          <Link href="/" aria-label="Production Hub home">
            <Logo showText={!collapsed} />
          </Link>
        </div>

        <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4">
          {sections.map((section) => (
            <div key={section.label ?? "main"} className="mb-5 last:mb-0">
              {section.label ? (
                collapsed ? (
                  <div className="mx-2 mb-2 h-px bg-line" />
                ) : (
                  <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    {section.label}
                  </p>
                )
              ) : null}
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isNavActive(pathname, item);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
                          collapsed && "justify-center px-0",
                          active
                            ? "bg-brand-soft text-brand-dark"
                            : "text-slate-600 hover:bg-slate-50 hover:text-ink",
                        )}
                      >
                        <item.icon
                          className={cn("size-[18px] shrink-0", active ? "text-brand" : "text-slate-400")}
                        />
                        {collapsed ? (
                          <span className="sr-only">{item.label}</span>
                        ) : (
                          <span className="truncate">{item.label}</span>
                        )}
                        {active && !collapsed ? (
                          <span className="ml-auto size-1.5 rounded-full bg-brand" />
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-line p-3">
          <div
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-1.5 py-1.5",
              collapsed && "justify-center",
            )}
          >
            <Avatar name={user.full_name} />
            {collapsed ? null : (
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-ink">{user.full_name}</p>
                <p className="truncate text-[11px] text-muted">{ROLE_LABELS[user.role]}</p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={toggleCollapsed}
            className={cn(
              "mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] font-medium text-slate-500 hover:bg-slate-50 hover:text-ink",
              collapsed && "justify-center px-0",
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
            {collapsed ? null : "Collapse"}
          </button>
        </div>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[286px] flex-col bg-white shadow-[var(--shadow-float)]">
            <div className="flex h-16 items-center justify-between border-b border-line px-4">
              <Logo />
              <Button variant="ghost" size="icon-sm" onClick={() => setMobileOpen(false)} aria-label="Close menu">
                <X />
              </Button>
            </div>
            <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4">
              {sections.map((section) => (
                <div key={section.label ?? "main"} className="mb-5 last:mb-0">
                  {section.label ? (
                    <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      {section.label}
                    </p>
                  ) : null}
                  <ul className="space-y-0.5">
                    {section.items.map((item) => {
                      const active = isNavActive(pathname, item);
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                            className={cn(
                              "flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-sm font-medium",
                              active
                                ? "bg-brand-soft text-brand-dark"
                                : "text-slate-600 hover:bg-slate-50",
                            )}
                          >
                            <item.icon
                              className={cn("size-[18px]", active ? "text-brand" : "text-slate-400")}
                            />
                            {item.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
            <div className="border-t border-line p-4">
              <div className="flex items-center gap-2.5">
                <Avatar name={user.full_name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{user.full_name}</p>
                  <p className="truncate text-xs text-muted">{ROLE_LABELS[user.role]}</p>
                </div>
              </div>
              <form action={logoutAction} className="mt-3">
                <Button type="submit" variant="outline" className="w-full" size="sm">
                  <LogOut /> Sign out
                </Button>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          "flex min-h-dvh flex-col transition-[margin] duration-200",
          collapsed ? "lg:ml-[76px]" : "lg:ml-[264px]",
        )}
      >
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-line bg-white/90 px-4 backdrop-blur-sm sm:px-6 lg:px-8">
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu />
          </Button>

          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-muted lg:text-[13px]">
              {ROLE_LABELS[user.role]} workspace
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {canCreateOrder(user.role) ? (
              <Button asChild size="sm" className="hidden sm:inline-flex">
                <Link href="/orders/new">
                  <Plus /> New purchase order
                </Link>
              </Button>
            ) : null}

            <Badge variant="neutral" className="hidden md:inline-flex">
              Business date {new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata" })}
            </Badge>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-lg p-1 pr-2 text-left hover:bg-slate-50"
                >
                  <Avatar name={user.full_name} className="size-8" />
                  <span className="hidden min-w-0 sm:block">
                    <span className="block max-w-[150px] truncate text-[13px] font-semibold text-ink">
                      {user.full_name}
                    </span>
                    <span className="block text-[11px] text-muted">{ROLE_LABELS[user.role]}</span>
                  </span>
                  <ChevronDown className="hidden size-4 text-slate-400 sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Signed in</DropdownMenuLabel>
                <div className="px-2.5 pb-2">
                  <p className="truncate text-[13px] font-medium text-ink">{user.full_name}</p>
                  <p className="truncate text-[11px] text-muted">{user.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => {
                    const form = document.getElementById("ca-logout-form");
                    if (form instanceof HTMLFormElement) form.requestSubmit();
                  }}
                >
                  <LogOut className="size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main id="main" className="flex-1 px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:pb-10 lg:pt-6">
          <div className="mx-auto w-full max-w-[1480px]">{children}</div>
        </main>
      </div>

      <form id="ca-logout-form" action={logoutAction} className="hidden">
        <button type="submit">Sign out</button>
      </form>

      {mobileItems.length > 0 ? (
        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
          aria-label="Primary"
        >
          <ul className="mx-auto flex max-w-lg items-stretch">
            {mobileItems.map((item) => {
              const active = isNavActive(pathname, item);
              return (
                <li key={item.href} className="flex-1">
                  <Link
                    href={item.href}
                    className={cn(
                      "flex min-h-[58px] flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium",
                      active ? "text-brand" : "text-slate-500",
                    )}
                  >
                    <item.icon className="size-5" strokeWidth={active ? 2.4 : 2} />
                    <span className="max-w-full truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
