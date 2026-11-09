import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { env } from "@/lib/env";

export interface StoredAsset {
  url: string;
  publicId: string;
  width: number | null;
  height: number | null;
  bytes: number;
  provider: "cloudinary" | "local";
}

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/aac",
]);

function extensionFor(file: File): string {
  const fromName = path.extname(file.name).toLowerCase();
  if (fromName && /^\.[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  if (file.type === "image/png") return ".png";
  if (file.type === "image/webp") return ".webp";
  if (file.type === "audio/webm") return ".webm";
  if (file.type === "audio/ogg") return ".ogg";
  if (file.type === "audio/mp4") return ".m4a";
  return file.type.startsWith("audio/") ? ".mp3" : ".jpg";
}

export async function uploadImage(file: File, folder = "production"): Promise<StoredAsset> {
  if (!IMAGE_TYPES.has(file.type)) {
    throw new Error("Only JPEG, PNG or WebP images can be uploaded.");
  }
  const maxBytes = env().maxUploadMb * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(`Image must be smaller than ${env().maxUploadMb} MB.`);
  }
  return uploadFile(file, folder, "image");
}

export async function uploadAudio(file: File, folder = "voice-notes"): Promise<StoredAsset> {
  if (!AUDIO_TYPES.has(file.type)) {
    throw new Error("Unsupported audio format.");
  }
  const maxBytes = 12 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error("Voice note must be smaller than 12 MB.");
  }
  return uploadFile(file, folder, "video");
}

async function uploadFile(
  file: File,
  folder: string,
  resourceType: "image" | "video",
): Promise<StoredAsset> {
  const config = env();

  if (config.cloudinary.enabled) {
    return uploadToCloudinary(file, folder, resourceType, config.cloudinary);
  }

  return storeLocally(file, folder);
}

async function uploadToCloudinary(
  file: File,
  folder: string,
  resourceType: "image" | "video",
  cloudinary: { cloudName?: string; apiKey?: string; apiSecret?: string },
): Promise<StoredAsset> {
  const timestamp = Math.floor(Date.now() / 1000);
  const signatureBase = `folder=${folder}&timestamp=${timestamp}`;
  const signature = createHash("sha1")
    .update(`${signatureBase}${cloudinary.apiSecret}`)
    .digest("hex");

  const body = new FormData();
  body.set("file", file);
  body.set("api_key", cloudinary.apiKey!);
  body.set("timestamp", String(timestamp));
  body.set("folder", folder);
  body.set("signature", signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudinary.cloudName}/${resourceType}/upload`,
    { method: "POST", body },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Cloudinary upload failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  const json = (await response.json()) as {
    secure_url: string;
    public_id: string;
    width?: number;
    height?: number;
    bytes: number;
  };

  return {
    url: json.secure_url,
    publicId: json.public_id,
    width: json.width ?? null,
    height: json.height ?? null,
    bytes: json.bytes,
    provider: "cloudinary",
  };
}

async function storeLocally(file: File, folder: string): Promise<StoredAsset> {
  const dir = path.join(process.cwd(), ".data", "uploads");
  await fs.mkdir(dir, { recursive: true });
  const filename = `${folder}-${randomUUID()}${extensionFor(file)}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(dir, filename), buffer);
  return {
    url: `/api/files/${filename}`,
    publicId: `local:${filename}`,
    width: null,
    height: null,
    bytes: buffer.byteLength,
    provider: "local",
  };
}

export async function deleteStoredAsset(publicId: string | null): Promise<void> {
  if (!publicId) return;
  const config = env();

  if (publicId.startsWith("local:")) {
    const filename = publicId.slice("local:".length);
    if (!/^[a-zA-Z0-9._-]+$/.test(filename)) return;
    const filePath = path.join(process.cwd(), ".data", "uploads", filename);
    await fs.unlink(filePath).catch(() => undefined);
    return;
  }

  if (!config.cloudinary.enabled) return;

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHash("sha1")
    .update(`public_id=${publicId}&timestamp=${timestamp}${config.cloudinary.apiSecret}`)
    .digest("hex");

  const body = new URLSearchParams({
    public_id: publicId,
    api_key: config.cloudinary.apiKey!,
    timestamp: String(timestamp),
    signature,
  });

  await fetch(`https://api.cloudinary.com/v1_1/${config.cloudinary.cloudName}/image/destroy`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  }).catch(() => undefined);
}
