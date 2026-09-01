import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "ir.toranj.seller",
  appName: "فروشنده ترنج",
  webDir: "dist",
  server: {
    url: "https://zippy-tundra-vivid-quiet.vercel.app",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
