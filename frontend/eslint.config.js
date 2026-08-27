import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    files: ["src/routes/**/*.tsx"],
    rules: {
      // TanStack Router route modules must export Route alongside their components.
      "react-refresh/only-export-components": "off",
    },
  },
  {
    files: ["src/components/ui/{badge,button,tabs}.tsx"],
    rules: {
      // These shadcn components expose reusable variant definitions with the component.
      "react-refresh/only-export-components": "off",
    },
  },
]);
