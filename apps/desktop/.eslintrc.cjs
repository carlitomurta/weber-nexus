module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
  ],
  ignorePatterns: ["dist", ".eslintrc.cjs"],
  parser: "@typescript-eslint/parser",
  plugins: ["react-refresh"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "@tanstack/react-query",
            importNames: ["useMutation", "useQuery", "useQueryClient"],
            message:
              "Crie hooks em src/hooks/react-query para encapsular TanStack Query.",
          },
        ],
      },
    ],
    "react-refresh/only-export-components": [
      "warn",
      { allowConstantExport: true },
    ],
  },
  overrides: [
    {
      files: ["src/hooks/react-query/**/*.ts", "src/hooks/react-query/**/*.tsx"],
      rules: {
        "no-restricted-imports": "off",
      },
    },
  ],
};
