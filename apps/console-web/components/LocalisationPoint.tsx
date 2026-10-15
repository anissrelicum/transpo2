'use client';
import * as React from 'react';
import { Box, Flex, Text, TextField, Button, Callout, Code, Link as RLink, Spinner } from '@radix-ui/themes';
import {
  SewingPinFilledIcon, Link2Icon, CheckCircledIcon, ExclamationTriangleIcon, CrossCircledIcon, ReloadIcon,
} from '@radix-ui/react-icons';
import { CITY_COORDS, haversineMeters } from '@transpo/domain';
import type { Lang } from '@transpo/i18n';
import type { ResolvedMapLink, MapLinkErrorCode } from '@transpo/api-client';
import { Map } from './Map';

/**
 * Localisation d'un point de course : position (WGS84) + lien de carte d'origine.
 * `mapUrl` null = épingle posée à la main : l'API génère alors un lien Google Maps.
 */
export type Localisation = {
  lat: number; lng: number; mapUrl: string | null;
  source?: ResolvedMapLink['source']; approx?: boolean;
};

const T = {
  fr: {
    title: 'Localisation',
    hint: 'Collez le lien envoyé par le client (WhatsApp, SMS…) ou cliquez sur la carte pour placer l’épingle.',
    placeholder: 'Coller un lien de localisation (Google Maps, WhatsApp, Waze…)',
    locate: 'Localiser', locating: 'Recherche…', clear: 'Effacer la localisation',
    kept: 'Lien conservé — envoyé au livreur',
    generated: 'Position placée à la main — un lien Google Maps sera envoyé au livreur',
    approx: 'Position approximative : vérifiez l’épingle et déplacez-la si besoin.',
    detected: 'Adresse détectée :', useAddress: 'Utiliser cette adresse', used: 'Adresse reprise',
    dragHint: 'Glissez l’épingle pour l’ajuster.',
    mapLabel: 'Carte — cliquez pour placer l’épingle',
    pinLabel: { retrait: 'Point de retrait', livraison: 'Point de livraison' },
    err: {
      LIEN_VIDE: 'Collez un lien de localisation ou des coordonnées.',
      LIEN_NON_RECONNU: 'Lien non reconnu : aucune position trouvée. Collez un lien Google Maps, Waze, Plans ou OpenStreetMap, ou des coordonnées (ex. 33.5731, -7.5898).',
      SANS_COORDONNEES: 'Lien non reconnu : la page ne donne aucune position. Placez l’épingle sur la carte.',
      HOTE_REFUSE: 'Lien refusé : seuls Google Maps, Plans, Waze et OpenStreetMap sont pris en charge.',
      LIEN_EXPIRE: 'Lien expiré ou supprimé : demandez au client de renvoyer sa position.',
      INJOIGNABLE: 'Lien injoignable pour le moment : réessayez, ou placez l’épingle sur la carte.',
    } as Record<MapLinkErrorCode, string>,
    errGeneric: 'Localisation impossible pour le moment : réessayez, ou placez l’épingle sur la carte.',
  },
  ar: {
    title: 'الموقع',
    hint: 'الصقوا الرابط الذي أرسله العميل (واتساب، رسالة…) أو انقروا على الخريطة لوضع الدبوس.',
    placeholder: 'ألصقوا رابط الموقع (خرائط Google، واتساب، Waze…)',
    locate: 'تحديد الموقع', locating: 'جارٍ البحث…', clear: 'مسح الموقع',
    kept: 'تم الاحتفاظ بالرابط — يُرسل إلى السائق',
    generated: 'تم وضع الموقع يدوياً — سيُرسل رابط خرائط Google إلى السائق',
    approx: 'موقع تقريبي: تحققوا من الدبوس وحرّكوه عند الحاجة.',
    detected: 'العنوان المكتشف:', useAddress: 'استعمال هذا العنوان', used: 'تم أخذ العنوان',
    dragHint: 'اسحبوا الدبوس لضبطه.',
    mapLabel: 'الخريطة — انقروا لوضع الدبوس',
    pinLabel: { retrait: 'نقطة الاستلام', livraison: 'نقطة التسليم' },
    err: {
      LIEN_VIDE: 'ألصقوا رابط موقع أو إحداثيات.',
      LIEN_NON_RECONNU: 'رابط غير معروف: لم يُعثر على أي موقع. ألصقوا رابط خرائط Google أو Waze أو Plans أو OpenStreetMap، أو إحداثيات (مثال 33.5731, -7.5898).',
      SANS_COORDONNEES: 'رابط غير معروف: الصفحة لا تتضمن أي موقع. ضعوا الدبوس على الخريطة.',
      HOTE_REFUSE: 'رابط مرفوض: خرائط Google وPlans وWaze وOpenStreetMap فقط مدعومة.',
      LIEN_EXPIRE: 'الرابط منتهي الصلاحية أو محذوف: اطلبوا من العميل إعادة إرسال موقعه.',
      INJOIGNABLE: 'تعذّر الوصول إلى الرابط حالياً: أعيدوا المحاولة أو ضعوا الدبوس على الخريطة.',
    } as Record<MapLinkErrorCode, string>,
    errGeneric: 'تعذّر تحديد الموقع حالياً: أعيدوا المحاولة أو ضعوا الدبوس على الخريطة.',
  },
} as const;

type Reponse = { ok: true; data: ResolvedMapLink } | { ok: false; code: MapLinkErrorCode | null };

/** Appel BFF → `POST /v1/geo/resolve-link` (JWT porté par le proxy). */
async function resoudre(texte: string, lang: Lang): Promise<Reponse> {
  try {
    const r = await fetch('/api/proxy/v1/geo/resolve-link', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: texte, lang }),
    });
    const d = await r.json().catch(() => null);
    if (r.ok && d && typeof d.lat === 'number') return { ok: true, data: d as ResolvedMapLink };
    return { ok: false, code: (d?.code as MapLinkErrorCode) ?? null };
  } catch {
    return { ok: false, code: 'INJOIGNABLE' };
  }
}

/** Ville du référentiel la plus proche (≤ 35 km), pour aligner le sélecteur de ville. */
export function villeProche(lat: number, lng: number): string | null {
  let best: { ville: string; m: number } | null = null;
  for (const [ville, [la, lo]] of Object.entries(CITY_COORDS)) {
    const m = haversineMeters(lat, lng, la, lo);
    if (!best || m < best.m) best = { ville, m };
  }
  return best && best.m <= 35_000 ? best.ville : null;
}

const coordTxt = (lat: number, lng: number) => `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

export function LocalisationPoint({
  which, lang, city, value, onChange, address, onAddress, onCity,
}: {
  which: 'retrait' | 'livraison'; lang: Lang; city: string;
  value: Localisation | null; onChange: (v: Localisation | null) => void;
  /** Adresse texte actuelle du point : remplie automatiquement si elle est vide. */
  address: string; onAddress: (a: string) => void; onCity: (c: string) => void;
}) {
  const t = T[lang === 'ar' ? 'ar' : 'fr'];
  const [texte, setTexte] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [erreur, setErreur] = React.useState<string | null>(null);
  const [adresse, setAdresse] = React.useState<string | null>(null);
  const testId = (s: string) => `loc-${which}-${s}`;
  // La dernière demande l'emporte : un collage puis un clic rapide ne doivent pas
  // laisser une réponse tardive écraser la plus récente.
  const jeton = React.useRef(0);

  function appliquerAdresse(a: string | null | undefined) {
    setAdresse(a ?? null);
    // Une épingle sans texte est acceptée : l'adresse détectée remplit le champ s'il est
    // vide. Un texte déjà saisi n'est jamais écrasé sans geste explicite.
    if (a && !address.trim()) onAddress(a);
  }

  async function lier(brut: string) {
    const v = brut.trim();
    if (!v) { setErreur(t.err.LIEN_VIDE); return; }
    const n = ++jeton.current;
    setBusy(true); setErreur(null);
    const r = await resoudre(v, lang);
    if (n !== jeton.current) return;
    setBusy(false);
    if (!r.ok) { setErreur((r.code && t.err[r.code]) || t.errGeneric); return; }
    const d = r.data;
    onChange({
      lat: d.lat, lng: d.lng, mapUrl: d.url, source: d.source,
      approx: d.precision === 'vue' || d.via === 'geocodage',
    });
    const v2 = villeProche(d.lat, d.lng);
    if (v2 && v2 !== city) onCity(v2);
    appliquerAdresse(d.adresse);
  }

  /** Épingle posée ou déplacée à la main : le lien d'origine ne correspond plus. */
  async function placer(lat: number, lng: number) {
    onChange({ lat, lng, mapUrl: null });
    setErreur(null);
    const v2 = villeProche(lat, lng);
    if (v2 && v2 !== city) onCity(v2);
    // Adresse du nouveau point (best-effort) : même endpoint, avec des coordonnées brutes.
    const n = ++jeton.current;
    const r = await resoudre(`${lat.toFixed(6)}, ${lng.toFixed(6)}`, lang);
    if (n !== jeton.current) return;
    setAdresse(r.ok ? r.data.adresse ?? null : null);
  }

  function effacer() {
    jeton.current++;
    onChange(null); setTexte(''); setErreur(null); setAdresse(null); setBusy(false);
  }

  const centreVille = CITY_COORDS[city] ?? CITY_COORDS.Casablanca;
  const focus: [number, number] = value ? [value.lat, value.lng] : centreVille;

  return (
    <Box data-testid={testId('block')}>
      <Flex align="center" gap="2" mb="1">
        <SewingPinFilledIcon color="var(--indigo-11)" />
        <Text size="2" weight="bold">{t.title}</Text>
      </Flex>
      <Text as="p" size="1" color="gray" mb="2">{t.hint}</Text>

      <Flex gap="2" align="start" wrap="wrap">
        <Box style={{ flex: '1 1 260px' }}>
          <TextField.Root
            data-testid={testId('input')}
            aria-label={t.placeholder}
            placeholder={t.placeholder}
            value={texte}
            // Un lien se lit de gauche à droite, même dans une interface arabe : sans cela
            // l'algorithme bidi en réordonne les segments (« /place/…@33.58,-7.63 »).
            dir={texte ? 'ltr' : undefined}
            size="2"
            onChange={(e) => setTexte(e.target.value)}
            // Collage = geste principal : on résout aussitôt, sans clic de plus.
            onPaste={(e) => {
              const colle = e.clipboardData.getData('text');
              if (colle.trim()) { e.preventDefault(); setTexte(colle.trim()); void lier(colle); }
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void lier(texte); } }}
          >
            <TextField.Slot><Link2Icon /></TextField.Slot>
          </TextField.Root>
        </Box>
        <Button data-testid={testId('locate')} variant="soft" disabled={busy} onClick={() => lier(texte)} style={{ minHeight: 32 }}>
          {busy ? <Spinner /> : <ReloadIcon />} {busy ? t.locating : t.locate}
        </Button>
      </Flex>

      {erreur && (
        <Callout.Root data-testid={testId('error')} color="red" size="1" mt="2" role="alert">
          <Callout.Icon><CrossCircledIcon /></Callout.Icon>
          <Callout.Text>{erreur}</Callout.Text>
        </Callout.Root>
      )}

      <Box
        mt="3"
        aria-label={t.mapLabel}
        style={{ position: 'relative', height: 260, borderRadius: 'var(--radius-3)', overflow: 'hidden', border: '1px solid var(--gray-a5)' }}
      >
        <Map
          center={focus}
          zoom={value ? 16 : 12}
          focus={focus}
          focusZoom={value ? 16 : 12}
          onMapClick={(lat, lng) => { void placer(lat, lng); }}
          markers={value ? [{
            id: which, kind: 'order', lat: value.lat, lng: value.lng,
            color: which === 'retrait' ? 'orange' : 'indigo',
            label: t.pinLabel[which], sub: coordTxt(value.lat, value.lng),
            draggable: true, onDragEnd: (lat, lng) => { void placer(lat, lng); },
          }] : []}
        />
      </Box>

      {value && (
        <Flex direction="column" gap="2" mt="2">
          <Flex justify="between" align="center" gap="2" wrap="wrap">
            <Text size="1" color="gray">
              <Code variant="ghost" dir="ltr" style={{ unicodeBidi: 'isolate' }} data-testid={testId('coords')}>{coordTxt(value.lat, value.lng)}</Code> · {t.dragHint}
            </Text>
            <Button data-testid={testId('clear')} size="1" variant="ghost" color="gray" onClick={effacer}>
              <CrossCircledIcon /> {t.clear}
            </Button>
          </Flex>

          <Callout.Root data-testid={testId('kept')} color={value.mapUrl ? 'green' : 'gray'} size="1" variant="surface">
            <Callout.Icon><CheckCircledIcon /></Callout.Icon>
            <Callout.Text>
              {value.mapUrl ? (
                <>
                  <strong>{t.kept}</strong>{' · '}
                  <RLink href={value.mapUrl} target="_blank" rel="noopener noreferrer" size="1"
                    style={{ wordBreak: 'break-all', unicodeBidi: 'isolate' }} dir="ltr">
                    {value.mapUrl.length > 64 ? `${value.mapUrl.slice(0, 64)}…` : value.mapUrl}
                  </RLink>
                </>
              ) : t.generated}
            </Callout.Text>
          </Callout.Root>

          {value.approx && (
            <Callout.Root color="amber" size="1" variant="surface" data-testid={testId('approx')}>
              <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
              <Callout.Text>{t.approx}</Callout.Text>
            </Callout.Root>
          )}

          {adresse && (
            <Flex align="center" gap="2" wrap="wrap" data-testid={testId('address')}>
              <Text size="2"><Text color="gray">{t.detected}</Text> {adresse}</Text>
              <Text color="gray">—</Text>
              {address.trim() === adresse.trim()
                ? <Text size="1" color="green"><CheckCircledIcon style={{ verticalAlign: 'middle' }} /> {t.used}</Text>
                : <Button data-testid={testId('use-address')} size="1" variant="soft" onClick={() => onAddress(adresse)}>{t.useAddress}</Button>}
            </Flex>
          )}
        </Flex>
      )}
    </Box>
  );
}
