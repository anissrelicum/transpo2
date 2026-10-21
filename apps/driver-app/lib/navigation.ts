// Retour à « Ma journée » en vidant la pile des écrans de mission.
//
// `router.replace` seul ne remplace que l'écran du dessus : la fiche de l'arrêt déjà
// livré restait dessous, et un appui sur « retour » (ou le retour depuis Google Maps)
// la réaffichait avec « Arrêt introuvable ».
import { router } from 'expo-router';

export function retourJournee(): void {
  if (router.canDismiss()) router.dismissAll();
  router.navigate('/(tabs)/journee');
}
