import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { axe } from "vitest-axe";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DownloadingScreen } from "@/components/downloading-screen";

// Mockear módulos de infraestructura para tests de integración
vi.mock("@/lib/api-client", () => ({
  createJob: vi.fn(),
  getJob: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(public httpStatus: number, public code: string, message: string) {
      super(message);
    }
  },
}));
vi.mock("@/lib/ws-client", () => ({
  useJobWebSocket: vi.fn(),
}));

import { createJob, getJob } from "@/lib/api-client";
import { useJobWebSocket } from "@/lib/ws-client";

const TEST_URL = "https://www.tiktok.com/@user/video/1";

function renderDownloadingScreen() {
  const dispatch = vi.fn();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: 0 }, mutations: { retry: 0 } } });
  const result = render(
    <QueryClientProvider client={qc}>
      <DownloadingScreen url={TEST_URL} dispatch={dispatch} />
    </QueryClientProvider>,
  );
  return { dispatch, ...result };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useJobWebSocket).mockReturnValue({
    isConnected: false,
    isConnecting: false,
    connectionError: null,
  });
});

describe("DownloadingScreen — User Story 2", () => {
  it("(AC1) muestra barra de progreso con role=progressbar", () => {
    vi.mocked(createJob).mockResolvedValue({ jobId: "j1", status: "pending" });
    renderDownloadingScreen();
    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toBeInTheDocument();
  });

  it("(AC2) muestra texto 'Descargando...'", () => {
    vi.mocked(createJob).mockResolvedValue({ jobId: "j1", status: "pending" });
    renderDownloadingScreen();
    expect(screen.getByText("Descargando...")).toBeInTheDocument();
  });

  it("(AC3) dispatch DOWNLOAD_COMPLETE cuando createJob retorna cache hit", async () => {
    vi.mocked(createJob).mockResolvedValue({
      jobId: "j-cached",
      status: "ready",
      downloadUrl: "https://example.com/video.mp4",
    });
    vi.mocked(getJob).mockResolvedValue({
      jobId: "j-cached",
      status: "ready",
      format: "mp4",
      title: "Test Video",
      duration: 25,
      thumbnailUrl: null,
      trimStart: null,
      trimEnd: null,
      downloadUrl: "https://example.com/video.mp4",
      errorMessage: null,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:01Z",
    });
    const { dispatch } = renderDownloadingScreen();
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: "DOWNLOAD_COMPLETE" }),
      );
    });
    const call = dispatch.mock.calls[0][0];
    expect(call.videoData.jobId).toBe("j-cached");
    expect(call.videoData.videoUrl).toBe("https://example.com/video.mp4");
  });

  it("(AC4) dispatch DOWNLOAD_ERROR cuando createJob falla", async () => {
    vi.mocked(createJob).mockRejectedValue(new Error("Network error"));
    const { dispatch } = renderDownloadingScreen();
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: "DOWNLOAD_ERROR" }),
      );
    });
  });

  it("accesibilidad — sin violaciones axe", async () => {
    vi.mocked(createJob).mockResolvedValue({ jobId: "j1", status: "pending" });
    const { container } = renderDownloadingScreen();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

