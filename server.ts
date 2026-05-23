import app, { startListening } from "./api/index.ts";

if (!process.env.VERCEL) {
  startListening().catch((error) => {
    console.error("Failed to start server listening from server entrypoint:", error);
  });
}

export default app;
