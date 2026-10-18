// Carte de la journée : arrêts numérotés, trajet dans l'ordre, position du livreur.
//
// Leaflet dans une WebView, sur les fonds CARTO déjà utilisés par la console : même rendu
// sur iOS et Android, sans clé Google Maps ni SDK cartographique natif. La clé Basemaps
// vient de EXPO_PUBLIC_CARTO_BASEMAPS_KEY (sinon app.json > extra.cartoKey) ; sans clé,
// repli sur les tuiles OpenStreetMap. Le trajet affiché relie les arrêts en ligne droite :
// le guidage routier reste celui de Google Maps / Waze, ouvert par « Naviguer ».
import * as React from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import Constants from 'expo-constants';

// Injecté par Expo à la compilation (pas de types Node dans l'app).
declare const process: { env: Record<string, string | undefined> };

export type PointCarte = {
  ref: string; lat: number; lng: number; n: number; etat: 'prochain' | 'avenir' | 'fait';
  /** Ramassage (carré violet) ou livraison (goutte) : la forme suffit à les distinguer. */
  type?: 'retrait' | 'livraison';
};

const CLE_CARTO =
  // Forme littérale obligatoire : Expo n'injecte EXPO_PUBLIC_* qu'écrit tel quel.
  process.env.EXPO_PUBLIC_CARTO_BASEMAPS_KEY ||
  ((Constants.expoConfig?.extra as any)?.cartoKey as string | undefined) ||
  '';

function page(sombre: boolean, lang: 'fr' | 'ar' = 'fr', hautLegende = 12): string {
  const R = lang === 'ar' ? 'استلام' : 'Ramassage';
  const Lv = lang === 'ar' ? 'تسليم' : 'Livraison';
  const fond = CLE_CARTO
    ? `https://{s}.basemaps.cartocdn.com/${sombre ? 'dark_all' : 'rastertiles/voyager'}/{z}/{x}/{y}{r}.png?key=${CLE_CARTO}`
    : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const attribution = CLE_CARTO ? '© OpenStreetMap © CARTO' : '© OpenStreetMap';
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
html,body,#c{margin:0;height:100%;background:${sombre ? '#1B2340' : '#EDF1E8'}}
.leaflet-control-attribution{font-size:9px;opacity:.7}
.ep{width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:grid;place-items:center;
  background:#3E5BDB;border:3px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,.3);box-sizing:border-box}
.ep b{transform:rotate(45deg);color:#fff;font:700 13px system-ui,sans-serif}
.ep.fait{background:#9AA3B5}.ep.prochain{background:#F5A524}.ep.prochain b{color:#0B1537}
.rt{width:30px;height:30px;border-radius:8px;display:grid;place-items:center;background:#6E56CF;border:3px solid #fff;
  box-shadow:0 3px 8px rgba(0,0,0,.3);box-sizing:border-box;font:700 13px system-ui,sans-serif;color:#fff}
.rt.prochain{background:#F5A524;color:#0B1537;width:36px;height:36px}
.ep.prochain{width:40px;height:40px}
.leaflet-top.leaflet-left{top:${hautLegende}px}
.legende{background:${sombre ? '#141C38' : '#fff'};color:${sombre ? '#EEF1FA' : '#0B1220'};border-radius:10px;padding:6px 9px;
  font:600 11px system-ui,sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.2);display:flex;gap:10px;align-items:center}
.legende i{display:inline-block;width:11px;height:11px;margin-right:4px;vertical-align:-1px}
.moi{width:22px;height:22px;border-radius:50%;background:#3E5BDB;border:4px solid #fff;box-sizing:border-box;box-shadow:0 0 0 8px rgba(62,91,219,.22)}
</style></head><body><div id="c"></div><script>
var carte=L.map('c',{zoomControl:false,attributionControl:true}).setView([33.57,-7.59],12);
L.tileLayer('${fond}',{subdomains:'abcd',maxZoom:19,attribution:'${attribution}'}).addTo(carte);
var calque=L.layerGroup().addTo(carte),moi=null,dernierePos=null,bas=260,cles='';
var legende=L.control({position:'topleft'});
legende.onAdd=function(){var d=L.DomUtil.create('div','legende');d.innerHTML='<span><i style="background:#6E56CF;border-radius:3px"></i>${R}</span><span><i style="background:#3E5BDB;border-radius:50% 50% 50% 0;transform:rotate(-45deg)"></i>${Lv}</span>';return d;};
function envoyer(m){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify(m));}
function cadrer(){
  var pts=[];calque.eachLayer(function(l){if(l.getLatLng)pts.push(l.getLatLng());});
  if(dernierePos)pts.push(dernierePos);
  if(!pts.length)return;
  if(pts.length===1){carte.setView(pts[0],15);return;}
  carte.fitBounds(L.latLngBounds(pts),{paddingTopLeft:[40,110],paddingBottomRight:[40,bas+20],maxZoom:16});
}
window.maj=function(d){
  bas=d.bas||bas;
  carte.invalidateSize();
  calque.clearLayers();
  if(d.legende&&!legende._map){legende.addTo(carte);}
  // Tracés par les rues quand ils sont connus : la suite de la journée en clair, le trajet
  // vers le prochain arrêt par-dessus, épais. À défaut (hors réseau), des lignes droites.
  var bleu='${sombre ? '#7B93FF' : '#3E5BDB'}';
  if(d.suite&&d.suite.length>1)calque.addLayer(L.polyline(d.suite,{color:bleu,weight:4,opacity:.4,lineJoin:'round'}));
  if(d.prochain&&d.prochain.length>1)calque.addLayer(L.polyline(d.prochain,{color:bleu,weight:7,opacity:.95,lineJoin:'round'}));
  var trace=[];if(d.moi)trace.push([d.moi.lat,d.moi.lng]);
  d.points.forEach(function(p){
    if(p.etat!=='fait')trace.push([p.lat,p.lng]);
    var html,taille,ancre;
    if(p.type==='retrait'){taille=p.etat==='prochain'?36:30;html='<div class="rt '+p.etat+'">'+p.n+'</div>';ancre=[taille/2,taille/2];}
    else{taille=p.etat==='prochain'?40:34;html='<div class="ep '+p.etat+'"><b>'+p.n+'</b></div>';ancre=[taille/2,taille];}
    var m=L.marker([p.lat,p.lng],{icon:L.divIcon({className:'',html:html,iconSize:[taille,taille],iconAnchor:ancre}),zIndexOffset:p.etat==='prochain'?500:0});
    m.on('click',function(){envoyer({type:'arret',ref:p.ref});});
    calque.addLayer(m);
  });
  if(!d.prochain&&!d.suite&&trace.length>1)calque.addLayer(L.polyline(trace,{color:bleu,weight:5,opacity:.85,dashArray:'2 10',lineJoin:'round'}));
  if(d.moi){dernierePos=L.latLng(d.moi.lat,d.moi.lng);
    if(!moi)moi=L.marker(dernierePos,{icon:L.divIcon({className:'',html:'<div class="moi"></div>',iconSize:[22,22],iconAnchor:[11,11]}),zIndexOffset:1000}).addTo(carte);
    else moi.setLatLng(dernierePos);}
  var k=d.points.map(function(p){return p.ref}).join(',');
  if(k!==cles||d.recadrer){cles=k;cadrer();}
};
window.recadrer=function(){carte.invalidateSize();cadrer();};
window.addEventListener('resize',function(){carte.invalidateSize();cadrer();});
envoyer({type:'prete'});
</script></body></html>`;
}

export interface CarteJourneeRef { recadrer: () => void }

export const CarteJournee = React.forwardRef<CarteJourneeRef, {
  points: PointCarte[];
  moi: { lat: number; lng: number } | null;
  sombre: boolean;
  /** Hauteur occupée en bas par la feuille « prochain arrêt » : la carte cadre au-dessus. */
  bas: number;
  onArret?: (ref: string) => void;
  /** Tracé par les rues vers le prochain arrêt, puis pour la suite de la journée (`[lat, lng]`). */
  prochain?: [number, number][] | null;
  suite?: [number, number][] | null;
  legende?: boolean;
  /** Décalage (px) de la légende depuis le haut : sous les cartes flottantes de l'écran. */
  hautLegende?: number;
  lang?: 'fr' | 'ar';
}>(function CarteJournee({ points, moi, sombre, bas, onArret, prochain, suite, legende, hautLegende = 12, lang = 'fr' }, ref) {
  const vue = React.useRef<WebView>(null);
  const [prete, setPrete] = React.useState(false);
  const html = React.useMemo(() => page(sombre, lang, hautLegende), [sombre, lang, hautLegende]);

  React.useImperativeHandle(ref, () => ({
    recadrer: () => vue.current?.injectJavaScript('window.recadrer&&window.recadrer();true;'),
  }));

  React.useEffect(() => {
    if (!prete) return;
    const d = JSON.stringify({ points, moi, bas, prochain: prochain ?? null, suite: suite ?? null, legende: !!legende });
    vue.current?.injectJavaScript(`window.maj&&window.maj(${d});true;`);
  }, [prete, points, moi, bas, prochain, suite, legende]);

  const message = (e: WebViewMessageEvent) => {
    try {
      const m = JSON.parse(e.nativeEvent.data) as { type: string; ref?: string };
      if (m.type === 'prete') setPrete(true);
      else if (m.type === 'arret' && m.ref) onArret?.(m.ref);
    } catch { /* message étranger */ }
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <WebView
        key={sombre ? 'sombre' : 'clair'}
        ref={vue}
        originWhitelist={['*']}
        source={{ html }}
        onMessage={message}
        onLoadStart={() => setPrete(false)}
        style={{ backgroundColor: sombre ? '#1B2340' : '#EDF1E8' }}
        scrollEnabled={false}
        overScrollMode="never"
        setSupportMultipleWindows={false}
        cacheEnabled
        testID="carte-journee"
      />
    </View>
  );
});
