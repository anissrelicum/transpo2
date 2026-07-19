// Couleurs alignées sur la console web (Radix indigo/slate) pour la cohérence visuelle.
export const C = {
  indigo: '#3E63DD',
  indigoDark: '#3358D4',
  bg: '#FBFCFD',
  card: '#FFFFFF',
  border: '#E1E3E6',
  text: '#11181C',
  muted: '#697177',
  green: '#30A46C',
  amber: '#FFB224',
  red: '#E5484D',
};

// Couleur par statut (miroir de STATUS_META côté domaine).
export const STATUS_COLOR: Record<string, string> = {
  PROGRAMMEE: '#8B8D98', NOUVELLE: '#3E63DD', ASSIGNEE: '#3E63DD',
  RETRAIT: '#0091FF', RECUPEREE: '#8E4EC6', LIVRAISON: '#FFB224',
  LIVREE: '#30A46C', ECHOUEE: '#E5484D', RETOUR: '#F76B15', ANNULEE: '#8B8D98',
};
