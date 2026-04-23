import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PreviewScreen } from "@/components/preview-screen";
import type { VideoData } from "@/lib/app-state";

// Mockear api-client para que useMutation no intente llamadas reales
vi.mock("@/lib/api-client", () => ({
  createJob: vi.fn(),
  getJob: vi.fn(),
  triggerDownload: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(public httpStatus: number, public code: string, message: string) {
      super(message);
    }
  },
}));
vi.mock("@/lib/ws-client", () => ({
  useJobWebSocket: vi.fn(),
}));

const MOCK_VIDEO: VideoData = {
  jobId: "test-job-123",
  videoUrl: "/mock/sample-video.mp4",
  title: "Video de prueba de TikTok",
  durationSeconds: 25,
  sourceUrl: "https://www.tiktok.com/@user/video/1",
};

function renderPreviewScreen(overrides: Partial<VideoData> = {}) {
  const dispatch = vi.fn();
  const videoData = { ...MOCK_VIDEO, ...overrides };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: 0 }, mutations: { retry: 0 } } });
  const result = render(
    <QueryClientProvider client={qc}>
      <PreviewScreen videoData={videoData} dispatch={dispatch} />
    </QueryClientProvider>,
  );
  return { dispatch, ...result };
}

describe("PreviewScreen — User Story 3", () => {
  it("muestra el título del video", () => {
    renderPreviewScreen();
    expect(screen.getByText(MOCK_VIDEO.title)).toBeInTheDocument();
  });

  it("trunca títulos de más de 120 caracteres", () => {
    const longTitle = "A".repeat(130);
    renderPreviewScreen({ title: longTitle });
    const displayed = screen.getByText(/^A+\.\.\.$/);
    expect(displayed.textContent?.length).toBeLessThanOrEqual(124); // 120 + "..."
  });

  it("botón 'Recortar' dispara OPEN_TRIM", async () => {
    const { dispatch } = renderPreviewScreen();
    await userEvent.click(screen.getByRole("button", { name: /recortar/i }));
    expect(dispatch).toHaveBeenCalledWith({ type: "OPEN_TRIM" });
  });

  it("botón 'Nueva descarga' dispara RESET", async () => {
    const { dispatch } = renderPreviewScreen();
    await userEvent.click(screen.getByRole("button", { name: /nueva descarga/i }));
    expect(dispatch).toHaveBeenCalledWith({ type: "RESET" });
  });

  it("muestra el reproductor de video", () => {
    renderPreviewScreen();
    expect(screen.getByRole("region", { name: /reproductor de video/i })).toBeInTheDocument();
  });

  it("accesibilidad — sin violaciones axe", async () => {
    const { container } = renderPreviewScreen();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
