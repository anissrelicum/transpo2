-- Dossier chauffeur : contact, conformité (permis, visite médicale) et rattachement au parc.
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS phone       text;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS license_no  text;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS license_due text;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS medical_due text;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS vehicle_id  uuid;
