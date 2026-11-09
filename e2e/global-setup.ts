import { request } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3100";

/**
 * Warm the embedded database (migrations + demo seed) before the first spec so
 * a cold seed cannot consume an individual test's timeout.
 */
export default async function globalSetup() {
  const context = await request.newContext({ baseURL });
  try {
    const response = await context.get("/api/health", { timeout: 240_000 });
    if (!response.ok()) {
      throw new Error(`Health check failed with HTTP ${response.status()}`);
    }
  } finally {
    await context.dispose();
  }
}
