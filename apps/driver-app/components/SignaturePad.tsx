import * as React from 'react';
import { View, Text, Pressable, StyleSheet, PanResponder, LayoutChangeEvent } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { strokePath, type Point } from '../lib/signature';
import { C } from '../lib/theme';

/**
 * Pavé de signature au doigt. Les traits sont conservés en coordonnées de la
 * zone de dessin puis sérialisés en SVG (cf. lib/proof) — pas de capture
 * d'écran, donc pas de module natif de rastérisation.
 */
export function SignaturePad({ strokes, onChange, height = 180 }: {
  strokes: Point[][];
  onChange: (strokes: Point[][]) => void;
  height?: number;
}) {
  const [width, setWidth] = React.useState(0);
  // Le PanResponder est créé une fois : il lit l'état courant via des refs pour
  // éviter de capturer une closure périmée à chaque rendu.
  const strokesRef = React.useRef(strokes);
  strokesRef.current = strokes;
  const current = React.useRef<Point[]>([]);
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  const responder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          current.current = [{ x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }];
          onChangeRef.current([...strokesRef.current, current.current]);
        },
        onPanResponderMove: (e) => {
          current.current = [...current.current, { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }];
          const others = strokesRef.current.slice(0, -1);
          onChangeRef.current([...others, current.current]);
        },
        onPanResponderRelease: () => { current.current = []; },
      }),
    [],
  );

  function measure(e: LayoutChangeEvent) { setWidth(e.nativeEvent.layout.width); }

  return (
    <View>
      <View style={s.head}>
        <Text style={s.label}>Signature du destinataire</Text>
        {strokes.length > 0 && (
          <Pressable onPress={() => onChange([])} hitSlop={10}>
            <Text style={s.clear}>Effacer</Text>
          </Pressable>
        )}
      </View>
      <View style={[s.pad, { height }]} onLayout={measure} {...responder.panHandlers}>
        {width > 0 && (
          <Svg width={width} height={height}>
            <Rect width={width} height={height} fill="#fff" />
            {strokes.map((stroke, i) =>
              stroke.length > 1 ? (
                <Path key={i} d={strokePath(stroke)} stroke="#141E3C" strokeWidth={2.5}
                  strokeLinecap="round" strokeLinejoin="round" fill="none" />
              ) : null,
            )}
          </Svg>
        )}
        {strokes.length === 0 && <Text style={s.hint}>Faites signer ici</Text>}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  label: { fontSize: 13, fontWeight: '600', color: C.text },
  clear: { fontSize: 13, color: C.muted, fontWeight: '600' },
  pad: {
    borderWidth: 1, borderColor: C.border, borderRadius: 10, backgroundColor: '#fff',
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
  },
  hint: { position: 'absolute', color: C.muted, fontSize: 13 },
});
