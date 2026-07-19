-- Migration tenant 0008 — notifications & consentement (T19, loi 09-08).
-- Consentement par destinataire + canal (marketing) ; les envois transactionnels en sont exemptés.
CREATE TABLE IF NOT EXISTS notif_consents (
  subject    text NOT NULL,               -- téléphone ou e-mail du destinataire
  channel    text NOT NULL,               -- SMS | WHATSAPP | PUSH | EMAIL
  opted_in   boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subject, channel)
);

CREATE TABLE IF NOT EXISTS notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event      text NOT NULL,
  channel    text NOT NULL,
  recipient  text NOT NULL,
  lang       text NOT NULL DEFAULT 'fr',
  body       text NOT NULL,
  status     text NOT NULL DEFAULT 'QUEUED',  -- QUEUED | SENT | BLOCKED
  reason     text,                            -- motif si BLOCKED
  created_at timestamptz NOT NULL DEFAULT now()
);
