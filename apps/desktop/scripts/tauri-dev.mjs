import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

const appDir = path.resolve(import.meta.dirname, "..");
const baseConfigPath = path.join(appDir, "src-tauri", "tauri.conf.json");
const baseConfig = JSON.parse(fs.readFileSync(baseConfigPath, "utf8"));
const requestedPort = Number(process.env.SHIPKIT_DEV_PORT ?? "1420");
const searchLimit = 25;

function canListen(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

async function selectPort() {
  for (let offset = 0; offset < searchLimit; offset += 1) {
    const port = requestedPort + offset;
    const listenerCheck = spawnSync(
      "lsof",
      ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"],
      {
        stdio: "ignore",
      },
    );

    if ((listenerCheck.status ?? 1) !== 0 && (await canListen(port))) {
      return port;
    }
  }

  throw new Error(
    `No open ShipKit dev port found in range ${requestedPort}-${requestedPort + searchLimit - 1}.`,
  );
}

const selectedPort = await selectPort();
const tempConfigPath = path.join(
  os.tmpdir(),
  `shipkit-tauri-dev-${process.pid}.json`,
);

const derivedConfig = {
  ...baseConfig,
  build: {
    ...baseConfig.build,
    beforeDevCommand: `SHIPKIT_DEV_PORT=${selectedPort} pnpm dev`,
    devUrl: `http://localhost:${selectedPort}`,
  },
};

fs.writeFileSync(tempConfigPath, `${JSON.stringify(derivedConfig, null, 2)}\n`);
console.log(`ShipKit dev port: ${selectedPort}`);

const child = spawn(
  "pnpm",
  ["tauri", "dev", "--config", tempConfigPath, ...process.argv.slice(2)],
  {
    cwd: appDir,
    env: {
      ...process.env,
      SHIPKIT_DEV_PORT: String(selectedPort),
    },
    stdio: "inherit",
  },
);

child.on("exit", (code, signal) => {
  fs.rmSync(tempConfigPath, { force: true });
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
