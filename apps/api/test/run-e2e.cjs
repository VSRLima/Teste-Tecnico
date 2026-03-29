const { spawnSync } = require('node:child_process');
const { existsSync, readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const { URL } = require('node:url');
const { PrismaClient } = require('@prisma/client');

const TEST_SCHEMA = process.env.TEST_DATABASE_SCHEMA ?? 'e2e';
const MIGRATIONS_DIRECTORY = join(process.cwd(), 'prisma', 'migrations');

function withTestSchema(databaseUrl) {
  const parsedUrl = new URL(databaseUrl);
  parsedUrl.searchParams.set('schema', TEST_SCHEMA);
  return parsedUrl.toString();
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: withTestSchema(process.env.DATABASE_URL),
      TEST_DATABASE_SCHEMA: TEST_SCHEMA,
    },
    stdio: 'inherit',
    ...options,
  });

  return result;
}

function getMigrationStatements(schema) {
  return readdirSync(MIGRATIONS_DIRECTORY)
    .filter((entry) => entry !== 'migration_lock.toml')
    .sort()
    .flatMap((entry) => {
      const migrationFile = join(MIGRATIONS_DIRECTORY, entry, 'migration.sql');

      if (!existsSync(migrationFile)) {
        return [];
      }

      const migrationSql = readFileSync(migrationFile, 'utf8')
        .replaceAll('"public".', `"${schema}".`)
        .replace(/^--.*$/gm, '');

      return migrationSql
        .split(';')
        .map((statement) => statement.trim())
        .filter(Boolean);
    });
}

async function prepareDatabase(databaseUrl, schema) {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

  try {
    await prisma.$connect();
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await prisma.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);

    const statements = getMigrationStatements(schema);

    for (const statement of statements) {
      await prisma.$executeRawUnsafe(statement);
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be defined before running e2e tests.');
}

async function main() {
  await prepareDatabase(withTestSchema(process.env.DATABASE_URL), TEST_SCHEMA);

  const jestResult = run('npx', [
    'jest',
    '--config',
    './test/jest-e2e.json',
    '--runInBand',
  ]);

  if (jestResult.status !== 0) {
    process.exit(jestResult.status ?? 1);
  }
}

void main();
