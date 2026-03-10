import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const outputDir = path.join(repoRoot, ".release-results");
const rehearsalRoot = path.join(outputDir, "local-feed-rehearsal");
const channel = process.env.SHIPKIT_RELEASE_CHANNEL ?? "canary";
const platform = process.env.SHIPKIT_RELEASE_PLATFORM ?? process.platform;
const port = Number(process.env.SHIPKIT_LOCAL_FEED_PORT ?? "48123");
const feedBaseUrl = `http://127.0.0.1:${port}`;
const keyPassword = process.env.SHIPKIT_LOCAL_FEED_KEY_PASSWORD ?? "shipkit-local-feed";

function run(command, args, env = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...env,
    },
    stdio: "inherit",
  });

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

function bundleSummaryPath() {
  return path.join(outputDir, `release-bundle-summary-${channel}-${platform}.json`);
}

const rehearsalDir = path.join(rehearsalRoot, channel, platform);
fs.rmSync(rehearsalDir, { recursive: true, force: true });
fs.mkdirSync(rehearsalDir, { recursive: true });

const privateKeyPath = path.join(rehearsalDir, "updater.key");
const publicKeyPath = `${privateKeyPath}.pub`;
const sharedEnv = {
  SHIPKIT_RELEASE_CHANNEL: channel,
  SHIPKIT_RELEASE_HOST: "local-feed-rehearsal",
  SHIPKIT_RELEASE_ARTIFACT_BASE_URL: feedBaseUrl,
  SHIPKIT_RELEASE_NOTES_BASE_URL: feedBaseUrl,
  SHIPKIT_TAURI_UPDATER_ENDPOINT: `${feedBaseUrl}/latest.json`,
  SHIPKIT_UPDATER_PRIVATE_KEY_PATH: privateKeyPath,
  SHIPKIT_UPDATER_PRIVATE_KEY_PASSWORD: keyPassword,
  SHIPKIT_UPDATER_PUBLIC_KEY_PATH: publicKeyPath,
  TAURI_SIGNING_PRIVATE_KEY_PATH: privateKeyPath,
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD: keyPassword,
  VITE_SHIPKIT_UPDATE_CHANNEL: channel,
  VITE_SHIPKIT_RELEASE_HOST: "local-feed-rehearsal",
  VITE_SHIPKIT_RELEASE_ARTIFACT_BASE_URL: feedBaseUrl,
  VITE_SHIPKIT_TAURI_UPDATER_ENDPOINT: `${feedBaseUrl}/latest.json`,
};

run("pnpm", [
  "--dir",
  "apps/desktop",
  "tauri",
  "signer",
  "generate",
  "--ci",
  "--password",
  keyPassword,
  "--write-keys",
  privateKeyPath,
  "--force",
]);

run("pnpm", ["run", "package:smoke"], sharedEnv);
run("pnpm", ["run", "release:preflight"], sharedEnv);
run("pnpm", ["run", "updater:scaffold"], sharedEnv);
run("pnpm", ["run", "release:bundle"], sharedEnv);
run(
  "node",
  [
    "scripts/release/validate-hosted-feed.mjs",
    "--summary",
    bundleSummaryPath(),
    "--port",
    String(port),
  ],
  sharedEnv,
);

const outputPath = path.join(outputDir, `local-feed-rehearsal-${channel}-${platform}.json`);
fs.writeFileSync(
  outputPath,
  `${JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      channel,
      platform,
      feed_base_url: feedBaseUrl,
      private_key_path: privateKeyPath,
      public_key_path: publicKeyPath,
      bundle_summary_path: bundleSummaryPath(),
      validation_report_path: path.join(
        outputDir,
        `local-feed-validation-${channel}-${platform}.json`,
      ),
    },
    null,
    2,
  )}\n`,
);

console.log(`Wrote local feed rehearsal summary to ${outputPath}`);
