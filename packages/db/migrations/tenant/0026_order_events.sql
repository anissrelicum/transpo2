-- Journal des transitions d'une commande.
--
-- L'onglet « Historique » de la fiche commande ne lisait rien : il DÉDUISAIT le parcours à
-- partir du statut courant, en déroulant le chemin nominal jusqu'à lui. Conséquences
-- relevées en recette (TC-F11) : aucune date, aucun acteur, et un parcours inventé pour
-- toute commande sortie du chemin nominal — une commande annulée affichait fièrement les
-- étapes par lesquelles elle n'était jamais passée.
--
-- Un litige COD, une contestation de livraison ou un contrôle se tranchent sur des faits
-- horodatés. D'où ce journal, écrit à chaque transition.
CREATE TABLE IF NOT EXISTS order_events (
  id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref    text        NOT NULL REFERENCES orders(ref) ON DELETE CASCADE,
  status text        NOT NULL,
  actor  text,                      -- email ou nom du livreur ; NULL = automate
  note   text,
  at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_events_ref_idx ON order_events (ref, at);
