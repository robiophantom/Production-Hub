import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { classifyIssue } from "@/lib/ai";

const schema = z.object({ text: z.string().trim().min(1).max(4000) });

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to use issue assist." }, { status: 401 });
  }
  if (!["unit_supervisor", "super_admin", "merchandiser"].includes(user.role)) {
    return NextResponse.json({ error: "Not permitted." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Describe the issue before requesting a suggestion." }, { status: 400 });
  }

  const classification = await classifyIssue(parsed.data.text);
  return NextResponse.json(classification);
}
