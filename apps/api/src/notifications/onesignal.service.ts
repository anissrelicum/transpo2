import { Injectable, Logger } from '@nestjs/common';

/**
 * Envoi de notifications push par OneSignal.
 *
 * Deux choses à savoir avant de lire le code.
 *
 * 1. **La clé REST n'est JAMAIS dans le dépôt.** Elle vit dans l'environnement du
 *    conteneur (secret Kubernetes `transpo-onesignal`). L'identifiant d'application, lui,
 *    n'est pas un secret : il est embarqué dans chaque copie de l'app livreur.
 *
 * 2. **Le destinataire est un identifiant externe, pas un appareil.** L'app livreur
 *    s'enregistre sous `<tenant>:<chauffeur>` (cf. `apps/driver-app/lib/push.ts`). Le
 *    serveur recalcule la même clé : aucune table de correspondance à tenir, et un livreur
 *    qui change de téléphone reste joignable sans que rien ne soit mis à jour ici.
 */
@Injectable()
export class OneSignalService {
  private readonly log = new Logger('OneSignal');

  private get appId(): string | undefined { return process.env.ONESIGNAL_APP_ID?.trim() || undefined; }
  private get apiKey(): string | undefined { return process.env.ONESIGNAL_API_KEY?.trim() || undefined; }

  /** Le push est-il configuré sur cette instance ? */
  get configure(): boolean { return Boolean(this.appId && this.apiKey); }

  /** Identifiant externe d'un livreur, tel que l'app l'enregistre. */
  static idExterne(tenantSlug: string, chauffeur: string): string {
    return `${tenantSlug}:${chauffeur}`;
  }

  /**
   * Envoie une notification à un identifiant externe.
   * Rend `null` si le push n'est pas configuré, et LÈVE si OneSignal refuse : l'appelant
   * doit pouvoir écrire un échec plutôt que de consigner un envoi qui n'a pas eu lieu.
   */
  async envoyer(idExterne: string, contenu: { fr: string; ar?: string }, donnees?: Record<string, string>) {
    if (!this.configure) return null;
    const corps: Record<string, unknown> = {
      app_id: this.appId,
      target_channel: 'push',
      include_aliases: { external_id: [idExterne] },
      contents: { en: contenu.fr, fr: contenu.fr, ...(contenu.ar ? { ar: contenu.ar } : {}) },
      ...(donnees ? { data: donnees } : {}),
    };

    const r = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Key ${this.apiKey}` },
      body: JSON.stringify(corps),
      // Une notification n'est pas un acte métier : elle ne doit pas retenir la requête
      // qui l'a déclenchée si OneSignal est lent.
      signal: AbortSignal.timeout(8000),
    });

    const reponse = (await r.json().catch(() => null)) as
      | { id?: string; errors?: unknown; recipients?: number } | null;

    if (!r.ok) {
      throw new Error(`OneSignal ${r.status} : ${JSON.stringify(reponse?.errors ?? reponse)}`);
    }
    // « Aucun destinataire » n'est pas une erreur de transport : c'est un livreur dont
    // l'appareil n'est pas (encore) enregistré. Le dire franchement vaut mieux que de
    // consigner un envoi réussi vers personne.
    if (reponse && reponse.recipients === 0) {
      throw new Error('Aucun appareil enregistré pour ce destinataire.');
    }
    this.log.log(`push envoyé à ${idExterne} (${reponse?.id ?? 'sans identifiant'})`);
    return reponse;
  }
}
