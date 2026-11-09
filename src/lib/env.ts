import { z } from "zod";

const booleanish = z
  .string()
  .optional()
  .transform((value) => {
    if (value === undefined || value === "") return undefined;
    return ["1", "true", "yes", "on"].includes(value.toLowerCase());
  });

const schema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  SUPABASE_SECRET_KEY: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  BUSINESS_TIMEZONE: z.string().optional(),
  AUTH_SECRET: z.string().optional(),
  SEED_DEMO_DATA: booleanish,
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().optional(),
  GEMINI_TRANSCRIPTION_MODEL: z.string().optional(),
  AI_CLASSIFICATION_ENABLED: booleanish,
  AI_VOICE_ENABLED: booleanish,
  MAX_UPLOAD_MB: z.string().optional(),
});

function read() {
  const parsed = schema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  const raw = parsed.data;
  const supabaseUrl = raw.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    raw.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseSecretKey =
    raw.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  const aiEnabled =
    raw.AI_CLASSIFICATION_ENABLED ??
    Boolean(raw.GEMINI_API_KEY && raw.GEMINI_API_KEY.length > 10);

  return {
    appUrl:
      raw.NEXT_PUBLIC_APP_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"),
    supabaseUrl,
    supabasePublishableKey,
    supabaseSecretKey,
    databaseUrl: raw.DATABASE_URL,
    businessTimezone: raw.BUSINESS_TIMEZONE ?? "Asia/Kolkata",
    authSecret: raw.AUTH_SECRET ?? "dev-only-insecure-secret-change-me",
    seedDemoData: raw.SEED_DEMO_DATA ?? !raw.DATABASE_URL,
    cloudinary: {
      cloudName: raw.CLOUDINARY_CLOUD_NAME,
      apiKey: raw.CLOUDINARY_API_KEY,
      apiSecret: raw.CLOUDINARY_API_SECRET,
      enabled: Boolean(
        raw.CLOUDINARY_CLOUD_NAME && raw.CLOUDINARY_API_KEY && raw.CLOUDINARY_API_SECRET,
      ),
    },
    ai: {
      apiKey: raw.GEMINI_API_KEY,
      model: raw.GEMINI_MODEL ?? "gemini-2.5-flash",
      transcriptionModel: raw.GEMINI_TRANSCRIPTION_MODEL ?? raw.GEMINI_MODEL ?? "gemini-2.5-flash",
      classificationEnabled: aiEnabled,
      voiceEnabled: raw.AI_VOICE_ENABLED ?? aiEnabled,
      enabled: Boolean(raw.GEMINI_API_KEY && raw.GEMINI_API_KEY.length > 10),
    },
    maxUploadMb: Number(raw.MAX_UPLOAD_MB ?? 8),
  };
}

export type AppEnv = ReturnType<typeof read>;

let cached: AppEnv | null = null;

export function env(): AppEnv {
  if (!cached) cached = read();
  return cached;
}

export function supabaseAuthEnabled(): boolean {
  const e = env();
  return Boolean(e.supabaseUrl && e.supabasePublishableKey);
}

export function embeddedDbEnabled(): boolean {
  return !env().databaseUrl;
}

/**
 * Fail fast in a serverless deployment without a durable database. Locally the
 * embedded PostgreSQL (PGlite) fallback keeps the whole app runnable with zero
 * credentials.
 */
export function assertDatabaseConfigured(): void {
  const e = env();
  if (!e.databaseUrl && process.env.VERCEL) {
    throw new Error(
      "DATABASE_URL is required on Vercel. Point it at your Supabase Postgres pooler " +
        "connection string, or run the app locally where the embedded PostgreSQL fallback is used.",
    );
  }
  if (!e.databaseUrl && e.authSecret === "dev-only-insecure-secret-change-me" && process.env.NODE_ENV === "production" && process.env.VERCEL) {
    throw new Error("AUTH_SECRET is required in production when local authentication is used.");
  }
}
