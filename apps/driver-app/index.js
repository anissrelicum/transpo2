// Point d'entrée local de l'application livreur.
//
// `"main": "expo-router/entry"` ne fonctionne pas dans un mono-repo pnpm : Expo Go résout
// l'entrée à travers le lien symbolique, jusqu'à `node_modules/.pnpm/expo-router@…/…`, puis
// la demande à Metro sous forme de chemin RELATIF au dossier de l'app — où ce chemin
// n'existe pas. Résultat : le bundle se construit côté serveur, et l'app affiche
// « Unable to resolve module ./node_modules/.pnpm/expo-router@… » au démarrage.
//
// Une entrée locale règle le problème à la racine : Metro reçoit `/index.bundle`, un chemin
// qui existe bel et bien sous l'app, et le routeur démarre normalement.
import 'expo-router/entry';
