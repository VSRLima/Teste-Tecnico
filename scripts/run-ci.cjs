const { spawnSync } = require('node:child_process');

const steps = [
  ['npm', ['run', 'db:generate:api']],
  ['npm', ['run', 'lint']],
  ['npm', ['run', 'test:e2e:api']],
  ['npm', ['run', 'test:api']],
  ['npm', ['run', 'build']],
];

for (const [command, args] of steps) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
