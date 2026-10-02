// @ts-check
import eslintReact from "@eslint-react/eslint-plugin"
import js from "@eslint/js"
import nextPlugin from "@next/eslint-plugin-next"
import prettier from "eslint-config-prettier"
import jsxA11y from "eslint-plugin-jsx-a11y-x"
import reactHooks from "eslint-plugin-react-hooks"
import unicorn from "eslint-plugin-unicorn"
import { defineConfig, globalIgnores } from "eslint/config"
import globals from "globals"
import tseslint from "typescript-eslint"

export default defineConfig(
  globalIgnores(["**/node_modules/**", "**/.next/**", "**/out/**", "**/next-env.d.ts"]),

  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ["*.mjs", "apps/web/*.mjs"] },
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.browser, ...globals.node },
    },
    linterOptions: { reportUnusedDisableDirectives: "error" },
  },

  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      eslintReact.configs["strict-type-checked"],
      reactHooks.configs.flat["recommended-latest"],
      jsxA11y.configs.strict,
    ],
    plugins: { unicorn },
    rules: {
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "@typescript-eslint/consistent-type-definitions": ["error", "interface"],
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-import-type-side-effects": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: false }],
      "@typescript-eslint/no-confusing-void-expression": ["error", { ignoreArrowShorthand: false }],
      "@typescript-eslint/strict-boolean-expressions": [
        "error",
        { allowString: false, allowNumber: false, allowNullableObject: true },
      ],
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-console": ["error", { allow: ["warn", "error"] }],
      "prefer-const": "error",
      "object-shorthand": "error",
      curly: ["error", "multi-line"],
      "unicorn/prefer-node-protocol": "error",
      "unicorn/no-for-each": "error",
      "unicorn/prefer-at": "error",
      "unicorn/no-useless-undefined": "error",
      "unicorn/prefer-string-slice": "error",
      "unicorn/throw-new-error": "error",
      "unicorn/no-lonely-if": "error",
      "unicorn/prefer-ternary": ["error", "only-single-line"],
      "unicorn/filename-case": ["error", { case: "kebabCase" }],
    },
  },

  {
    files: ["apps/web/**/*.{ts,tsx}"],
    plugins: { "@next/next": nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
    settings: { next: { rootDir: "apps/web" } },
  },

  {
    // The UI library must never depend on the app.
    files: ["packages/ui/**/*.{ts,tsx}"],
    plugins: { "@next/next": nextPlugin },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/*", "@autoresearch/web", "next", "next/*"],
              message: "packages/ui is framework-agnostic.",
            },
          ],
        },
      ],
    },
  },

  {
    files: ["**/*.mjs"],
    extends: [tseslint.configs.disableTypeChecked],
  },

  {
    files: ["apps/web/scripts/**"],
    rules: { "no-console": "off" },
  },

  prettier,
)
