import { defineConfig } from "vite";
import { kagiBangs } from "./scripts/kagi-bangs.mjs";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/unduck/",
  plugins: [
    kagiBangs(),
    VitePWA({
      registerType: "autoUpdate",
    }),
  ],
});
