# Vidéo promotionnelle Portrail — 60 s (octobre 2026)

Script : `docs/commercial/video-promo-script.md`. Sous-titres incrustés + musique, sans voix off
(pas de clé Deepgram au moment du rendu). Uniquement de vrais écrans.

Matière (non versionnée, à regénérer dans un dossier de travail `m/`) :
- `flotte/NNNN.jpg` : `rec-flotte.mjs` filme le PC flotte de `portraildemo` (simulation de 10 livreurs active),
  puis `ffmpeg -ss 4 -to 36 -i flotte.webm -vf fps=30 m/flotte/%04d.jpg` ;
- `offre/NNNN.jpg` : `adb shell screenrecord` sur l'émulateur, livreur de la société `portrailvideo`
  (créée par `SLUG=portrailvideo node qa/recette/compte-test-livreur.mjs`), proposition puis « Accepter » ;
- `st/*.jpg` : captures de l'app (journée, tournée, remise, encaissement, réussite, caisse) et de la console
  (`ecrans.mjs` : réconciliation cash, tableau de bord en arabe) ;
- `musique-motivating-mornings.mp3` (de `qa/promo/medias/`), `symbole.svg`, `inter-latin-var.woff2`.

Rendu : `node rendu.mjs` (1 800 images), puis
`ffmpeg -framerate 30 -i images/%05d.jpg -ss 6 -t 60 -i m/musique-motivating-mornings.mp3 -filter_complex "[1:a]afade=t=in:d=1,afade=t=out:st=56.5:d=3.5,loudnorm=I=-14:TP=-1.5:LRA=11[a]" -map 0:v -map "[a]" -c:v libx264 -crf 20 -pix_fmt yuv420p -movflags +faststart -c:a aac portrail-video-60s.mp4`.
