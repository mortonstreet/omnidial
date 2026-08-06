ALTER TABLE "user" ADD COLUMN "clerkUserId" TEXT;
ALTER TABLE "organization" ADD COLUMN "clerkOrganizationId" TEXT;
ALTER TABLE "member" ADD COLUMN "clerkMembershipId" TEXT;
ALTER TABLE "invitation" ADD COLUMN "clerkInvitationId" TEXT;

CREATE UNIQUE INDEX "user_clerkUserId_key" ON "user"("clerkUserId");
CREATE UNIQUE INDEX "organization_clerkOrganizationId_key" ON "organization"("clerkOrganizationId");
CREATE UNIQUE INDEX "member_clerkMembershipId_key" ON "member"("clerkMembershipId");
CREATE UNIQUE INDEX "invitation_clerkInvitationId_key" ON "invitation"("clerkInvitationId");
