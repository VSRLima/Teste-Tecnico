export const roles = ['ADMIN', 'MANAGER', 'USER'] as const;

export type Role = (typeof roles)[number];
