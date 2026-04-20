import babel from "@rolldown/plugin-babel";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
    babel({ presets: [reactCompilerPreset()] }),
    cloudflare({
      configPath: "../wrangler.jsonc",
      persistState: { path: "../.wrangler/state" },
    }),
  ],
  resolve: {
    tsconfigPaths: true,
  },
});
