DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "public"."Campaign"
        GROUP BY "ownerId", "name"
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Cannot create Campaign_ownerId_name_key because duplicate ownerId/name rows exist';
    END IF;
END
$$;

CREATE UNIQUE INDEX "Campaign_ownerId_name_key" ON "public"."Campaign"("ownerId", "name");
