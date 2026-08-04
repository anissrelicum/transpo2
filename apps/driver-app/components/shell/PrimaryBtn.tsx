// Action principale — cf. maquette (fonction PrimaryBtn) : pleine largeur, 52px.
import React from 'react';
import { Pressable, Text, ActivityIndicator, StyleSheet, type GestureResponderEvent } from 'react-native';
import { useTheme } from '../../lib/theme';
import { touch, radius } from '@transpo/design-tokens';

export interface PrimaryBtnProps {
  children: string;
  onPress?: (e: GestureResponderEvent) => void;
  disabled?: boolean;
  /** Affiche un spinner à la place du libellé (action en cours) au lieu de désactiver silencieusement. */
  loading?: boolean;
}

/** Bouton d'action principal, pleine largeur, hauteur 52px (constante structurante, cf. design/README.md). */
export function PrimaryBtn({ children, onPress, disabled, loading }: PrimaryBtnProps) {
  const { colors } = useTheme();
  const isDisabled = Boolean(disabled || loading);
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: colors.indigo9, opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1 },
      ]}
    >
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.label}>{children}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { width: '100%', height: touch.primary, borderRadius: radius[3], alignItems: 'center', justifyContent: 'center' },
  label: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
