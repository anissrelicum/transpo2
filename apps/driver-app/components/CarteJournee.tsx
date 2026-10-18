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

export type PointCarte = { ref: string; lat: number; lng: number; n: number; etat: 'prochain' | 'avenir' | 'fait' };

const CLE_CARTO =
  // Forme littérale obligatoire : Expo n'injecte EXPO_PUBLIC_* qu'écrit tel quel.
  process.env.EXPO_PUBLIC_CARTO_BASEMAPS_KEY ||
  ((Constants.expoConfig?.extra as any)?.cartoKey as string | undefined) ||
  '';

function page(sombre: boolean): string {
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
.moi{width:22px;height:22px;border-radius:50%;background:#3E5BDB;border:4px solid #fff;box-sizing:border-box;box-shadow:0 0 0 8px rgba(62,91,219,.22)}
</style></head><body><div id="c"></div><script>
var carte=L.map('c',{zoomControl:false,attributionControl:true}).setView([33.57,-7.59],12);
L.tileLayer('${fond}',{subdomains:'abcd',maxZoom:19,attribution:'${attribution}'}).addTo(carte);
var calque=L.layerGroup().addTo(carte),moi=null,dernierePos=null,bas=260,cles='';
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
  var trace=[];if(d.moi)trace.push([d.moi.lat,d.moi.lng]);
  d.points.forEach(function(p){
    if(p.etat!=='fait')trace.push([p.lat,p.lng]);
    var m=L.marker([p.lat,p.lng],{icon:L.divIcon({className:'',html:'<div class="ep '+p.etat+'"><b>'+p.n+'</b></div>',iconSize:[34,34],iconAnchor:[17,34]})});
    m.on('click',function(){envoyer({type:'arret',ref:p.ref});});
    calque.addLayer(m);
  });
  if(trace.length>1)calque.addLayer(L.polyline(trace,{color:'${sombre ? '#7B93FF' : '#3E5BDB'}',weight:5,opacity:.85,lineJoin:'round'}));
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
}>(function CarteJournee({ points, moi, sombre, bas, onArret }, ref) {
  const vue = React.useRef<WebView>(null);
  const [prete, setPrete] = React.useState(false);
  const html = React.useMemo(() => page(sombre), [sombre]);

  React.useImperativeHandle(ref, () => ({
    recadrer: () => vue.current?.injectJavaScript('window.recadrer&&window.recadrer();true;'),
  }));

  React.useEffect(() => {
    if (!prete) return;
    const d = JSON.stringify({ points, moi, bas });
    vue.current?.injectJavaScript(`window.maj&&window.maj(${d});true;`);
  }, [prete, points, moi, bas]);

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
