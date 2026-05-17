import { createRoot } from "react-dom/client";
import { Buffer } from "buffer/";
import App from "./App.tsx";
import "./index.css";

const CHUNK_RELOAD_FLAG = "crm_chunk_reload_once";

const isChunkLoadError = (value: unknown): boolean => {
  if (!value) return false;
  const text = typeof value === "string"
    ? value
    : value instanceof Error
      ? value.message
      : String(value);

  return (
    text.includes("Failed to fetch dynamically imported module") ||
    text.includes("Importing a module script failed") ||
    text.includes("Loading chunk")
  );
};

const reloadOnceForChunkError = () => {
  const hasReloaded = sessionStorage.getItem(CHUNK_RELOAD_FLAG) === "1";
  if (hasReloaded) {
    sessionStorage.removeItem(CHUNK_RELOAD_FLAG);
    return;
  }

  sessionStorage.setItem(CHUNK_RELOAD_FLAG, "1");
  window.location.reload();
};

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  reloadOnceForChunkError();
});

window.addEventListener("error", (event) => {
  if (isChunkLoadError(event.error ?? event.message)) {
    reloadOnceForChunkError();
  }
});

window.addEventListener("unhandledrejection", (event) => {
  if (isChunkLoadError(event.reason)) {
    event.preventDefault();
    reloadOnceForChunkError();
  }
});

// qrcode/@react-pdf dependencies expect Node's Buffer in browser runtime.
if (typeof globalThis.Buffer === "undefined") {
  globalThis.Buffer = Buffer as unknown as typeof globalThis.Buffer;
}

createRoot(document.getElementById("root")!).render(<App />);
