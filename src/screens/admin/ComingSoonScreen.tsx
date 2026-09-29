import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../../theme';
import { AdminModule } from '../../navigation/adminModules';

export default function ComingSoonScreen({ module }: { module?: AdminModule }) {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{module?.title || 'Module'}</Text>
      <Text style={styles.body}>
        Not built yet. This maps to {module?.source ?? 'a .NET admin page'} in the original app — see
        backend/MODELS_TODO.md for what porting it needs.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing(3), alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: spacing(1) },
  body: { color: colors.textMuted, textAlign: 'center' },
});
