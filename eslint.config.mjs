import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["server/**/*.js", "scripts/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["src/components/SystemDashboard.tsx", "src/components/SystemInfo.tsx", "src/components/SystemMetricsDashboard.tsx", "src/components/SystemGraphView.tsx", "src/components/TokenUsage.tsx", "src/features/agents/components/AgentInspectPanels.tsx", "src/components/AvatarModeContext.tsx"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Vendored third-party code (kept as-is; linting it adds noise).
    "src/lib/avatars/vendor/**",
  ]),
  prettier,
]);

export default eslintConfig;
