# Vidéo d'accroche Portrail — 45 s

Script et principes : `docs/commercial/video-promo-script.md`. Aucune capture réelle du produit.

Dossier de travail `m2/` (non versionné) : `montage.html` + `inter-latin-var.woff2`, `symbole.svg`,
`musique-motivating-mornings.mp3` (de `qa/promo/medias/`), photos Unsplash 1920×1080 :
`nuit.jpg` (1617347454431-f49d7ff5c3b1), `entrepot.jpg` (1553413077-190dd305871c),
`soulagement.jpg` (1600880292203-757bb62b4baf), et `carte-floue.jpg` (fond de carte flouté,
désaturé, illisible).

Rendu : `node rendu2.mjs` (1 350 images dans `images2/`), puis
`ffmpeg -framerate 30 -i images2/%05d.jpg -ss 4 -t 45 -i m2/musique-motivating-mornings.mp3 -filter_complex "[1:a]afade=t=in:d=1.5,afade=t=out:st=41.5:d=3.5,loudnorm=I=-14:TP=-1.5:LRA=11[a]" -map 0:v -map "[a]" -c:v libx264 -crf 20 -pix_fmt yuv420p -movflags +faststart -c:a aac portrail-accroche-45s.mp4`.
