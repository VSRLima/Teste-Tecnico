const weakSecretPattern = /change-me/i;
const minimumSecretLength = 32;

export function assertStrongSecretsOutsideTests(environment: {
  JWT_REFRESH_SECRET?: string;
  JWT_SECRET?: string;
  NODE_ENV?: string;
}) {
  if (environment.NODE_ENV === 'test') {
    return;
  }

  const secrets = [environment.JWT_SECRET, environment.JWT_REFRESH_SECRET].map(
    (secret) => secret?.trim(),
  );
  const hasWeakSecret = secrets.some((secret) => {
    if (!secret) {
      return true;
    }

    if (secret.length < minimumSecretLength) {
      return true;
    }

    return weakSecretPattern.test(secret);
  });

  if (hasWeakSecret) {
    throw new Error(
      `Non-test environment detected with invalid secrets. Please configure proper secrets (current env: ${environment.NODE_ENV ?? 'undefined'}).`,
    );
  }
}
