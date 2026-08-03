import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Capture des preuves de livraison. Deux contraintes commandent ce module :
 * l'API borne chaque artefact (~700 Ko encodés) et la file hors ligne les
 * persiste sur l'appareil — une photo brute de téléphone (3 à 8 Mo) est donc
 * redimensionnée et recompressée avant tout envoi.
 */

const MAX_CHARS = 700_000;
const STEPS: { width: number; compress: number }[] = [
  { width: 1280, compress: 0.6 },
  { width: 1024, compress: 0.5 },
  { width: 800, compress: 0.4 },
];

export type PhotoResult = { uri: string } | { error: string };

async function encode(uri: string, width: number, compress: number): Promise<string> {
  const out = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width } }],
    { compress, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );
  return `data:image/jpeg;base64,${out.base64 ?? ''}`;
}

/** Ouvre l'appareil photo et renvoie un data URI JPEG sous la borne de taille. */
export async function capturePhoto(): Promise<PhotoResult> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    return { error: 'Accès à l’appareil photo refusé. Autorisez-le dans les réglages du téléphone.' };
  }
  const shot = await ImagePicker.launchCameraAsync({ quality: 1, exif: false });
  if (shot.canceled || !shot.assets?.[0]) return { error: '' }; // annulation : pas une erreur

  const source = shot.assets[0].uri;
  // Paliers dégressifs : on s'arrête au premier qui tient sous la borne.
  for (const step of STEPS) {
    const uri = await encode(source, step.width, step.compress);
    if (uri.length <= MAX_CHARS) return { uri };
  }
  return { error: 'Photo trop lourde même après compression. Reprenez-la de plus loin.' };
}

// La sérialisation de la signature vit à part (sans dépendance native, donc testable).
export { signatureToDataUri, isSignatureMeaningful, type Point } from './signature';
