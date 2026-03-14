import { execFileSync } from "node:child_process";

function run(command, args) {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : String(error),
    };
  }
}

function readVersion(command, args) {
  const result = run(command, args);
  if (typeof result === "string") {
    return { ok: true, value: result };
  }

  return { ok: false, value: result.error };
}

const checks = [];
const failures = [];

function record(label, ok, details, fix) {
  checks.push({ label, ok, details, fix });
  if (!ok) {
    failures.push({ label, fix });
  }
}

record(
  "Platform",
  process.platform === "darwin",
  process.platform === "darwin"
    ? "macOS detected."
    : `Unsupported platform detected: ${process.platform}.`,
  "Use a macOS machine for the local ShipKit desktop workflow.",
);

const nodeMajor = Number(process.versions.node.split(".")[0]);
record(
  "Node.js",
  nodeMajor === 22,
  `Found Node ${process.versions.node}.`,
  "Switch to Node 22 before running ShipKit verify or smoke commands.",
);

const pnpmVersion = readVersion("pnpm", ["--version"]);
record(
  "pnpm",
  pnpmVersion.ok && Number(pnpmVersion.value.split(".")[0]) === 10,
  pnpmVersion.ok ? `Found pnpm ${pnpmVersion.value}.` : pnpmVersion.value,
  "Install pnpm 10.x and make sure it is on your PATH.",
);

const rustcVersion = readVersion("rustc", ["--version"]);
record(
  "rustc",
  rustcVersion.ok,
  rustcVersion.ok ? rustcVersion.value : rustcVersion.value,
  "Install Rust with rustup so `rustc` is available.",
);

const cargoVersion = readVersion("cargo", ["--version"]);
record(
  "cargo",
  cargoVersion.ok,
  cargoVersion.ok ? cargoVersion.value : cargoVersion.value,
  "Install Rust with rustup so `cargo` is available.",
);

const xcodeSelect = readVersion("xcode-select", ["-p"]);
record(
  "Xcode CLT",
  xcodeSelect.ok,
  xcodeSelect.ok ? `Developer path: ${xcodeSelect.value}` : xcodeSelect.value,
  "Run `xcode-select --install` to install the Xcode Command Line Tools.",
);

const tauriCli = readVersion("pnpm", ["--dir", "apps/desktop", "exec", "tauri", "--version"]);
record(
  "Tauri CLI",
  tauriCli.ok,
  tauriCli.ok ? tauriCli.value : tauriCli.value,
  "Run `pnpm install --frozen-lockfile` so the repo-local Tauri CLI is available.",
);

console.log("ShipKit macOS doctor");
for (const check of checks) {
  console.log(`${check.ok ? "OK" : "FAIL"} ${check.label}: ${check.details}`);
}

if (failures.length > 0) {
  console.error("\nFixes needed:");
  for (const failure of failures) {
    console.error(`- ${failure.fix}`);
  }
  process.exit(1);
}

console.log("\nThis Mac is ready for the local ShipKit workflow.");
