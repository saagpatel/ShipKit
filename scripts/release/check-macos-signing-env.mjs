import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const outputDir = path.join(repoRoot, ".release-results");

const strict =
  process.argv.includes("--strict") || process.env.SHIPKIT_REQUIRE_SIGNING_SECRETS === "1";

function valuePresent(name) {
  return Boolean(process.env[name]?.trim());
}

function collectSection(requiredKeys) {
  const present = requiredKeys.filter(valuePresent);
  const missing = requiredKeys.filter((name) => !valuePresent(name));
  return {
    present,
    missing,
    ready: missing.length === 0,
  };
}

function collectAlternativeSection(requirements) {
  const present = [];
  const missing = [];

  for (const requirement of requirements) {
    const matchedEnv = requirement.anyOf.find(valuePresent);
    if (matchedEnv) {
      present.push(matchedEnv);
    } else {
      missing.push(requirement.label);
    }
  }

  return {
    present,
    missing,
    ready: missing.length === 0,
  };
}

function detectNotarizationMode() {
  const notaryProfileKeys = ["SHIPKIT_APPLE_NOTARY_TOOL_PROFILE"];
  const appPasswordKeys = [
    "SHIPKIT_APPLE_ID",
    "SHIPKIT_APPLE_APP_PASSWORD",
    "SHIPKIT_APPLE_TEAM_ID",
  ];
  const apiKeyKeys = [
    "SHIPKIT_APPLE_API_KEY_ID",
    "SHIPKIT_APPLE_API_ISSUER_ID",
    "SHIPKIT_APPLE_API_PRIVATE_KEY",
  ];

  const notaryProfile = collectSection(notaryProfileKeys);
  const appPassword = collectSection(appPasswordKeys);
  const apiKey = collectSection(apiKeyKeys);

  if (notaryProfile.ready) {
    return {
      mode: "stored-notarytool-profile",
      present: notaryProfile.present,
      missing: [],
      ready: true,
    };
  }

  if (appPassword.ready) {
    return {
      mode: "apple-id-app-password",
      present: appPassword.present,
      missing: [],
      ready: true,
    };
  }

  if (apiKey.ready) {
    return {
      mode: "app-store-connect-api-key",
      present: apiKey.present,
      missing: [],
      ready: true,
    };
  }

  return {
    mode: null,
    present: [...new Set([...notaryProfile.present, ...appPassword.present, ...apiKey.present])],
    missing: [...new Set([...notaryProfile.missing, ...appPassword.missing, ...apiKey.missing])],
    ready: false,
  };
}

function joinUrl(baseUrl, ...parts) {
  if (!baseUrl) {
    return null;
  }

  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const normalizedParts = parts.map((part) => encodeURIComponent(part));
  return `${normalizedBase}/${normalizedParts.join("/")}`;
}

function releaseTag(version, channel) {
  return channel === "stable" ? `v${version}` : `v${version}-${channel}`;
}

function detectDistribution() {
  const releaseHost = process.env.SHIPKIT_RELEASE_HOST?.trim() || null;
  const releaseRepository =
    process.env.SHIPKIT_RELEASE_REPOSITORY?.trim() || process.env.GITHUB_REPOSITORY?.trim() || null;
  const releaseChannel = process.env.SHIPKIT_RELEASE_CHANNEL?.trim() || "canary";
  const releaseVersion = process.env.SHIPKIT_RELEASE_VERSION?.trim() || "0.0.0";
  const githubToken = process.env.GH_TOKEN?.trim() || process.env.GITHUB_TOKEN?.trim() || null;
  const generic = collectSection(["SHIPKIT_RELEASE_ARTIFACT_BASE_URL"]);

  if (generic.ready) {
    return {
      mode: "generic-url",
      present: generic.present,
      missing: [],
      ready: true,
      artifact_base_url: process.env.SHIPKIT_RELEASE_ARTIFACT_BASE_URL?.trim() || null,
      notes_base_url: process.env.SHIPKIT_RELEASE_NOTES_BASE_URL?.trim() || null,
      release_tag: process.env.SHIPKIT_RELEASE_TAG?.trim() || releaseTag(releaseVersion, releaseChannel),
      repository: releaseRepository,
      host: releaseHost,
    };
  }

  if (releaseHost === "github-releases") {
    const githubSection = collectAlternativeSection([
      { label: "SHIPKIT_RELEASE_REPOSITORY or GITHUB_REPOSITORY", anyOf: ["SHIPKIT_RELEASE_REPOSITORY", "GITHUB_REPOSITORY"] },
      { label: "GH_TOKEN or GITHUB_TOKEN", anyOf: ["GH_TOKEN", "GITHUB_TOKEN"] },
    ]);
    const tag = process.env.SHIPKIT_RELEASE_TAG?.trim() || releaseTag(releaseVersion, releaseChannel);
    return {
      mode: "github-releases",
      present: githubSection.present,
      missing: githubSection.missing,
      ready: githubSection.ready,
      artifact_base_url: releaseRepository
        ? `https://github.com/${releaseRepository}/releases/download/${tag}`
        : null,
      notes_base_url: releaseRepository
        ? `https://github.com/${releaseRepository}/releases/tag/${tag}`
        : null,
      release_tag: tag,
      repository: releaseRepository,
      host: releaseHost,
      token_present: Boolean(githubToken),
    };
  }

  return {
    mode: null,
    present: [],
    missing: ["SHIPKIT_RELEASE_ARTIFACT_BASE_URL or github-releases host configuration"],
    ready: false,
    artifact_base_url: null,
    notes_base_url: process.env.SHIPKIT_RELEASE_NOTES_BASE_URL?.trim() || null,
    release_tag: process.env.SHIPKIT_RELEASE_TAG?.trim() || releaseTag(releaseVersion, releaseChannel),
    repository: releaseRepository,
    host: releaseHost,
  };
}

function detectEmbeddedUpdaterConfig(distribution) {
  const publicKey = collectAlternativeSection([
    {
      label: "SHIPKIT_UPDATER_PUBLIC_KEY or SHIPKIT_UPDATER_PUBLIC_KEY_PATH",
      anyOf: ["SHIPKIT_UPDATER_PUBLIC_KEY", "SHIPKIT_UPDATER_PUBLIC_KEY_PATH"],
    },
  ]);

  const explicitEndpoint = process.env.SHIPKIT_TAURI_UPDATER_ENDPOINT?.trim() || null;
  if (explicitEndpoint) {
    return {
      mode: "explicit",
      present: [...publicKey.present, "SHIPKIT_TAURI_UPDATER_ENDPOINT"],
      missing: publicKey.missing,
      ready: publicKey.ready,
      updater_endpoint: explicitEndpoint,
    };
  }

  if (distribution.mode === "generic-url" && distribution.artifact_base_url) {
    return {
      mode: "artifact-base-url",
      present: publicKey.present,
      missing: publicKey.missing,
      ready: publicKey.ready,
      updater_endpoint: joinUrl(distribution.artifact_base_url, "latest.json"),
    };
  }

  if (
    distribution.mode === "github-releases" &&
    distribution.repository &&
    (process.env.SHIPKIT_RELEASE_CHANNEL?.trim() || "canary") === "stable"
  ) {
    return {
      mode: "github-releases-stable",
      present: publicKey.present,
      missing: publicKey.missing,
      ready: publicKey.ready,
      updater_endpoint: `https://github.com/${distribution.repository}/releases/latest/download/latest.json`,
    };
  }

  return {
    mode:
      distribution.mode === "github-releases"
        ? "github-releases-prerelease-needs-explicit-endpoint"
        : null,
    present: publicKey.present,
    missing: [
      ...publicKey.missing,
      "SHIPKIT_TAURI_UPDATER_ENDPOINT or a stable github-releases / artifact-base-url distribution",
    ],
    ready: false,
    updater_endpoint: null,
  };
}

const signing = collectSection([
  "SHIPKIT_APPLE_CERTIFICATE_P12_BASE64",
  "SHIPKIT_APPLE_CERTIFICATE_PASSWORD",
  "SHIPKIT_APPLE_SIGNING_IDENTITY",
  "SHIPKIT_APPLE_TEAM_ID",
]);

const notarization = detectNotarizationMode();
const updater = collectAlternativeSection([
  {
    label: "SHIPKIT_UPDATER_PRIVATE_KEY, SHIPKIT_UPDATER_PRIVATE_KEY_PATH, TAURI_SIGNING_PRIVATE_KEY, or TAURI_SIGNING_PRIVATE_KEY_PATH",
    anyOf: [
      "SHIPKIT_UPDATER_PRIVATE_KEY",
      "SHIPKIT_UPDATER_PRIVATE_KEY_PATH",
      "TAURI_SIGNING_PRIVATE_KEY",
      "TAURI_SIGNING_PRIVATE_KEY_PATH",
    ],
  },
]);
const distribution = detectDistribution();
const embeddedUpdaterConfig = detectEmbeddedUpdaterConfig(distribution);
const overallReady =
  signing.ready &&
  notarization.ready &&
  updater.ready &&
  distribution.ready &&
  embeddedUpdaterConfig.ready;
const overallStatus = overallReady ? "ready" : strict ? "fail" : "warning";

const report = {
  generated_at: new Date().toISOString(),
  strict,
  overall_status: overallStatus,
  signing: {
    ...signing,
    identity: process.env.SHIPKIT_APPLE_SIGNING_IDENTITY?.trim() || null,
    team_id: process.env.SHIPKIT_APPLE_TEAM_ID?.trim() || null,
  },
  notarization,
  updater: {
    ...updater,
    password_present: Boolean(
      process.env.SHIPKIT_UPDATER_PRIVATE_KEY_PASSWORD?.trim() ||
        process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD?.trim(),
    ),
  },
  distribution: {
    ...distribution,
    sample_artifact_url: joinUrl(
      distribution.artifact_base_url,
      "ShipKit.app.zip",
    ),
  },
  embedded_updater_config: embeddedUpdaterConfig,
};

fs.mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(outputDir, "signing-preflight.json");
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);

if (overallReady) {
  console.log(`Signing preflight passed. Wrote ${outputPath}`);
  process.exit(0);
}

console.warn(`Signing preflight is incomplete (${overallStatus}). Wrote ${outputPath}`);
for (const [name, section] of Object.entries({
  signing,
  notarization,
  updater,
  distribution,
  embedded_updater_config: embeddedUpdaterConfig,
})) {
  if (!section.ready) {
    console.warn(`- ${name} missing: ${section.missing.join(", ")}`);
  }
}

if (strict) {
  process.exit(1);
}
