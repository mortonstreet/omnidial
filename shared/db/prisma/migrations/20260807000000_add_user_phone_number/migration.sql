-- Caller IDs owned by an individual rep.
--
-- Numbers were previously assigned per client (client_phone_number), so every
-- rep working a client shared the same pool and two of them could dial out from
-- the same number simultaneously. The unique constraint on
-- (organizationId, phoneNumber) makes single ownership a database guarantee
-- rather than something the UI merely avoids offering.
--
-- client_phone_number is intentionally left in place for now; it is dropped in a
-- follow-up once this has been verified in production.

CREATE TABLE "user_phone_number" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "friendlyName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_phone_number_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_phone_number_organizationId_phoneNumber_key"
    ON "user_phone_number"("organizationId", "phoneNumber");

CREATE INDEX "user_phone_number_organizationId_idx"
    ON "user_phone_number"("organizationId");

CREATE INDEX "user_phone_number_organizationId_userId_idx"
    ON "user_phone_number"("organizationId", "userId");

ALTER TABLE "user_phone_number"
    ADD CONSTRAINT "user_phone_number_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Row level security, matching the client_phone_number policies.
ALTER TABLE "user_phone_number" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_phone_number_select" ON "user_phone_number" FOR SELECT TO authenticated USING ("organizationId" = requesting_org_id());
CREATE POLICY "user_phone_number_insert" ON "user_phone_number" FOR INSERT TO authenticated WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "user_phone_number_update" ON "user_phone_number" FOR UPDATE TO authenticated USING ("organizationId" = requesting_org_id()) WITH CHECK ("organizationId" = requesting_org_id());
CREATE POLICY "user_phone_number_delete" ON "user_phone_number" FOR DELETE TO authenticated USING (false);
CREATE POLICY "user_phone_number_anon"   ON "user_phone_number" FOR ALL TO anon USING (false);
