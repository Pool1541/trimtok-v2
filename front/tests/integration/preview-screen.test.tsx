import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { PreviewScreen } from "@/components/preview-screen";
import type { VideoData } from "@/lib/app-state";

const MOCK_VIDEO: VideoData = {
  videoUrl: "/mock/sample-video.mp4",
  title: "Video de prueba de TikTok",
  durationSeconds: 25,
  sourceUrl: "https://www.tiktok.com/@user/video/1",
};

function renderPreviewScreen(overrides: Partial<VideoData> = {}) {
  const dispatch = vi.fn();
  const videoData = { ...MOCK_VIDEO, ...overrides };
  const result = render(<PreviewScreen videoData={videoData} dispatch={dispatch} />);
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
