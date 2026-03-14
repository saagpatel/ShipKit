import { execSync } from 'node:child_process';

const defaultBaseRef = (() => {
  try {
    return execSync('git symbolic-ref refs/remotes/origin/HEAD', { encoding: 'utf8' }).trim().replace('refs/remotes/', '');
  } catch {
    return 'origin/main';
  }
})();

const baseRef = process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : defaultBaseRef;
const changed = execSync(`git diff --name-only ${baseRef}...HEAD`, { encoding: 'utf8' })
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);

const prodMatchers = [
  /^(src|app|server|api|lib)\//,
  /^apps\/[^/]+\/src\//,
  /^apps\/[^/]+\/src-tauri\/src\//,
  /^packages\/[^/]+\/src\//,
];

const testMatchers = [
  /^tests\//,
  /^apps\/[^/]+\/src\/.*\.(test|spec)\.[cm]?[jt]sx?$/,
  /^apps\/[^/]+\/src-tauri\/.*test.*\.rs$/,
  /^packages\/[^/]+\/.*test.*\.rs$/,
  /\.(test|spec)\.[cm]?[jt]sx?$/,
];

const docMatchers = [
  /^docs\//,
  /^openapi\//,
  /^README\.md$/,
  /^AGENTS\.md$/,
];

const isProdCode = (file) =>
  prodMatchers.some((pattern) => pattern.test(file)) &&
  !/\.(test|spec)\.[cm]?[jt]sx?$/.test(file);
const isTest = (file) => testMatchers.some((pattern) => pattern.test(file));
const isDoc = (file) => docMatchers.some((pattern) => pattern.test(file));

const prodChanged = changed.some(isProdCode);
const testsChanged = changed.some(isTest);
const docsChanged = changed.some(isDoc);

if (prodChanged && !testsChanged) {
  console.error('Policy failure: production code changed without test updates.');
  process.exit(1);
}

if (prodChanged && !docsChanged) {
  console.error('Policy failure: production code changed without docs/OpenAPI updates.');
  process.exit(1);
}

console.log('Policy checks passed.');
