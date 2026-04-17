-- Correct seeded role tags to match the actual UserRole enum.
UPDATE "training_courses"
SET "required_for_roles" = ARRAY['SPECIALIST','MANAGER','ADMIN']::TEXT[]
WHERE "code" = 'NCQA-DI-101';

UPDATE "training_courses"
SET "required_for_roles" = ARRAY['SPECIALIST','MANAGER','ADMIN','PROVIDER']::TEXT[]
WHERE "code" = 'HIPAA-PRIVACY-101';

UPDATE "training_courses"
SET "required_for_roles" = ARRAY['SPECIALIST','MANAGER','COMMITTEE_MEMBER']::TEXT[]
WHERE "code" = 'NCQA-NONDISCRIM-101';

UPDATE "training_courses"
SET "required_for_roles" = ARRAY['SPECIALIST','MANAGER','COMMITTEE_MEMBER']::TEXT[]
WHERE "code" = 'NCQA-CONFIDENTIALITY-101';

UPDATE "training_courses"
SET "required_for_roles" = ARRAY['SPECIALIST','MANAGER','ADMIN']::TEXT[]
WHERE "code" = 'NCQA-AI-GOV-101';
