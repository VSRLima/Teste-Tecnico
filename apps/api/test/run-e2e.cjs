const { spawnSync } = require('node:child_process');
const { existsSync, readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const { URL } = require('node:url');
const { PrismaClient } = require('@prisma/client');

const TEST_SCHEMA = process.env.TEST_DATABASE_SCHEMA ?? 'e2e';
const MIGRATIONS_DIRECTORY = join(process.cwd(), 'prisma', 'migrations');

function getBaseDatabaseUrl() {
  const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      'TEST_DATABASE_URL or DATABASE_URL must be defined before running e2e tests.',
    );
  }

  return databaseUrl;
}

function withTestSchema(databaseUrl) {
  const parsedUrl = new URL(databaseUrl);
  parsedUrl.searchParams.set('schema', TEST_SCHEMA);
  return parsedUrl.toString();
}

function run(command, args, options = {}) {
  const testDatabaseUrl = withTestSchema(getBaseDatabaseUrl());
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: testDatabaseUrl,
      TEST_DATABASE_SCHEMA: TEST_SCHEMA,
    },
    stdio: 'inherit',
    ...options,
  });

  return result;
}

function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let blockCommentDepth = 0;
  let dollarQuoteTag = null;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const nextChar = sql[index + 1];

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false;
      }
      continue;
    }

    if (blockCommentDepth > 0) {
      if (char === '/' && nextChar === '*') {
        blockCommentDepth += 1;
        index += 1;
        continue;
      }

      if (char === '*' && nextChar === '/') {
        blockCommentDepth -= 1;
        index += 1;
      }

      continue;
    }

    if (dollarQuoteTag) {
      if (sql.startsWith(dollarQuoteTag, index)) {
        current += dollarQuoteTag;
        index += dollarQuoteTag.length - 1;
        dollarQuoteTag = null;
      } else {
        current += char;
      }
      continue;
    }

    if (inSingleQuote) {
      current += char;

      if (char === "'" && nextChar === "'") {
        current += nextChar;
        index += 1;
        continue;
      }

      if (char === "'") {
        inSingleQuote = false;
      }

      continue;
    }

    if (inDoubleQuote) {
      current += char;

      if (char === '"' && nextChar === '"') {
        current += nextChar;
        index += 1;
        continue;
      }

      if (char === '"') {
        inDoubleQuote = false;
      }

      continue;
    }

    if (char === '-' && nextChar === '-') {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (char === '/' && nextChar === '*') {
      blockCommentDepth = 1;
      index += 1;
      continue;
    }

    if (char === "'") {
      inSingleQuote = true;
      current += char;
      continue;
    }

    if (char === '"') {
      inDoubleQuote = true;
      current += char;
      continue;
    }

    if (char === '$') {
      const dollarQuoteMatch = sql
        .slice(index)
        .match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);

      if (dollarQuoteMatch) {
        dollarQuoteTag = dollarQuoteMatch[0];
        current += dollarQuoteTag;
        index += dollarQuoteTag.length - 1;
        continue;
      }
    }

    if (char === ';') {
      const statement = current.trim();

      if (statement) {
        statements.push(statement);
      }

      current = '';
      continue;
    }

    current += char;
  }

  const finalStatement = current.trim();

  if (finalStatement) {
    statements.push(finalStatement);
  }

  return statements;
}

function rewriteSchemaReferences(sql, schema) {
  return sql
    .replaceAll('"public".', `"${schema}".`)
    .replaceAll(`'public."`, `'${schema}."`);
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

      const migrationSql = rewriteSchemaReferences(
        readFileSync(migrationFile, 'utf8'),
        schema,
      );

      return splitSqlStatements(migrationSql);
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

async function main() {
  const baseDatabaseUrl = getBaseDatabaseUrl();

  await prepareDatabase(withTestSchema(baseDatabaseUrl), TEST_SCHEMA);

  const jestResult = run('npx', [
    'jest',
    '--config',
    './test/jest-e2e.json',
    '--runInBand',
  ]);

  if (jestResult.error) {
    throw jestResult.error;
  }

  if (jestResult.signal) {
    throw new Error(`Jest exited from signal ${jestResult.signal}`);
  }

  if (jestResult.status !== 0) {
    process.exit(jestResult.status ?? 1);
  }
}

void main().catch((error) => {
  console.error('Failed to run e2e tests.', error);
  process.exit(1);
});
