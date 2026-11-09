import { requireRoles } from "@/lib/auth/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRoles("super_admin");
  return children;
}
