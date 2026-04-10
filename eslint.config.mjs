import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {

      // Errors
      "for-direction": "error",
      "no-redeclare": "error",
      "no-cond-assign": "error",
      "no-const-assign": "error",
      "no-dupe-else-if": "error",
      "no-invalid-regexp": "error",
      "no-loss-of-precision": "error",
      "no-self-assign": "error",
      "no-self-compare": "error",
      "no-unmodified-loop-condition": "error",
      "no-unreachable-loop": "error",
      "no-unreachable": "error",
      "no-use-before-define": "error",
      "react/no-deprecated": "error",

      // Warns
      "no-duplicate-imports": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_"
      }],
      "no-fallthrough": "warn",
      "no-lonely-if": "warn",
      "no-empty": "warn",
      "curly": ["warn", "all"],
      "prefer-const": "warn",
      "no-useless-concat": "warn",
      "no-useless-escape": "warn",
      "no-useless-return": "warn",
      "no-useless-rename": "warn",
      "no-return-assign": "warn",

      // User-uploaded images have dynamic dimensions; next/image requires
      // explicit width/height which isn't practical for this use case.
      "@next/next/no-img-element": "off",
    }
  }
]);

export default eslintConfig;
