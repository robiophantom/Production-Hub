import { redirect } from "next/navigation";
import { getSessionUser, roleHome } from "@/lib/auth/session";

export default async function HomePage() {
  const user = await getSessionUser();
  redirect(user ? roleHome(user.role) : "/login");
}
