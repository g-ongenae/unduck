import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import prettier from "eslint-config-prettier/flat";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores(["dist/**", "dist-ssr/**", ".claude/**"]),
  {
    files: ["**/*.{js,ts}"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
  },
  {
    files: ["src/**/*.ts"],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["*.js", "vite.config.ts"],
    languageOptions: { globals: globals.node },
  },
  prettier,
]);
