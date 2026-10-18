// Prise de la photo de preuve DANS l'app (expo-camera), sans ouvrir l'appareil photo du
// téléphone : l'aller-retour vers l'appli externe ne revenait jamais sur certains Android
// (la preuve restait sur « Ouverture… »), et il fait perdre l'écran au livreur.
import * as React from 'react';
import { View, Text, Pressable, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { compresser } from '../lib/proof';
import { Bouton, MARQUE } from './ui';

const T = {
  fr: { cadrer: 'Cadrez le colis remis', annuler: 'Annuler', permission: 'L’appareil photo est nécessaire pour la preuve.', autoriser: 'Autoriser' },
  ar: { cadrer: 'صوّر الطرد المسلَّم', annuler: 'إلغاء', permission: 'الكاميرا ضرورية للإثبات.', autoriser: 'السماح' },
};

export function PrisePhoto({ visible, lang, onPhoto, onFermer, onErreur }: {
  visible: boolean; lang: 'fr' | 'ar';
  onPhoto: (dataUri: string) => void; onFermer: () => void; onErreur: (message: string) => void;
}) {
  const t = T[lang];
  const insets = useSafeAreaInsets();
  const camera = React.useRef<CameraView>(null);
  const [permission, demander] = useCameraPermissions();
  const [prete, setPrete] = React.useState(false);
  const [occupe, setOccupe] = React.useState(false);

  async function declencher() {
    if (!camera.current || occupe) return;
    setOccupe(true);
    try {
      const pris = await camera.current.takePictureAsync({ quality: 0.7, skipProcessing: true });
      if (!pris?.uri) return;
      const r = await compresser(pris.uri);
      if ('uri' in r) onPhoto(r.uri); else onErreur(r.error);
    } catch (e) {
      onErreur(String(e));
    } finally {
      setOccupe(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onFermer} onShow={() => setPrete(false)}>
      <View style={s.plein}>
        {permission?.granted ? (
          <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" onCameraReady={() => setPrete(true)} />
        ) : (
          <View style={[StyleSheet.absoluteFill, s.centre]}>
            <Text style={{ color: '#fff', textAlign: 'center', marginBottom: 12 }}>{t.permission}</Text>
            <Bouton variante="marque" petit onPress={() => void demander()}>{t.autoriser}</Bouton>
          </View>
        )}
        <Text style={[s.consigne, { top: insets.top + 16 }]}>{t.cadrer}</Text>
        <View style={[s.bas, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <Pressable onPress={onFermer} accessibilityRole="button" style={s.annuler}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>{t.annuler}</Text>
          </Pressable>
          <Pressable testID="declencheur" onPress={declencher} disabled={!prete || occupe} accessibilityRole="button" accessibilityLabel="Photo"
            style={[s.declencheur, { opacity: prete ? 1 : 0.5 }]}>
            {occupe ? <ActivityIndicator color={MARQUE.navy} /> : <View style={s.rond} />}
          </Pressable>
          <View style={s.annuler} />
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  plein: { flex: 1, backgroundColor: '#000' },
  centre: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  consigne: { position: 'absolute', left: 0, right: 0, textAlign: 'center', color: '#fff', fontSize: 16, fontWeight: '600' },
  bas: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 20, backgroundColor: 'rgba(0,0,0,0.35)' },
  annuler: { width: 90, minHeight: 48, justifyContent: 'center' },
  declencheur: { width: 78, height: 78, borderRadius: 39, borderWidth: 5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  rond: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#fff' },
});
