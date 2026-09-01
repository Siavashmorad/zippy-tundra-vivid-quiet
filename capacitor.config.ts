import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "ir.toranj.seller",
  appName: "فروشنده ترنج",
  webDir: "dist",
  // Production backend: keep the Android shell pointed at the real HTTPS app.
  // This comment also intentionally triggers a fresh Vercel deployment so newly
  // configured Production environment variables are captured by the deployment.
  server: {
    url: "https://zippy-tundra-vivid-quiet.vercel.app",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
