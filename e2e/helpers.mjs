// Shared by the browser tests: a Vite dev server for the e2e pages, and Chrome.
import { createServer } from "vite";
import { chromium } from "playwright-core";

export const startServer = async () => {
  const server = await createServer({
    logLevel: "silent",
    server: { port: 0 },
    // pre-bundle up front, so the dev server doesn't reload the page mid-test
    optimizeDeps: {
      include: [
        "react",
        "react-dom/client",
        "react-window",
        "@atlaskit/pragmatic-drag-and-drop/element/adapter"
      ]
    }
  });
  await server.listen();
  return server;
};

// Runs `fn(page, baseUrl)` against a fresh server and Chrome, then cleans up.
export const withPage = async (fn, viewport = { width: 1440, height: 800 }) => {
  const server = await startServer();
  const browser = await chromium.launch({ channel: "chrome" });
  try {
    const page = await browser.newPage({ viewport });
    await fn(page, server.resolvedUrls.local[0]);
  } finally {
    await browser.close();
    await server.close();
  }
};
