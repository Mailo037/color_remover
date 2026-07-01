import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const cwd = process.cwd();
const releaseDir = path.join(cwd, 'release');
const tempReleaseDir = path.join(os.tmpdir(), 'color-remover-release');
const nodeCommand = process.execPath;
const viteCli = path.join(cwd, 'node_modules', 'vite', 'bin', 'vite.js');
const builderCli = path.join(cwd, 'node_modules', 'electron-builder', 'cli.js');

const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

await fs.rm(tempReleaseDir, { recursive: true, force: true });
await fs.rm(releaseDir, { recursive: true, force: true });
await fs.mkdir(tempReleaseDir, { recursive: true });

run(nodeCommand, [path.join(cwd, 'scripts', 'create-windows-icon.mjs')]);
run(nodeCommand, [viteCli, 'build']);
run(nodeCommand, [
  builderCli,
  '--win',
  'nsis',
  '--x64',
  '--publish',
  'never',
  `--config.directories.output=${tempReleaseDir}`,
]);

const releaseFiles = await fs.readdir(tempReleaseDir);
const assets = releaseFiles.filter((fileName) => (
  fileName === 'latest.yml' ||
  fileName.endsWith('.exe') ||
  fileName.endsWith('.exe.blockmap')
));

if (!assets.some((fileName) => fileName.endsWith('.exe')) || !assets.includes('latest.yml')) {
  throw new Error('Windows build did not produce the installer and latest.yml update metadata.');
}

await fs.mkdir(releaseDir, { recursive: true });

for (const asset of assets) {
  await fs.copyFile(path.join(tempReleaseDir, asset), path.join(releaseDir, asset));
}

console.log(`Copied ${assets.length} release assets to ${path.relative(cwd, releaseDir)}`);
