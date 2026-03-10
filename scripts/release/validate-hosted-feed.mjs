import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const outputDir = path.join(repoRoot, ".release-results");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function sha256Buffer(buffer) {
  const hash = crypto.createHash("sha256");
  hash.update(buffer);
  return hash.digest("hex");
}

function joinUrl(baseUrl, relativePath) {
  return `${baseUrl.replace(/\/+$/, "")}/${relativePath.replace(/^\/+/, "")}`;
}

function summaryPathFor(channel, platform) {
  return path.join(outputDir, `release-bundle-summary-${channel}-${platform}.json`);
}

function parseArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

function createStaticServer(rootDir) {
  return http.createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    const relativePath = decodeURIComponent(requestUrl.pathname.replace(/^\/+/, ""));
    const targetPath = path.resolve(rootDir, relativePath || "latest.json");

    if (!targetPath.startsWith(path.resolve(rootDir))) {
      response.statusCode = 403;
      response.end("forbidden");
      return;
    }

    if (!fs.existsSync(targetPath) || fs.statSync(targetPath).isDirectory()) {
      response.statusCode = 404;
      response.end("not found");
      return;
    }

    response.statusCode = 200;
    response.end(fs.readFileSync(targetPath));
  });
}

async function startServer(server, port) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(undefined));
  });
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`request failed for ${url}: ${response.status}`);
  }

  return response.json();
}

async function fetchBuffer(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`request failed for ${url}: ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

const channel = process.env.SHIPKIT_RELEASE_CHANNEL ?? "canary";
const platform = process.env.SHIPKIT_RELEASE_PLATFORM ?? process.platform;
const port = Number(
  parseArg("--port") ?? process.env.SHIPKIT_LOCAL_FEED_PORT ?? "48123",
);
const summaryPath = parseArg("--summary") ?? summaryPathFor(channel, platform);

if (!fs.existsSync(summaryPath)) {
  throw new Error(`release bundle summary not found at ${summaryPath}`);
}

const summary = readJson(summaryPath);
const latestManifest = readJson(summary.latest_manifest_path);
const updaterManifest = readJson(summary.updater_path);
const releaseManifest = readJson(summary.manifest_path);
const bundleDir = summary.bundle_dir;

const baseUrl = `http://127.0.0.1:${port}`;
const artifactFilename = path.basename(summary.artifact_path);
const localLatestManifest = {
  ...latestManifest,
  url: joinUrl(baseUrl, artifactFilename),
};
const localLatestPath = path.join(bundleDir, "latest.local.json");
writeJson(localLatestPath, localLatestManifest);

const server = createStaticServer(bundleDir);
await startServer(server, port);

let report;
try {
  const fetchedLatest = await fetchJson(joinUrl(baseUrl, "latest.local.json"));
  const fetchedArtifact = await fetchBuffer(fetchedLatest.url);
  const fetchedArtifactSha = sha256Buffer(fetchedArtifact);
  const expectedArtifactSha = releaseManifest.artifact_sha256 ?? sha256Buffer(fs.readFileSync(summary.artifact_path));
  const signatureMatches =
    (fetchedLatest.signature ?? null) === (updaterManifest.updater?.signature ?? null);

  report = {
    generated_at: new Date().toISOString(),
    channel,
    platform,
    validation_status:
      signatureMatches && updaterManifest.updater?.signature_present
        ? "local-hosted-feed-signed"
        : "local-hosted-feed-validated",
    bundle_dir: bundleDir,
    local_feed_endpoint: joinUrl(baseUrl, "latest.local.json"),
    artifact_url: fetchedLatest.url,
    artifact_sha256: fetchedArtifactSha,
    expected_artifact_sha256: expectedArtifactSha,
    artifact_sha_matches: fetchedArtifactSha === expectedArtifactSha,
    signature_present: Boolean(updaterManifest.updater?.signature_present),
    signature_matches: signatureMatches,
    release_tag: summary.release_tag,
    notes_path: summary.notes_path,
    local_latest_manifest_path: localLatestPath,
  };
} finally {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(undefined);
    });
  });
}

if (!report.artifact_sha_matches) {
  throw new Error("local hosted feed validation failed: artifact checksum mismatch");
}

const outputPath = path.join(outputDir, `local-feed-validation-${channel}-${platform}.json`);
writeJson(outputPath, report);
console.log(`Wrote local feed validation report to ${outputPath}`);
