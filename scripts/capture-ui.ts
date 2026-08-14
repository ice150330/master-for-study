const nodeProcess = process as typeof process & {
  getBuiltinModule(id: 'node:child_process'): typeof import('node:child_process');
  getBuiltinModule(id: 'node:path'): typeof import('node:path');
};
const { spawnSync } = nodeProcess.getBuiltinModule('node:child_process');
const path = nodeProcess.getBuiltinModule('node:path');

const phase = process.argv[2] ?? '00-baseline';
const spec = process.argv[3] ?? 'visual-baseline.spec.ts';
const extraArgs = process.argv.slice(4);
const playwrightCli = path.resolve(
  process.cwd(),
  'node_modules',
  '@playwright',
  'test',
  'cli.js',
);

const result = spawnSync(
  process.execPath,
  [
    playwrightCli,
    'test',
    spec,
    '--config=config/playwright.config.ts',
    ...extraArgs,
  ],
  {
    cwd: process.cwd(),
    env: { ...process.env, MENTOR_CAPTURE_PHASE: phase },
    stdio: 'inherit',
  },
);

if (result.error) {
  throw result.error;
}

process.exitCode = result.status ?? 1;
