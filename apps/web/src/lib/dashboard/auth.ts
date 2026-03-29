import { copy } from './copy';
import type { AuthUser, Locale } from './types';

export function buildAuthenticatedUser(
  verifiedUser: AuthUser | null | undefined,
  locale: Locale,
): AuthUser {
  if (!verifiedUser?.sub || !verifiedUser?.role || !verifiedUser?.name) {
    throw new Error(copy[locale].invalidApiSession);
  }

  return {
    name: verifiedUser.name,
    role: verifiedUser.role,
    sub: verifiedUser.sub,
  };
}
