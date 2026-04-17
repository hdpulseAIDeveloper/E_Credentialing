-- P2 Gap #16 — CMS-0057-F FHIR R4 Provider Directory tables

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DirectoryOrganizationType') THEN
    CREATE TYPE "DirectoryOrganizationType" AS ENUM ('PROV', 'PAYER', 'GOVT', 'OTHER');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DirectoryEndpointType') THEN
    CREATE TYPE "DirectoryEndpointType" AS ENUM ('FHIR_BASE', 'DIRECT_SECURE_MESSAGING', 'EHR_API', 'REFERRAL_FORM', 'OTHER');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS "directory_organizations" (
  "id"           TEXT PRIMARY KEY,
  "name"         TEXT NOT NULL,
  "alias"        TEXT,
  "type"         "DirectoryOrganizationType" NOT NULL DEFAULT 'PROV',
  "npi"          TEXT,
  "tax_id"       TEXT,
  "active"       BOOLEAN NOT NULL DEFAULT true,
  "part_of_id"   TEXT,
  "phone"        TEXT,
  "email"        TEXT,
  "website"      TEXT,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "directory_orgs_part_of_fkey" FOREIGN KEY ("part_of_id") REFERENCES "directory_organizations"("id")
);
CREATE INDEX IF NOT EXISTS "directory_organizations_npi_idx" ON "directory_organizations" ("npi");
CREATE INDEX IF NOT EXISTS "directory_organizations_active_idx" ON "directory_organizations" ("active");

CREATE TABLE IF NOT EXISTS "directory_locations" (
  "id"             TEXT PRIMARY KEY,
  "name"           TEXT NOT NULL,
  "alias"          TEXT,
  "description"    TEXT,
  "status"         TEXT NOT NULL DEFAULT 'active',
  "street"         TEXT,
  "city"           TEXT,
  "state"          TEXT,
  "postal_code"    TEXT,
  "country"        TEXT DEFAULT 'US',
  "phone"          TEXT,
  "fax"            TEXT,
  "hours_json"     JSONB,
  "managing_org_id" TEXT,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "directory_locations_managing_org_fkey" FOREIGN KEY ("managing_org_id") REFERENCES "directory_organizations"("id")
);
CREATE INDEX IF NOT EXISTS "directory_locations_managing_org_idx" ON "directory_locations" ("managing_org_id");
CREATE INDEX IF NOT EXISTS "directory_locations_state_idx" ON "directory_locations" ("state");

CREATE TABLE IF NOT EXISTS "directory_endpoints" (
  "id"              TEXT PRIMARY KEY,
  "name"            TEXT NOT NULL,
  "status"          TEXT NOT NULL DEFAULT 'active',
  "connection_type" "DirectoryEndpointType" NOT NULL,
  "payload_type"    TEXT,
  "address"         TEXT NOT NULL,
  "managing_org_id" TEXT,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "directory_endpoints_managing_org_fkey" FOREIGN KEY ("managing_org_id") REFERENCES "directory_organizations"("id")
);
CREATE INDEX IF NOT EXISTS "directory_endpoints_managing_org_idx" ON "directory_endpoints" ("managing_org_id");

CREATE TABLE IF NOT EXISTS "directory_practitioner_roles" (
  "id"             TEXT PRIMARY KEY,
  "provider_id"    TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "location_id"    TEXT,
  "active"         BOOLEAN NOT NULL DEFAULT true,
  "specialty"      TEXT,
  "start_date"     TIMESTAMP(3),
  "end_date"       TIMESTAMP(3),
  "accepting_new_patients" BOOLEAN,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "directory_practitioner_roles_provider_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE,
  CONSTRAINT "directory_practitioner_roles_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "directory_organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "directory_practitioner_roles_location_fkey" FOREIGN KEY ("location_id") REFERENCES "directory_locations"("id")
);
CREATE INDEX IF NOT EXISTS "directory_practitioner_roles_provider_idx" ON "directory_practitioner_roles" ("provider_id");
CREATE INDEX IF NOT EXISTS "directory_practitioner_roles_organization_idx" ON "directory_practitioner_roles" ("organization_id");
CREATE INDEX IF NOT EXISTS "directory_practitioner_roles_active_idx" ON "directory_practitioner_roles" ("active");

-- Seed Essen Medical as the root Organization for the directory.
INSERT INTO "directory_organizations" ("id", "name", "alias", "type", "active", "phone", "email", "website", "updated_at")
VALUES (
  'essen-medical-root',
  'Essen Medical Associates',
  'Essen Health Care',
  'PROV',
  true,
  '+1-844-227-3308',
  'cred_onboarding@essenmed.com',
  'https://essenmed.com',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;
