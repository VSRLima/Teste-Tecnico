import { URL } from 'node:url';

const DEFAULT_TEST_SCHEMA = process.env.TEST_DATABASE_SCHEMA ?? 'e2e';

function withSchema(databaseUrl: string, schema: string) {
  const parsedUrl = new URL(databaseUrl);
  parsedUrl.searchParams.set('schema', schema);

  return parsedUrl.toString();
}

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = withSchema(
    process.env.DATABASE_URL,
    DEFAULT_TEST_SCHEMA,
  );
}

process.env.NODE_ENV = 'test';
process.env.SWAGGER_ENABLED = 'false';
