import { AppShell } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/auth/session";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <AppShell user={user}>{children}</AppShell>;
}
