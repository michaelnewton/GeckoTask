import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig(
  {
    ignores: ["main.js", "node_modules/**", ".obsidian/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    plugins: {
      obsidianmd,
    },
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    rules: {
      // Keep initial rollout non-blocking for existing code.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-useless-assignment": "warn",
      "prefer-const": "warn",
      "no-useless-catch": "off",
      // Start with high-signal Obsidian checks and expand later.
      "obsidianmd/validate-manifest": "error",
      "obsidianmd/no-forbidden-elements": "error",
      "obsidianmd/detach-leaves": "warn",
      "obsidianmd/no-plugin-as-component": "warn",
      "obsidianmd/vault/iterate": "warn",
      "obsidianmd/validate-license": "warn",
      // Keep existing command IDs/UI casing and hotkeys for now.
      "obsidianmd/commands/no-plugin-id-in-command-id": "off",
      "obsidianmd/commands/no-default-hotkeys": "off",
      "obsidianmd/ui/sentence-case": "off",
    },
  },
);
