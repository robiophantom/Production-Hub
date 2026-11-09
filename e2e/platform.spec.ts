import { expect, test, type Page } from "@playwright/test";

const ORDER_B_88213 = "70000000-0000-4000-8000-000000000001";
const ORDER_C_0488 = "70000000-0000-4000-8000-000000000003";

async function login(page: Page, email: string, password: string, landing: RegExp) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(landing);
}

test("redirects unauthenticated visitors and protects the reports API", async ({
  page,
  request,
}) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);

  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect((await health.json()).status).toBe("ok");

  const response = await request.get("/api/reports/orders?format=xlsx");
  expect(response.status()).toBe(401);
});

test("merchandiser sees only assigned orders and is blocked from administration", async ({
  page,
}) => {
  await login(page, "merch@company-a.test", "Merch@12345", /\/dashboard$/);

  await expect(
    page.getByRole("heading", { name: "My production overview" }),
  ).toBeVisible();

  await page.goto("/orders");
  await expect(page.getByRole("heading", { name: "Purchase orders" })).toBeVisible();
  await expect(page.getByText("B-PO-88213").first()).toBeVisible();
  await expect(page.getByText("B-PO-88301")).toHaveCount(0);

  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("super admin can reach administration but ordinary roles cannot", async ({ page }) => {
  await login(page, "admin@company-a.test", "Admin@12345", /\/dashboard$/);

  await page.goto("/admin/users");
  await expect(page.getByRole("heading", { name: "Users & roles" })).toBeVisible();

  await page.goto("/admin/activity");
  await expect(page.getByRole("heading", { name: "Activity & audit" })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Audit log/ })).toBeVisible();
});

test("buyer cannot reach another buyer's order by changing the URL", async ({ page }) => {
  await login(page, "buyer@company-b.test", "Buyer@12345", /\/buyer$/);

  await expect(page.getByRole("heading", { name: "My orders", exact: true })).toBeVisible();
  await expect(page.getByText("B-PO-88213").first()).toBeVisible();
  await expect(page.getByText("C-PO-0488")).toHaveCount(0);

  const response = await page.goto(`/buyer/orders/${ORDER_C_0488}`);
  expect(response?.status()).toBe(404);

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/buyer$/);
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/buyer$/);
});

test("supervisor is restricted to the factory-floor workspace", async ({ page }) => {
  await login(page, "supervisor@company-a.test", "Super@12345", /\/supervisor$/);

  await expect(page.getByRole("heading", { name: /Vanakkam, Karthik/ })).toBeVisible();
  await expect(page.getByText(/Record today's completed pieces/)).toBeVisible();

  await page.goto("/orders");
  await expect(page).toHaveURL(/\/supervisor$/);
  await page.goto("/reports");
  await expect(page).toHaveURL(/\/supervisor$/);
});

test("merchandiser can scan delay alerts and inspect the transparent calculation", async ({
  page,
}) => {
  await login(page, "merch@company-a.test", "Merch@12345", /\/dashboard$/);

  await page.goto("/alerts");
  await expect(page.getByRole("heading", { name: "Delay alerts" })).toBeVisible();
  await page.getByRole("button", { name: /Run delay scan/ }).click();
  await expect(page.getByText(/Delay scan complete/)).toBeVisible();

  await page.goto(`/orders/${ORDER_B_88213}?tab=delay`);
  await expect(page.getByText("Order health")).toBeVisible();
  await expect(page.getByText(/AI is never used to determine delays/)).toBeVisible();
  await expect(page.getByText("Required / day").first()).toBeVisible();
  await expect(page.getByText("Actual / day").first()).toBeVisible();
});

test("merchandiser can download Excel and PDF reports", async ({ page }) => {
  await login(page, "merch@company-a.test", "Merch@12345", /\/dashboard$/);

  await page.goto("/reports?type=orders");
  await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: /Excel/i }).first().click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  expect(await download.path()).toBeTruthy();

  const pdf = await page.request.get("/api/reports/orders?format=pdf");
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");
  expect((await pdf.body()).byteLength).toBeGreaterThan(1000);
});

test("share links open without a session, then stop working when revoked", async ({
  page,
  browser,
}) => {
  await login(page, "merch@company-a.test", "Merch@12345", /\/dashboard$/);

  await page.goto(`/orders/${ORDER_B_88213}/share`);
  const label = `E2E buyer review ${Date.now()}`;
  await page.locator("#share-label").fill(label);
  await page.getByRole("button", { name: /Create read-only link/ }).click();

  const urlInput = page.locator("input[readonly]").first();
  await expect(urlInput).toHaveValue(/\/share\/[A-Za-z0-9_-]{20,}/);
  const link = await urlInput.inputValue();

  const guest = await browser.newContext();
  const guestPage = await guest.newPage();
  const shared = await guestPage.goto(link);
  expect(shared?.status()).toBe(200);
  await expect(guestPage.getByText("Read-only shared view")).toBeVisible();
  await expect(guestPage.getByRole("heading", { name: /B-PO-88213/ })).toBeVisible();
  await expect(guestPage.getByText(/This read-only link expires/)).toBeVisible();
  await guest.close();

  await page.reload();
  await expect(page.getByText(label)).toBeVisible();
  await page.getByRole("button", { name: "Revoke", exact: true }).first().click();
  await page.getByRole("button", { name: "Revoke link" }).click();
  await expect(page.getByText(/Share link revoked/)).toBeVisible();

  const revokedGuest = await browser.newContext();
  const revokedPage = await revokedGuest.newPage();
  const rejected = await revokedPage.goto(link);
  expect(rejected?.status()).toBe(404);
  await revokedGuest.close();
});
