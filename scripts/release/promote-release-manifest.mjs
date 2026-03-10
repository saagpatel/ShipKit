import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const outputDir = path.join(repoRoot, ".release-results");
const releaseConfigPath = path.join(repoRoot, "release", "channels.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function parseArgs(argv) {
  const args = { from: null, to: null };
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === "--from") {
      args.from = argv[index + 1] ?? null;
      index += 1;
    } else if (current === "--to") {
      args.to = argv[index + 1] ?? null;
      index += 1;
    }
  }

  return args;
}

function ensurePromotionPath(config, from, to) {
  const ordered = config.channels.map((entry) => entry.name);
  const fromIndex = ordered.indexOf(from);
  const toIndex = ordered.indexOf(to);

  if (fromIndex === -1 || toIndex === -1) {
    throw new Error(`unknown promotion path ${from} -> ${to}`);
  }

  if (toIndex !== fromIndex + 1) {
    throw new Error(
      `invalid promotion path ${from} -> ${to}; expected next channel in ${ordered.join(" -> ")}`,
    );
  }
}

function joinUrl(baseUrl, ...parts) {
  if (!baseUrl) {
    return null;
  }

  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const normalizedParts = parts.map((part) => encodeURIComponent(part));
  return `${normalizedBase}/${normalizedParts.join("/")}`;
}

function manifestPathFor(channel, platform) {
  return path.join(outputDir, `release-manifest-${channel}-${platform}.json`);
}

function updaterPathFor(channel, platform) {
  return path.join(outputDir, `updater-scaffold-${channel}-${platform}.json`);
}

function promotionReportPath(from, to, platform) {
  return path.join(outputDir, `release-promotion-${from}-to-${to}-${platform}.json`);
}

function promotedArtifactPath(sourceArtifactPath, from, to) {
  const parsed = path.parse(sourceArtifactPath);
  const token = `-${from}-`;
  const targetBase = parsed.base.includes(token)
    ? parsed.base.replace(token, `-${to}-`)
    : `${parsed.name}-${to}${parsed.ext}`;
  return path.join(parsed.dir, targetBase);
}

const { from, to } = parseArgs(process.argv.slice(2));
if (!from || !to) {
  throw new Error("usage: pnpm run release:promote -- --from <channel> --to <channel>");
}

const config = readJson(releaseConfigPath);
ensurePromotionPath(config, from, to);

const sourceManifestPath = manifestPathFor(from, process.platform);
if (!fs.existsSync(sourceManifestPath)) {
  throw new Error(`source manifest not found at ${sourceManifestPath}`);
}

const sourceManifest = readJson(sourceManifestPath);
const promotedAt = new Date().toISOString();
const sourceArtifactPath = sourceManifest.artifact_path;
let targetArtifactPath = sourceArtifactPath;
if (fs.existsSync(sourceArtifactPath)) {
  targetArtifactPath = promotedArtifactPath(sourceArtifactPath, from, to);
  if (targetArtifactPath !== sourceArtifactPath) {
    fs.copyFileSync(sourceArtifactPath, targetArtifactPath);
  }
}

const promotedManifest = {
  ...sourceManifest,
  channel: to,
  artifact_path: targetArtifactPath,
  promoted_at: promotedAt,
  promoted_from: from,
};

const targetManifestPath = manifestPathFor(to, process.platform);
writeJson(targetManifestPath, promotedManifest);

const sourceUpdaterPath = updaterPathFor(from, process.platform);
let targetUpdaterPath = null;
if (fs.existsSync(sourceUpdaterPath)) {
  const sourceUpdater = readJson(sourceUpdaterPath);
  const artifactFilename = path.basename(promotedManifest.artifact_path);
  const promotedUpdater = {
    ...sourceUpdater,
    channel: to,
    promoted_at: promotedAt,
    promoted_from: from,
    distribution: {
      ...sourceUpdater.distribution,
      artifact_url: joinUrl(
        sourceUpdater.distribution.artifact_base_url,
        to,
        promotedManifest.version,
        artifactFilename,
      ),
      notes_url: sourceUpdater.distribution.notes_base_url
        ? joinUrl(sourceUpdater.distribution.notes_base_url, to, promotedManifest.version)
        : null,
    },
  };

  targetUpdaterPath = updaterPathFor(to, process.platform);
  writeJson(targetUpdaterPath, promotedUpdater);
}

writeJson(promotionReportPath(from, to, process.platform), {
  promoted_at: promotedAt,
  from_channel: from,
  to_channel: to,
  platform: process.platform,
  source_manifest_path: sourceManifestPath,
  target_manifest_path: targetManifestPath,
  source_artifact_path: sourceArtifactPath,
  target_artifact_path: targetArtifactPath,
  source_updater_path: fs.existsSync(sourceUpdaterPath) ? sourceUpdaterPath : null,
  target_updater_path: targetUpdaterPath,
});

console.log(`Promoted release metadata from ${from} to ${to}`);
