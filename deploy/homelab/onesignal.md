# Notifications push — OneSignal

## Deux clés, deux usages — ne pas les confondre

OneSignal en distingue deux, et l'une ne fait pas le travail de l'autre. La confusion coûte
un `401 Access denied` dont le message ne dit pas laquelle manque.

| Clé | Préfixe | Ce qu'elle permet | Où elle vit |
|---|---|---|---|
| **Organisation** | `os_v2_org_…` | gérer les applications : lire leur état, déposer la clé FCM (`PUT /apps/{id}`) | à la main, pour les scripts d'administration |
| **REST de l'application** | `os_v2_app_…` | **envoyer des notifications** (`POST /notifications`) | secret Kubernetes `transpo-onesignal`, clé `api-key` |

Vérifié : la clé d'organisation est refusée par `POST /notifications`, quelle que soit la
forme de l'en-tête (`Key`, `Basic`, `Bearer`). Et `GET /apps/{id}` ne rend plus
`basic_auth_key` — la clé d'application ne se récupère donc que dans le tableau de bord :

```
OneSignal → votre application → Settings → Keys & IDs → « REST API Key »
```

## Ce qui est dans le dépôt, et ce qui n'y est pas

| | Où |
|---|---|
| **Identifiant d'application** `e5247c1a-…` | `apps/driver-app/lib/push.ts` — **ce n'est pas un secret** : il est embarqué dans chaque copie de l'app livreur |
| **Clé REST** | **nulle part dans le dépôt.** Secret Kubernetes `transpo-onesignal`, monté dans l'API sous `ONESIGNAL_API_KEY` |

Poser ou remplacer le secret :

```bash
kubectl create secret generic transpo-onesignal -n transpo \
  --from-literal=app-id='<APP_ID>' \
  --from-literal=api-key='<CLÉ REST>' \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl set env deployment/transpo-api -n transpo --from=secret/transpo-onesignal --prefix=ONESIGNAL_
```

L'API sans ces variables ne plante pas : le canal PUSH consigne alors la notification en
`QUEUED` avec le motif « push non configuré ». Un environnement de développement n'a donc
rien à faire.

## Comment un livreur est visé

L'app s'enregistre sous l'identifiant externe `<tenant>:<chauffeur>` — par exemple
`rabatexpress:Hamid Ouali`. Le serveur recompose la même clé : aucune table de
correspondance à tenir, et un livreur qui change de téléphone reste joignable.

Cette clé est unique par construction : les commandes portent déjà le NOM du chauffeur, et
le produit refuse les homonymes dans un même tenant (cf. TC-D14).

## Ce qui reste à faire avant qu'une notification parte vraiment

1. **Clé FCM (Android)** — l'application OneSignal n'en a AUCUNE aujourd'hui. Sans elle, pas
   une notification Android ne sera délivrée, quel que soit le code.

   Elle se dépose **par l'API** (`PUT /apps/{app_id}`, champ `fcm_v1_service_account_json`,
   fichier encodé en base64) — la clé fournie a bien la portée *organisation* que cet appel
   réclame, vérifié par un `GET /apps` qui répond 200. Mais l'API ne peut que RECEVOIR ce
   justificatif : il se génère dans la console Firebase, et cette étape-là n'appartient
   qu'au propriétaire du projet Google.

   ```
   Firebase → votre projet → ⚙ Paramètres du projet → Comptes de service
            → « Générer une nouvelle clé privée » → un fichier .json est téléchargé
   ```

   Puis, en une commande :

   ```bash
   ONESIGNAL_API_KEY='<clé organisation>' \
     node deploy/homelab/onesignal-fcm.mjs ./chemin/vers/compte-de-service.json
   ```

   Le script refuse un `google-services.json` — c'est le fichier CLIENT, pas le compte de
   service. La confusion est fréquente, et OneSignal l'accepterait sans rien pouvoir en
   faire.

   `node deploy/homelab/onesignal-fcm.mjs --verifier` rend l'état courant sans rien écrire.
2. **Clé APNs (iOS)** — idem, si l'app livreur doit sortir sur iPhone. Demande un compte
   Apple Developer.
3. **Build de développement** — le push ne fonctionne pas dans Expo Go. `npx expo prebuild`
   puis `npx expo run:android`, ou une build EAS.

## Vérifié de bout en bout le 17/09

| Étape | Preuve |
|---|---|
| Compte de service Firebase déposé | `PUT /apps/{id}` — Android passé à « configuré » |
| Build de développement Android | `BUILD SUCCESSFUL in 18m 34s`, installée sur l'émulateur |
| Jeton FCM obtenu par l'appareil | `fIvZHLOXTNmbYZyfMOjs98:APA91bG…` |
| Abonnement OneSignal | `SUBSCRIBED`, permission accordée — 1 abonné |
| Envoi à `demoexpress:Hamid Ouali` | `successful: 1, failed: 0` |
| Affichage sur l'appareil | notification visible dans le volet |

Une remarque utile pour le jour où « ça ne marche pas » : app **au premier plan**, la
notification est reçue mais ne s'affiche PAS dans le volet — c'est le comportement normal
d'Android, et `successful: 1` le confirme. Mettre l'app en arrière-plan avant de conclure à
une panne.

Reste ouvert : iOS (demande un compte Apple Developer), et la section G de la recette, qui
continue de passer par Expo Go — donc sans push. Les deux mondes coexistent volontairement,
cf. le garde-fou de `apps/driver-app/lib/push.ts`.
