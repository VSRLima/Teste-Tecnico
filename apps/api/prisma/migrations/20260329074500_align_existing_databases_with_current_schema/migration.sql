ALTER TYPE "public"."Role" ADD VALUE IF NOT EXISTS 'USER';

ALTER TABLE "public"."User"
ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "public"."Campaign"
ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "public"."Campaign"
DROP CONSTRAINT IF EXISTS "Campaign_ownerId_fkey";

ALTER TABLE "public"."Campaign"
ADD CONSTRAINT "Campaign_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'Campaign_budget_non_negative'
          AND conrelid = 'public."Campaign"'::regclass
    ) THEN
        ALTER TABLE "public"."Campaign"
        ADD CONSTRAINT "Campaign_budget_non_negative" CHECK ("budget" >= 0);
    END IF;
END
$$;

CREATE OR REPLACE FUNCTION "public"."set_updated_at_timestamp"()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'User_set_updated_at'
          AND tgrelid = 'public."User"'::regclass
    ) THEN
        CREATE TRIGGER "User_set_updated_at"
        BEFORE UPDATE ON "public"."User"
        FOR EACH ROW
        EXECUTE FUNCTION "public"."set_updated_at_timestamp"();
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'Campaign_set_updated_at'
          AND tgrelid = 'public."Campaign"'::regclass
    ) THEN
        CREATE TRIGGER "Campaign_set_updated_at"
        BEFORE UPDATE ON "public"."Campaign"
        FOR EACH ROW
        EXECUTE FUNCTION "public"."set_updated_at_timestamp"();
    END IF;
END
$$;
