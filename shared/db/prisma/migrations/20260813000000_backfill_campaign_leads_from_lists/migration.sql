-- @wave1-safe: true
-- @lock-risk: low
-- @dry-run-required: true

WITH existing_max AS (
  SELECT
    "campaignId",
    COALESCE(MAX("dialOrder"), -1) AS "maxOrder"
  FROM "campaign_lead"
  GROUP BY "campaignId"
),
candidate_entries AS (
  SELECT
    cl."campaignId",
    lle."leadId",
    cl."addedAt",
    lle."sortOrder",
    lle."createdAt",
    lle."id" AS "entryId"
  FROM "campaign_list" cl
  INNER JOIN "lead_list_entry" lle ON lle."listId" = cl."listId"
  INNER JOIN "lead" l ON l."id" = lle."leadId"
  LEFT JOIN "campaign_lead" existing_lead
    ON existing_lead."campaignId" = cl."campaignId"
    AND existing_lead."leadId" = lle."leadId"
  WHERE lle."removedAt" IS NULL
    AND l."deletedAt" IS NULL
    AND existing_lead."id" IS NULL
),
deduped_entries AS (
  SELECT DISTINCT ON ("campaignId", "leadId")
    "campaignId",
    "leadId",
    "addedAt",
    "sortOrder",
    "createdAt",
    "entryId"
  FROM candidate_entries
  ORDER BY
    "campaignId",
    "leadId",
    "addedAt" ASC,
    "sortOrder" ASC,
    "createdAt" ASC,
    "entryId" ASC
),
numbered_entries AS (
  SELECT
    d."campaignId",
    d."leadId",
    (
      COALESCE(em."maxOrder", -1)
      + ROW_NUMBER() OVER (
        PARTITION BY d."campaignId"
        ORDER BY d."addedAt" ASC, d."sortOrder" ASC, d."createdAt" ASC, d."entryId" ASC
      )
    )::integer AS "dialOrder"
  FROM deduped_entries d
  LEFT JOIN existing_max em ON em."campaignId" = d."campaignId"
),
inserted_entries AS (
  INSERT INTO "campaign_lead" (
    "id",
    "campaignId",
    "leadId",
    "status",
    "dialOrder",
    "createdAt"
  )
  SELECT
    gen_random_uuid()::text,
    "campaignId",
    "leadId",
    'pending',
    "dialOrder",
    CURRENT_TIMESTAMP
  FROM numbered_entries
  ON CONFLICT ("campaignId", "leadId") DO NOTHING
  RETURNING "campaignId"
),
affected_campaigns AS (
  SELECT DISTINCT "campaignId"
  FROM inserted_entries
),
counts AS (
  SELECT
    cl."campaignId",
    COUNT(*)::integer AS "leadCount",
    COUNT(*) FILTER (WHERE cl."status" IN ('dialed', 'completed'))::integer AS "dialedCount",
    COUNT(*) FILTER (WHERE cl."status" = 'completed')::integer AS "connectedCount"
  FROM "campaign_lead" cl
  INNER JOIN affected_campaigns ac ON ac."campaignId" = cl."campaignId"
  GROUP BY cl."campaignId"
)
UPDATE "campaign" c
SET
  "leadCount" = counts."leadCount",
  "dialedCount" = counts."dialedCount",
  "connectedCount" = counts."connectedCount",
  "updatedAt" = CURRENT_TIMESTAMP
FROM counts
WHERE c."id" = counts."campaignId";
