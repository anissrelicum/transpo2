import * as React from 'react';
import { CreateWizard } from '../../../../components/CreateWizard';

export const dynamic = 'force-dynamic';

/**
 * Création d'une commande par le marchand.
 *
 * Le portail marchand était livré sans ce geste : l'API autorisait pourtant le rôle
 * MERCHANT à déposer une commande, mais aucun écran ne le proposait — un marchand devait
 * appeler son transporteur pour faire saisir sa course par l'exploitation.
 *
 * Le marchand n'est pas choisi ici : l'API le force à celui du compte, quelle que soit la
 * valeur envoyée.
 */
export default function MerchantNewOrderPage() {
  return <CreateWizard merchants={[]} espace="marchand" />;
}
