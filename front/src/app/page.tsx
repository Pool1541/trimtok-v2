"use client";

import { useReducer } from "react";
import { appReducer, initialState } from "@/lib/app-state";
import { HomeScreen } from "@/components/home-screen";
import { DownloadingScreen } from "@/components/downloading-screen";
import { PreviewScreen } from "@/components/preview-screen";
import { TrimScreen } from "@/components/trim-screen";

// FR-015: Toda la navegación se gestiona en el cliente sin recarga de página
export default function Home() {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <div className="flex flex-col min-h-screen bg-[var(--trimtok-bg)] text-[var(--trimtok-text)]">
      {state.screen === "home" && <HomeScreen dispatch={dispatch} />}
      {state.screen === "downloading" && (
        <DownloadingScreen url={state.url} dispatch={dispatch} />
      )}
      {state.screen === "preview" && (
        <PreviewScreen videoData={state.videoData} dispatch={dispatch} />
      )}
      {state.screen === "trim" && (
        <TrimScreen
          videoData={state.videoData}
          trimSelection={state.trimSelection}
          trimResult={state.trimResult}
          dispatch={dispatch}
        />
      )}
    </div>
  );
}

