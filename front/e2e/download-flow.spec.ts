import { test, expect } from "@playwright/test";

// E2E: Flujo completo de descarga (Home → Descargando → Vista previa)
test.describe("Flujo de descarga — T036", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("(HE1) home muestra título TrimTok y campo de URL", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /descarga y recorta/i })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /url del video/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /descargar/i })).toBeVisible();
  });

  test("(HE2) submit vacío muestra error", async ({ page }) => {
    await page.getByRole("button", { name: /descargar/i }).click();
    await expect(page.getByTestId("url-error-message")).toContainText("Pega un enlace de TikTok");
  });

  test("(HE3) URL de dominio incorrecto muestra error de dominio", async ({ page }) => {
    await page.getByRole("textbox", { name: /url del video/i }).fill("https://youtube.com/watch?v=abc");
    await page.getByRole("button", { name: /descargar/i }).click();
    await expect(page.getByTestId("url-error-message")).toContainText("no apunta a un video de TikTok");
  });

  test("(HE4) URL TikTok válida navega a pantalla de descarga", async ({ page }) => {
    await page.getByRole("textbox", { name: /url del video/i }).fill(
      "https://www.tiktok.com/@user/video/7123456789012345678",
    );
    await page.getByRole("button", { name: /descargar/i }).click();

    // Debe aparecer la pantalla de descarga con barra de progreso
    await expect(page.getByRole("progressbar")).toBeVisible();
    await expect(page.getByText("Descargando...")).toBeVisible();
  });

  test("(HE5) tras 2500ms navega a vista previa", async ({ page }) => {
    await page.getByRole("textbox", { name: /url del video/i }).fill(
      "https://www.tiktok.com/@user/video/7123456789012345678",
    );
    await page.getByRole("button", { name: /descargar/i }).click();

    // Esperar hasta 4s a que desaparezca el progressbar y aparezca vista previa
    await expect(page.getByRole("progressbar")).toBeVisible();
    await expect(page.getByRole("heading", { name: /vista previa/i })).toBeVisible({ timeout: 4000 });
  });

  test("(HE6) botón Nueva descarga en vista previa vuelve al home", async ({ page }) => {
    await page.getByRole("textbox", { name: /url del video/i }).fill(
      "https://www.tiktok.com/@user/video/7123456789012345678",
    );
    await page.getByRole("button", { name: /descargar/i }).click();
    await expect(page.getByRole("heading", { name: /vista previa/i })).toBeVisible({ timeout: 4000 });

    await page.getByRole("button", { name: /nueva descarga/i }).click();
    await expect(page.getByRole("button", { name: /descargar/i })).toBeVisible();
  });
});
