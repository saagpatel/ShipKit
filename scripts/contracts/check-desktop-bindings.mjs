import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function extractTsInterfaceFields(source, interfaceName) {
  const match = source.match(
    new RegExp(`export interface ${interfaceName} \\{([\\s\\S]*?)\\n\\}`, "m"),
  );
  if (!match) {
    throw new Error(`Missing TypeScript interface ${interfaceName}`);
  }

  return match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.match(/^([A-Za-z0-9_]+)\??:/)?.[1] ?? null)
    .filter(Boolean)
    .sort();
}

function extractTsUnionValues(source, typeName) {
  const match = source.match(
    new RegExp(`export type ${typeName} = ([^;]+);`, "m"),
  );
  if (!match) {
    throw new Error(`Missing TypeScript type ${typeName}`);
  }

  return match[1]
    .split("|")
    .map((value) => value.trim().replace(/^"|"$/g, ""))
    .filter(Boolean)
    .sort();
}

function extractRustStructFields(source, structName) {
  const match = source.match(
    new RegExp(`pub struct ${structName} \\{([\\s\\S]*?)\\n\\}`, "m"),
  );
  if (!match) {
    throw new Error(`Missing Rust struct ${structName}`);
  }

  return match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("pub "))
    .map((line) => line.match(/^pub\s+([A-Za-z0-9_]+)\s*:/)?.[1] ?? null)
    .filter(Boolean)
    .sort();
}

function extractRustEnumVariants(source, enumName) {
  const match = source.match(
    new RegExp(`pub enum ${enumName} \\{([\\s\\S]*?)\\n\\}`, "m"),
  );
  if (!match) {
    throw new Error(`Missing Rust enum ${enumName}`);
  }

  return match[1]
    .split("\n")
    .map((line) => line.trim().replace(/,$/, ""))
    .filter((line) => /^[A-Z][A-Za-z0-9_]+$/.test(line))
    .map((line) => line.toLowerCase())
    .sort();
}

function assertEqual(label, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${label} mismatch\nexpected: ${JSON.stringify(expected)}\nactual:   ${JSON.stringify(actual)}`,
    );
  }
}

const tsBindings = read("apps/desktop/src/lib/bindings.ts");
const apiRs = read("apps/desktop/src-tauri/src/api.rs");
const preferencesRs = read("apps/desktop/src-tauri/src/preferences.rs");
const migrationRs = read("packages/core/src/db/migration.rs");
const loggerRs = read("packages/core/src/logger/mod.rs");
const themeRs = read("packages/core/src/theme/engine.rs");

assertEqual(
  "MigrationStatus fields",
  extractTsInterfaceFields(tsBindings, "MigrationStatus"),
  extractRustStructFields(migrationRs, "MigrationStatus"),
);
assertEqual(
  "DatabaseOverview fields",
  extractTsInterfaceFields(tsBindings, "DatabaseOverview"),
  extractRustStructFields(migrationRs, "MigrationOverview"),
);
assertEqual(
  "ThemeMode variants",
  extractTsUnionValues(tsBindings, "ThemeMode"),
  extractRustEnumVariants(themeRs, "ThemeMode"),
);
assertEqual(
  "ThemeDefinition fields",
  extractTsInterfaceFields(tsBindings, "ThemeDefinition"),
  extractRustStructFields(themeRs, "ThemeDefinition"),
);
assertEqual(
  "LogEntry fields",
  extractTsInterfaceFields(tsBindings, "LogEntry"),
  extractRustStructFields(loggerRs, "LogEntry"),
);
assertEqual(
  "CommandErrorShape fields",
  extractTsInterfaceFields(tsBindings, "CommandErrorShape"),
  extractRustStructFields(apiRs, "CommandError"),
);
assertEqual(
  "AppOverview fields",
  extractTsInterfaceFields(tsBindings, "AppOverview"),
  extractRustStructFields(apiRs, "AppOverview"),
);
assertEqual(
  "SupportBundleSummary fields",
  extractTsInterfaceFields(tsBindings, "SupportBundleSummary"),
  extractRustStructFields(apiRs, "SupportBundleSummary"),
);
assertEqual(
  "SupportBundleArtifact fields",
  extractTsInterfaceFields(tsBindings, "SupportBundleArtifact"),
  extractRustStructFields(apiRs, "SupportBundleArtifact"),
);
assertEqual(
  "DesktopSettings fields",
  extractTsInterfaceFields(tsBindings, "DesktopSettings"),
  extractRustStructFields(preferencesRs, "DesktopSettings"),
);
assertEqual(
  "PluginStatus fields",
  extractTsInterfaceFields(tsBindings, "PluginStatus"),
  extractRustStructFields(apiRs, "PluginStatus"),
);

console.log("Desktop bindings match the Rust command contracts.");
