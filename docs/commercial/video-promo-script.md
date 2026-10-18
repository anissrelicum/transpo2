# Portrail — Vidéo d'accroche : script

*Version 2 — 18 octobre 2026. Remplace la version « démonstration » de 60 s.*

## Le principe

**On ne montre pas le produit, on montre ce qu'il change.** Aucune capture d'écran réelle : une IA
pourrait reconstruire l'application à partir de captures. La vidéo ne doit déclencher qu'une chose :
l'envie d'essayer. Le produit, le prospect le découvre en démonstration ou pendant son essai.

**La mécanique (dans l'ordre) :**

1. **Le miroir** — le patron se reconnaît dans sa soirée (« 21 h, vous comptez encore »). Il doit
   penser « c'est moi » avant la 5e seconde.
2. **La douleur précise** — trois phrases qu'il s'est déjà dites : le cash qui manque, le colis dont
   personne ne sait qui l'a livré, le marchand qui réclame son argent. L'aversion à la perte pousse
   plus fort que la promesse de gain.
3. **La bascule** — une question, un silence : « Et si votre journée se gérait toute seule ? »
4. **Le soulagement, sans le mode d'emploi** — une carte floue où des points bougent, trois
   notifications. On montre le résultat (je vois, ça part seul, l'argent est tracé), jamais l'écran
   qui le produit.
5. **L'identité** — « Moins d'appels. Plus de contrôle. Et vous rentrez à l'heure. » On vend la
   soirée retrouvée, pas un logiciel.
6. **Le risque à zéro + la rareté** — 30 jours gratuits, on installe avec vous, sans engagement ;
   « Offre fondateurs · 10 places » (vrai : prix bloqué pour les 10 premiers clients).

**Format** : 45 s, 16:9, sous-titres incrustés + musique (regardable sans le son, comme la plupart
des vidéos reçues sur WhatsApp). Images : photos Unsplash et animation abstraite, aucun écran réel.

## Le découpage

| Temps | Image | Texte |
|---|---|---|
| 0–5 s | Livreur en scooter, la nuit | **21 h.** Vos livreurs sont rentrés. *Vous, vous comptez encore.* |
| 5–11 s | Entrepôt, assombri | « Il manque 300 DH dans la caisse. » · « Qui a livré le colis de Mme Benali ? » · « Le marchand veut son argent demain. » |
| 11–15 s | Noir | Et si votre journée se gérait **toute seule** ? |
| 15–23 s | Carte floue, points qui bougent (animation, pas une capture) | Vous voyez chaque livreur. Où il est. Ce qu'il porte. S'il sort de sa zone. *Sans appeler personne.* |
| 23–30 s | Trois notifications stylisées | Les courses partent seules. *Chaque dirham a une trace.* — « Course acceptée » · « Livré · 550 DH encaissés » · « Reversement prêt » |
| 30–35 s | Deux associés qui se tapent dans la main | Moins d'appels. Plus de contrôle. *Et vous rentrez à l'heure.* |
| 35–41 s | Fond marine | Essayez Portrail 30 jours. Gratuitement. On installe tout avec vous. Sans engagement. **Offre fondateurs · 10 places** |
| 41–45 s | Logo | Votre livraison, sur les rails. **Demandez votre essai** |

## Ce qu'on ne montre jamais

- Aucune capture de la console, du portail ou de l'app livreur (ni écran, ni menu, ni libellé).
- Aucune liste de fonctionnalités, aucun « comment » : seulement le résultat.
- Ni l'origine du produit, ni « IA », ni de chiffres de gains non mesurés.

## Production

Sources : `qa/promo-accroche/` (montage HTML rendu image par image, puis ffmpeg avec la musique).
