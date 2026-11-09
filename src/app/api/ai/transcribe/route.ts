import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { transcribeTamilAudio } from "@/lib/ai";
import { uploadAudio } from "@/lib/storage";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to transcribe voice notes." }, { status: 401 });
  }
  if (user.role !== "unit_supervisor" && user.role !== "super_admin") {
    return NextResponse.json({ error: "Only supervisors can record voice notes." }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid voice note upload." }, { status: 400 });
  }

  const file = form.get("audio");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No audio was recorded." }, { status: 400 });
  }

  const transcript = await transcribeTamilAudio(file);
  let url: string | null = null;
  let publicId: string | null = null;

  try {
    const asset = await uploadAudio(file, "voice-notes");
    url = asset.url;
    publicId = asset.publicId;
  } catch (error) {
    // The recording is still useful for transcription even if storage is unavailable.
    console.warn("[voice] audio storage failed:", (error as Error).message);
  }

  return NextResponse.json({
    text: transcript.text,
    translation: transcript.translation,
    provider: transcript.provider,
    url,
    publicId,
  });
}
