import { expect, test } from "@playwright/test";

async function boot(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.evaluate(() => {
    window.__SHIPKIT_E2E_BRIDGE__?.controls.reset();
  });
  await page.goto("/");
}

async function openWorkspace(
  page: import("@playwright/test").Page,
  name: string,
) {
  const navigation = page.getByRole("navigation", { name: /primary/i });
  await navigation.getByRole("button", { name: new RegExp(`^${name}\\b`, "i") }).click();
  await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
}

test.describe("ShipKit operator smoke", () => {
  test.beforeEach(async ({ page }) => {
    await boot(page);
  });

  test("completes the main local operator journey and persists restart state", async ({
    page,
  }) => {
    await expect(page.getByRole("heading", { level: 2, name: "Home" })).toBeVisible();
    await expect(page.getByText(/monitor runtime health/i)).toBeVisible();

    await openWorkspace(page, "Database");
    await expect(page.getByText(/1 migration\(s\) still need to be applied/i)).toBeVisible();
    await page.getByRole("button", { name: /apply pending/i }).click();
    await expect(page.getByText(/applied 1 pending migration/i)).toBeVisible();
    await expect(page.getByText(/the local schema is already current/i)).toBeVisible();

    await openWorkspace(page, "Theme");
    await page.getByRole("button", { name: /^sunrise$/i }).click();
    await expect(page.getByRole("heading", { name: /sunrise \(light\)/i })).toBeVisible();

    await openWorkspace(page, "Settings");
    await page.getByLabel(/startup route/i).selectOption("plugins");
    await page.getByLabel(/default log level/i).selectOption("WARN");
    await page.getByRole("checkbox", { name: /confirm before rollback/i }).uncheck();
    await page.getByRole("button", { name: /save preferences/i }).click();
    await expect(page.getByText(/desktop preferences saved/i)).toBeVisible();

    await openWorkspace(page, "Plugins");
    await page.getByRole("button", { name: /enable plugin/i }).first().click();
    await expect(page.getByText(/enabled for this desktop workspace/i)).toBeVisible();

    await openWorkspace(page, "Diagnostics");
    await page
      .getByRole("main")
      .getByRole("button", { name: /^export support bundle$/i })
      .click();
    await expect(page.getByText(/support bundle exported with/i)).toBeVisible();
    await expect(page.getByText(/enabled plugins:/i)).toBeVisible();

    await openWorkspace(page, "Updates");
    await expect(
      page.getByText(/local-only macOS build/i),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /local build only/i }),
    ).toBeDisabled();

    await page.evaluate(() => {
      window.location.hash = "";
    });
    await page.reload();

    await expect(page.getByRole("heading", { level: 2, name: "Plugins" })).toBeVisible();
    await expect(page.getByRole("button", { name: /disable plugin/i })).toHaveCount(2);

    await openWorkspace(page, "Theme");
    await expect(page.getByRole("heading", { name: /sunrise \(light\)/i })).toBeVisible();
  });

  test("surfaces the main local-only and operator failure paths cleanly", async ({
    page,
  }) => {
    await openWorkspace(page, "Database");
    await page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: /rollback last/i }).click();
    await expect(
      page.getByText(/rolled back migration create_notes/i),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /rollback last/i })).toBeDisabled();

    await page.evaluate(() => {
      window.__SHIPKIT_E2E_BRIDGE__?.controls.setFault("pluginToggle", true);
    });
    await openWorkspace(page, "Plugins");
    await page.getByRole("button", { name: /enable plugin/i }).first().click();
    await expect(page.getByText(/plugin state could not be saved/i)).toBeVisible();

    await page.evaluate(() => {
      window.__SHIPKIT_E2E_BRIDGE__?.controls.setFault("exportSupportBundle", true);
    });
    await openWorkspace(page, "Diagnostics");
    await page
      .getByRole("main")
      .getByRole("button", { name: /^export support bundle$/i })
      .click();
    await expect(page.getByText(/support bundle could not be exported/i)).toBeVisible();

    await openWorkspace(page, "Updates");
    await expect(
      page.getByText(/no updater feed is embedded in this local-only build yet/i),
    ).toBeVisible();
  });
});
