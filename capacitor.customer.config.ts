import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "ir.toranj.customer",
  appName: "مشتری ترنج",
  webDir: "dist",
  server: {
    url: "https://zippy-tundra-vivid-quiet.vercel.app/c",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
