-- Migration tenant 0005 — portail marchand.
-- Lien d'un utilisateur MERCHANT vers son nom de marchand (= orders.merchant).
-- Le scoping du portail se fait côté serveur via ce claim (jamais depuis le client).
ALTER TABLE users ADD COLUMN IF NOT EXISTS merchant text;
