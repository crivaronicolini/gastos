import { rmSync } from "node:fs";
import path from "node:path";

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
    {
      name: "remove-local-dev-vars-from-build",
      closeBundle() {
        rmSync(path.resolve(__dirname, "dist/gastos/.dev.vars"), { force: true });
      },
    },
  ],
  resolve: {
    alias: {
      "@better-auth-ui/react/core": path.resolve(
        __dirname,
        "node_modules/@better-auth-ui/react/dist/core.js",
      ),
      "@better-auth-ui/react": path.resolve(__dirname, "src/lib/better-auth-ui-react.ts"),
    },
    tsconfigPaths: true,
  },
});
