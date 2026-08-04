-- Rename 'admin' to 'superadmin' for system-level super admin users
-- This clarifies the distinction between platform super admins and organization roles
UPDATE "user" SET role = 'superadmin' WHERE role = 'admin';

-- Rename organization-level 'admin' members to 'owner'
-- Organization owners have full admin access; we're removing the confusing 'admin' org role
UPDATE "member" SET role = 'owner' WHERE role = 'admin';

-- Update any pending invitations with 'admin' role to 'owner'
UPDATE "invitation" SET role = 'owner' WHERE role = 'admin';
