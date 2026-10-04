export type UserRole = 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR';

export const ROLE_LABEL: Record<UserRole, string> = {
  REQUESTER: 'Requester',
  IT_STAFF: 'IT Staff',
  ADMINISTRATOR: 'Administrator',
};

export const ROLE_BADGE_CLASS: Record<UserRole, string> = {
  REQUESTER: 'zen-badge-role-requester',
  IT_STAFF: 'zen-badge-role-staff',
  ADMINISTRATOR: 'zen-badge-role-admin',
};
