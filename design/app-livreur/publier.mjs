// Produit une copie de maquette.html compatible avec la CSP du site (style-src/script-src 'self') :
// CSS et JS sortis en fichiers, attributs style="" convertis en classes, Inter servi par le site.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const dossier = new URL('./sortie/', import.meta.url);
mkdirSync(dossier, { recursive: true });
let html = readFileSync(new URL('./maquette.html', import.meta.url), 'utf8');
let css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
const js = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const classes = new Map();
html = html.replace(/<(\w+)([^>]*?)\sstyle="([^"]*)"([^>]*)>/g, (_, tag, avant, style, apres) => {
  if (!classes.has(style)) classes.set(style, `s${classes.size}`);
  const nom = classes.get(style);
  const attrs = avant + apres;
  if (/\sclass="/.test(attrs)) return `<${tag}${attrs.replace(/\sclass="([^"]*)"/, ` class="$1 ${nom}"`)}>`;
  return `<${tag}${avant} class="${nom}"${apres}>`;
});
css = `@font-face{font-family:Inter;font-weight:400 800;font-display:swap;src:url(/fonts/inter-latin-var.woff2) format("woff2")}\n` + css
  + [...classes].map(([s, n]) => `.${n}.${n}{${s}}`).join('\n');
html = html.replace(/<link rel="preconnect"[^>]*>\n?/, '').replace(/<link href="https:\/\/fonts[^>]*>\n?/, '')
  .replace(/<style>[\s\S]*?<\/style>/, '<link rel="stylesheet" href="app-livreur.css">')
  .replace(/<script>[\s\S]*?<\/script>/, '<script src="app-livreur.js"></script>');
writeFileSync(new URL('app-livreur.html', dossier), html);
writeFileSync(new URL('app-livreur.css', dossier), css);
writeFileSync(new URL('app-livreur.js', dossier), js);
writeFileSync(new URL('symbole.svg', dossier), readFileSync(new URL('./symbole.svg', import.meta.url)));
console.log(`${classes.size} styles convertis`);
