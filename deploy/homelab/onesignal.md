# Notifications push — OneSignal

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
   une notification Android ne sera délivrée, quel que soit le code. Il faut un projet
   Firebase et son fichier de compte de service, déposé dans OneSignal
   (*Settings → Push & In-App → Google Android*).
2. **Clé APNs (iOS)** — idem, si l'app livreur doit sortir sur iPhone. Demande un compte
   Apple Developer.
3. **Build de développement** — le push ne fonctionne pas dans Expo Go. `npx expo prebuild`
   puis `npx expo run:android`, ou une build EAS.

Tant que 1 et 3 ne sont pas faits, l'intégration est complète côté code et inerte côté
terrain — et l'app continue de tourner normalement dans Expo Go, sans push.
