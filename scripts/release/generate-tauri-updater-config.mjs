import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const outputDir = path.join(repoRoot, ".release-results");
const outputPath = path.join(outputDir, "tauri-release-overlay.json");
const summaryPath = path.join(outputDir, "tauri-release-overlay-summary.json");

function trimmedEnv(name) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function releaseTag(version, channel) {
  return channel === "stable" ? `v${version}` : `v${version}-${channel}`;
}

function joinUrl(baseUrl, pathPart) {
  return `${baseUrl.replace(/\/+$/, "")}/${pathPart.replace(/^\/+/, "")}`;
}

function readPublicKey() {
  const inlineKey = trimmedEnv("SHIPKIT_UPDATER_PUBLIC_KEY");
  if (inlineKey) {
    return {
      value: inlineKey,
      source: "SHIPKIT_UPDATER_PUBLIC_KEY",
    };
  }

  const filePath = trimmedEnv("SHIPKIT_UPDATER_PUBLIC_KEY_PATH");
  if (filePath && fs.existsSync(filePath)) {
    return {
      value: fs.readFileSync(filePath, "utf8").trim(),
      source: "SHIPKIT_UPDATER_PUBLIC_KEY_PATH",
    };
  }

  return {
    value: null,
    source: filePath ? "SHIPKIT_UPDATER_PUBLIC_KEY_PATH (missing file)" : null,
  };
}

function resolveEndpoint() {
  const explicitEndpoint = trimmedEnv("SHIPKIT_TAURI_UPDATER_ENDPOINT");
  if (explicitEndpoint) {
    return {
      value: explicitEndpoint,
      mode: "explicit",
    };
  }

  const artifactBaseUrl = trimmedEnv("SHIPKIT_RELEASE_ARTIFACT_BASE_URL");
  if (artifactBaseUrl) {
    return {
      value: joinUrl(artifactBaseUrl, "latest.json"),
      mode: "artifact-base-url",
    };
  }

  const host = trimmedEnv("SHIPKIT_RELEASE_HOST");
  const repository =
    trimmedEnv("SHIPKIT_RELEASE_REPOSITORY") || trimmedEnv("GITHUB_REPOSITORY");
  const channel = trimmedEnv("SHIPKIT_RELEASE_CHANNEL") ?? "canary";

  if (host === "github-releases" && repository && channel === "stable") {
    return {
      value: `https://github.com/${repository}/releases/latest/download/latest.json`,
      mode: "github-releases-stable",
    };
  }

  return {
    value: null,
    mode:
      host === "github-releases" && repository
        ? "github-releases-prerelease-needs-explicit-endpoint"
        : null,
  };
}

const publicKey = readPublicKey();
const endpoint = resolveEndpoint();
const channel = trimmedEnv("SHIPKIT_RELEASE_CHANNEL") ?? "canary";
const version = trimmedEnv("SHIPKIT_RELEASE_VERSION") ?? "0.0.0";
const repository =
  trimmedEnv("SHIPKIT_RELEASE_REPOSITORY") || trimmedEnv("GITHUB_REPOSITORY");
const overlay = {};

if (publicKey.value && endpoint.value) {
  overlay.bundle = {
    createUpdaterArtifacts: true,
  };
  overlay.plugins = {
    updater: {
      pubkey: publicKey.value,
      endpoints: [endpoint.value],
      windows: {
        installMode: "passive",
      },
    },
  };
}

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(overlay, null, 2)}\n`);

const summary = {
  generated_at: new Date().toISOString(),
  channel,
  release_tag: releaseTag(version, channel),
  repository,
  updater_endpoint: endpoint.value,
  endpoint_mode: endpoint.mode,
  public_key_source: publicKey.source,
  embedded_ready: Boolean(publicKey.value && endpoint.value),
  overlay_path: outputPath,
};

fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
console.log(outputPath);
