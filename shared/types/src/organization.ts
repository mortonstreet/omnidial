// Organization-level roles (Member.role)
export const OrganizationRole = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
} as const;

export type OrganizationRole = (typeof OrganizationRole)[keyof typeof OrganizationRole];

// System-level roles (User.role)
export const SystemRole = {
  SUPER_ADMIN: 'superadmin',
} as const;

export type SystemRole = (typeof SystemRole)[keyof typeof SystemRole];