-- Migration platform 0001 — super-admins (realm plateforme) + journal d'audit.
CREATE TABLE IF NOT EXISTS platform.super_admins (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  name          text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform.audit_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  at         timestamptz NOT NULL DEFAULT now(),
  actor      text NOT NULL,          -- email / id de l'auteur
  actor_role text NOT NULL,
  tenant     text,                   -- tenant concerné (null si action plateforme)
  action     text NOT NULL,          -- ex. tenant.provision, tenant.suspend, auth.impersonate
  target     text,                   -- entité visée (slug, ref…)
  detail     jsonb
);
