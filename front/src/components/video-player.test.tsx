import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { VideoPlayer } from "@/components/video-player";

function renderPlayer(props: { src?: string; startTime?: number; endTime?: number } = {}) {
  return render(
    <VideoPlayer
      src={props.src ?? "/mock/sample-video.mp4"}
      startTime={props.startTime}
      endTime={props.endTime}
    />,
  );
}

describe("VideoPlayer — User Story 3", () => {
  it("renderiza un elemento video con src correcto", () => {
    renderPlayer({ src: "/mock/sample-video.mp4" });
    const video = screen.getByRole("region").querySelector("video");
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute("src", "/mock/sample-video.mp4");
  });

  it("tiene atributo controls", () => {
    renderPlayer();
    const video = screen.getByRole("region").querySelector("video");
    expect(video).toHaveAttribute("controls");
  });

  it("tiene role='region' con aria-label", () => {
    renderPlayer();
    const region = screen.getByRole("region", { name: /reproductor de video/i });
    expect(region).toBeInTheDocument();
  });

  it("accesibilidad — sin violaciones axe", async () => {
    const { container } = renderPlayer();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
