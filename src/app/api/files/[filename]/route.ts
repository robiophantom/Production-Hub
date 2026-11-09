import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".webm": "audio/webm",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".aac": "audio/aac",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,180}$/.test(filename)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const filePath = path.join(process.cwd(), ".data", "uploads", filename);
  try {
    const data = await fs.readFile(filePath);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": CONTENT_TYPES[path.extname(filename).toLowerCase()] ?? "application/octet-stream",
        "Content-Length": String(data.byteLength),
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
