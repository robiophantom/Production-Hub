// Tests must remain isolated from developer and deployment environment variables.
// Individual suites configure their own PGlite data directories and fixtures.
for (const name of [
  "DATABASE_URL",
  "GEMINI_API_KEY",
  "GEMINI_MODEL",
  "GEMINI_TRANSCRIPTION_MODEL",
  "AI_CLASSIFICATION_ENABLED",
  "AI_VOICE_ENABLED",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
]) {
  delete process.env[name];
}
