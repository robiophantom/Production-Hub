import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { uploadImage } from "@/lib/storage";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to upload photographs." }, { status: 401 });
  }
  if (!["unit_supervisor", "super_admin", "merchandiser"].includes(user.role)) {
    return NextResponse.json({ error: "You cannot upload production photographs." }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a photograph to upload." }, { status: 400 });
  }

  try {
    const asset = await uploadImage(file, "production");
    return NextResponse.json(asset);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to store the photograph." },
      { status: 400 },
    );
  }
}
