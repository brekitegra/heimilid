// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // supabase/functions runs in Deno (its `jsr:` import specifiers are a
    // Deno-only registry scheme), not part of this Expo app's Node/RN
    // toolchain — tsconfig.json already excludes it for the same reason.
    // Without this, ESLint's Node-based module resolver can't resolve
    // those imports and flags them as errors that don't reflect anything
    // actually wrong.
    ignores: ["dist/*", "supabase/functions/**"],
  }
]);
