import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"
import perfectionist from "eslint-plugin-perfectionist"

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: { perfectionist },
    rules: {
      // House import order: types first, then external, then the aliased layers
      // (lib → components → hooks → app → data → test), then relative, side
      // effects, styles. Sorted by line length descending within each group.
      "perfectionist/sort-imports": [
        "error",
        {
          type: "line-length",
          order: "desc",
          newlinesBetween: 1,
          groups: [
            "type-import",
            ["value-builtin", "value-external"],
            "lib",
            "components",
            "hooks",
            "app",
            "data",
            "test",
            ["value-parent", "value-sibling", "value-index"],
            "side-effect-import",
            "unknown",
          ],
          customGroups: [
            { groupName: "lib", modifiers: ["value"], elementNamePattern: "^@/lib(/|$)" },
            {
              groupName: "components",
              modifiers: ["value"],
              elementNamePattern: "^@/components(/|$)",
            },
            { groupName: "hooks", modifiers: ["value"], elementNamePattern: "^@/hooks(/|$)" },
            { groupName: "app", modifiers: ["value"], elementNamePattern: "^@/app(/|$)" },
            { groupName: "data", modifiers: ["value"], elementNamePattern: "^@/data(/|$)" },
            { groupName: "test", modifiers: ["value"], elementNamePattern: "^@/test(/|$)" },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
])

export default eslintConfig
