import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Relaxed rules for production build
      "@typescript-eslint/no-unused-vars": process.env.NODE_ENV === 'production' ? "warn" : "error",
      "@typescript-eslint/no-explicit-any": process.env.NODE_ENV === 'production' ? "warn" : "error", 
      "@typescript-eslint/no-require-imports": process.env.NODE_ENV === 'production' ? "warn" : "error",
      "react/no-unescaped-entities": process.env.NODE_ENV === 'production' ? "warn" : "error",
      "react-hooks/exhaustive-deps": process.env.NODE_ENV === 'production' ? "warn" : "error",
      "@next/next/no-img-element": process.env.NODE_ENV === 'production' ? "warn" : "error",
      "@next/next/no-page-custom-font": process.env.NODE_ENV === 'production' ? "warn" : "error",
      
      // Completely disable for production
      ...(process.env.NODE_ENV === 'production' && {
        "@typescript-eslint/no-unused-vars": "off",
        "@typescript-eslint/no-explicit-any": "off",
      })
    },
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/build/**",
      "**/*.config.js",
      "**/*.config.ts",
      "**/prisma/**",
      "**/public/**"
    ]
  }
];

export default eslintConfig; 