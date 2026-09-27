-- Demandes de démonstration venues du site vitrine.
--
-- Le site est statique : jusqu'ici son formulaire ouvrait la messagerie du VISITEUR vers
-- une adresse qui n'existait pas — le courrier rebondissait et le prospect croyait avoir
-- écrit. Même avec une adresse valide, un formulaire en `mailto:` dépend du logiciel de
-- messagerie de celui qui le remplit : sur un téléphone en webmail, la demande se perd
-- sans que personne le sache.
--
-- La demande est donc enregistrée ICI, côté serveur. Elle n'est rattachée à aucun tenant :
-- celui qui la dépose n'est pas encore client.
CREATE TABLE IF NOT EXISTS platform.demo_requests (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  societe    text        NOT NULL,
  nom        text        NOT NULL,
  email      text        NOT NULL,
  telephone  text,
  villes     text,
  livreurs   integer,
  message    text,
  source     text        NOT NULL DEFAULT 'contact',  -- 'accroche' | 'contact'
  statut     text        NOT NULL DEFAULT 'NOUVELLE', -- NOUVELLE | CONTACTE | ARCHIVEE
  note       text,                                    -- suivi interne, jamais montré au visiteur
  created_at timestamptz NOT NULL DEFAULT now(),
  handled_at timestamptz
);

-- La liste se lit par ordre d'arrivée, la plus récente d'abord.
CREATE INDEX IF NOT EXISTS demo_requests_created_at_idx ON platform.demo_requests (created_at DESC);
-- Un même prospect qui insiste ne doit pas encombrer la liste : le service refuse un
-- doublon récent, et cet index rend la vérification immédiate.
CREATE INDEX IF NOT EXISTS demo_requests_email_idx ON platform.demo_requests (lower(email), created_at DESC);
