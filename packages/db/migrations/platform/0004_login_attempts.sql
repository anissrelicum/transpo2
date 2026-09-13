-- Anti-bruteforce partagé.
--
-- Le compteur d'échecs vivait dans la mémoire du processus API (constat OBS-02 de la
-- recette) : remis à zéro à chaque déploiement ou redémarrage de conteneur, indépendant
-- d'une réplique à l'autre, et keyé sur (tenant, email) seulement — un « password
-- spraying » (un essai sur deux cents adresses) n'était donc jamais freiné.
--
-- La table le rend durable, partagé entre répliques, et permet une seconde clé par IP.
-- `key` porte son propre préfixe de famille :
--   · 'u:<tenant>:<email>'  — un compte visé de façon répétée
--   · 'ip:<adresse>'        — une source qui balaie beaucoup de comptes
CREATE TABLE IF NOT EXISTS platform.login_attempts (
  key        text PRIMARY KEY,
  count      integer     NOT NULL DEFAULT 0,
  first_at   timestamptz NOT NULL DEFAULT now(),
  last_at    timestamptz NOT NULL DEFAULT now()
);

-- Purge des fenêtres écoulées (le service ne lit que des clés vivantes).
CREATE INDEX IF NOT EXISTS login_attempts_first_at_idx ON platform.login_attempts (first_at);
