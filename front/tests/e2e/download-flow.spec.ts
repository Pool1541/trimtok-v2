import { test, expect } from "@playwright/test";

const MOCK_JOB_ID = "e2e-job-test-001";
const MOCK_VIDEO_URL = "https://example-bucket.s3.amazonaws.com/video.mp4?presigned=1";
const MOCK_TIKTOK_URL = "https://www.tiktok.com/@user/video/7123456789012345678";

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
    await page.getByRole("textbox", { name: /url del video/i }).pressSequentially("https://youtube.com/watch?v=abc");
    await page.getByRole("button", { name: /descargar/i }).click();
    await expect(page.getByTestId("url-error-message")).toContainText("no apunta a un video de TikTok");
  });

  test("(HE4) URL TikTok válida navega a pantalla de descarga", async ({ page }) => {
    // Mock the API to return pending status (job enqueued)
    await page.route("**/v1/jobs", (route) =>
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ jobId: MOCK_JOB_ID, status: "pending" }),
      }),
    );

    await page.getByRole("textbox", { name: /url del video/i }).pressSequentially(MOCK_TIKTOK_URL);
    await page.getByRole("button", { name: /descargar/i }).click();

    // Debe aparecer la pantalla de descarga con barra de progreso
    await expect(page.getByRole("progressbar")).toBeVisible();
    await expect(page.getByText("Descargando...")).toBeVisible();
  });

  test("(HE5) cache hit navega a vista previa con datos reales del backend", async ({ page }) => {
    // Mock POST /v1/jobs → cache hit (HTTP 200, status: ready)
    await page.route("**/v1/jobs", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jobId: MOCK_JOB_ID,
          status: "ready",
          downloadUrl: MOCK_VIDEO_URL,
        }),
      }),
    );

    // Mock GET /v1/jobs/:jobId → full job details
    await page.route(`**/v1/jobs/${MOCK_JOB_ID}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jobId: MOCK_JOB_ID,
          status: "ready",
          format: "mp4",
          title: "Video de prueba E2E de TikTok",
          duration: 30,
          thumbnailUrl: null,
          trimStart: null,
          trimEnd: null,
          downloadUrl: MOCK_VIDEO_URL,
          errorMessage: null,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:01Z",
        }),
      }),
    );

    await page.getByRole("textbox", { name: /url del video/i }).pressSequentially(MOCK_TIKTOK_URL);
    await page.getByRole("button", { name: /descargar/i }).click();

    // Esperar a que aparezca vista previa con datos reales
    await expect(page.getByRole("heading", { name: /vista previa/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Video de prueba E2E de TikTok")).toBeVisible();
  });

  test("(HE6) botón Nueva descarga en vista previa vuelve al home", async ({ page }) => {
    // Mock para llegar a la vista previa directamente
    await page.route("**/v1/jobs", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ jobId: MOCK_JOB_ID, status: "ready", downloadUrl: MOCK_VIDEO_URL }),
      }),
    );
    await page.route(`**/v1/jobs/${MOCK_JOB_ID}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jobId: MOCK_JOB_ID,
          status: "ready",
          format: "mp4",
          title: "Test",
          duration: 10,
          thumbnailUrl: null,
          trimStart: null,
          trimEnd: null,
          downloadUrl: MOCK_VIDEO_URL,
          errorMessage: null,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:01Z",
        }),
      }),
    );

    await page.getByRole("textbox", { name: /url del video/i }).pressSequentially(MOCK_TIKTOK_URL);
    await page.getByRole("button", { name: /descargar/i }).click();
    await expect(page.getByRole("heading", { name: /vista previa/i })).toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: /nueva descarga/i }).click();
    await expect(page.getByRole("button", { name: /descargar/i })).toBeVisible();
  });
});

