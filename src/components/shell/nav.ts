import type { LucideIcon } from "lucide-react";
import {
  BellRing,
  ChartColumn,
  ClipboardList,
  Database,
  Factory,
  FileText,
  History,
  LayoutDashboard,
  PackageSearch,
  ScrollText,
  Settings,
  SquareKanban,
  Users,
} from "lucide-react";
import type { Role } from "@/lib/constants";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  exact?: boolean;
  mobile?: boolean;
}

export interface NavSection {
  label: string | null;
  items: NavItem[];
}

const INTERNAL: Role[] = ["super_admin", "managing_director", "merchandiser"];

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Operations",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        roles: INTERNAL,
        mobile: true,
      },
      {
        href: "/orders",
        label: "Purchase orders",
        icon: ClipboardList,
        roles: INTERNAL,
        mobile: true,
      },
      {
        href: "/board",
        label: "Production board",
        icon: SquareKanban,
        roles: INTERNAL,
        mobile: true,
      },
      {
        href: "/alerts",
        label: "Delay alerts",
        icon: BellRing,
        roles: INTERNAL,
        mobile: true,
      },
      {
        href: "/reports",
        label: "Reports",
        icon: ChartColumn,
        roles: INTERNAL,
        mobile: false,
      },
    ],
  },
  {
    label: "Factory floor",
    items: [
      {
        href: "/supervisor",
        label: "My production",
        icon: Factory,
        roles: ["unit_supervisor"],
        exact: true,
        mobile: true,
      },
      {
        href: "/supervisor/history",
        label: "My submissions",
        icon: History,
        roles: ["unit_supervisor"],
        mobile: true,
      },
      {
        href: "/supervisor/issues",
        label: "Issues I reported",
        icon: FileText,
        roles: ["unit_supervisor"],
        mobile: false,
      },
    ],
  },
  {
    label: "Buyer portal",
    items: [
      {
        href: "/buyer",
        label: "My orders",
        icon: PackageSearch,
        roles: ["buyer"],
        exact: true,
        mobile: true,
      },
      {
        href: "/buyer/updates",
        label: "Approved updates",
        icon: BellRing,
        roles: ["buyer"],
        mobile: true,
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        href: "/admin/users",
        label: "Users & roles",
        icon: Users,
        roles: ["super_admin"],
        mobile: false,
      },
      {
        href: "/admin/master-data",
        label: "Buyers, units & stages",
        icon: Database,
        roles: ["super_admin"],
        mobile: false,
      },
      {
        href: "/admin/activity",
        label: "Activity & audit",
        icon: ScrollText,
        roles: ["super_admin"],
        mobile: false,
      },
      {
        href: "/admin/settings",
        label: "Settings",
        icon: Settings,
        roles: ["super_admin"],
        mobile: false,
      },
    ],
  },
];

export function canCreateOrder(role: Role): boolean {
  return role === "super_admin" || role === "merchandiser";
}

export function navForRole(role: Role): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.roles.includes(role)),
  })).filter((section) => section.items.length > 0);
}

export function mobileNavForRole(role: Role): NavItem[] {
  return navForRole(role)
    .flatMap((section) => section.items)
    .filter((item) => item.mobile)
    .slice(0, 5);
}

export function isNavActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
