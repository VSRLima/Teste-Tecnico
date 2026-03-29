export const roles = ['ADMIN', 'MANAGER'] as const;

export type Role = (typeof roles)[number];
