export const ROLES = [
  "super_admin",
  "managing_director",
  "merchandiser",
  "unit_supervisor",
  "buyer",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  managing_director: "Managing Director",
  merchandiser: "Merchandiser",
  unit_supervisor: "Unit Supervisor",
  buyer: "Buyer",
};

export const ISSUE_CATEGORIES = [
  "Machine Breakdown",
  "Labour Shortage",
  "Raw Material Shortage",
  "Quality Issue",
  "Printing Delay",
  "Washing Delay",
  "Power Interruption",
  "Production Capacity Issue",
  "Other",
] as const;

export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

export const ISSUE_SEVERITIES = ["low", "medium", "high", "critical"] as const;
export const ISSUE_STATUSES = ["open", "in_progress", "resolved"] as const;

export type IssueSeverity = (typeof ISSUE_SEVERITIES)[number];
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const PO_STATUSES = ["active", "completed", "cancelled"] as const;
export const PRIORITIES = ["low", "normal", "high", "critical"] as const;
export const SHIPPING_METHODS = ["sea", "air", "courier", "road"] as const;

export const ALERT_WINDOWS = ["14_day", "7_day", "3_day", "overdue", "none"] as const;

export const ALERT_WINDOW_LABELS: Record<(typeof ALERT_WINDOWS)[number], string> = {
  "14_day": "14-day advance review",
  "7_day": "7-day escalation",
  "3_day": "3-day critical warning",
  overdue: "Overdue",
  none: "Live risk",
};

export const HEALTH_META = {
  green: {
    label: "On track",
    text: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
    solid: "bg-emerald-600",
  },
  amber: {
    label: "At risk",
    text: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    dot: "bg-amber-500",
    solid: "bg-amber-600",
  },
  red: {
    label: "Delayed",
    text: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
    dot: "bg-red-500",
    solid: "bg-red-600",
  },
} as const;

export type Health = keyof typeof HEALTH_META;

export const DEFAULT_STAGES = [
  { name: "Fabric Booking", code: "fabric_booking", sequence: 1 },
  { name: "Knitting", code: "knitting", sequence: 2 },
  { name: "Dyeing", code: "dyeing", sequence: 3 },
  { name: "Cutting", code: "cutting", sequence: 4 },
  { name: "Stitching", code: "stitching", sequence: 5 },
  { name: "Printing", code: "printing", sequence: 6 },
  { name: "Washing", code: "washing", sequence: 7 },
  { name: "Finishing", code: "finishing", sequence: 8 },
  { name: "Packing", code: "packing", sequence: 9 },
  { name: "Ex-factory", code: "ex_factory", sequence: 10 },
] as const;

export const DEMO_ACCOUNTS = [
  {
    role: "super_admin" as Role,
    email: "admin@company-a.test",
    password: "Admin@12345",
    name: "Arun Prakash",
  },
  {
    role: "managing_director" as Role,
    email: "md@company-a.test",
    password: "Md@12345",
    name: "Meena Suresh",
  },
  {
    role: "merchandiser" as Role,
    email: "merch@company-a.test",
    password: "Merch@12345",
    name: "Divya Kumar",
  },
  {
    role: "unit_supervisor" as Role,
    email: "supervisor@company-a.test",
    password: "Super@12345",
    name: "Karthik Raja",
  },
  {
    role: "buyer" as Role,
    email: "buyer@company-b.test",
    password: "Buyer@12345",
    name: "Oliver Smith",
  },
];

export const BUYER_DEMO_ACCOUNT_C = {
  email: "buyer.c@company-c.test",
  password: "BuyerC@12345",
  name: "Lena Fischer",
};

export const APP_NAME = "Company A Production Hub";
