import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Button from '../../components/Button';
import { colors, radius, shadow, spacing } from '../../theme';
import { getTheme, resetTheme, saveTheme, ThemePreset, ThemeValues } from '../../api/adminThemeApi';

const A = colors.admin;
const FONTS = ['Inter', 'Poppins', 'Roboto', 'DM Sans', 'Nunito', 'Outfit'];
const DENSITIES: { value: string; label: string }[] = [
  { value: 'compact', label: 'Compact' },
  { value: 'normal', label: 'Normal' },
  { value: 'comfortable', label: 'Comfortable' },
];

const COLOR_FIELDS: { key: keyof ThemeValues; label: string; sub: string }[] = [
  { key: 'primary', label: 'Primary', sub: 'Buttons, active nav, links' },
  { key: 'primary_dark', label: 'Primary Dark', sub: 'Hover & pressed states' },
  { key: 'accent', label: 'Accent', sub: 'Highlights & badges' },
  { key: 'sidebar_bg', label: 'Sidebar Top', sub: 'Sidebar gradient start colour' },
  { key: 'sidebar_bg_light', label: 'Sidebar Bottom', sub: 'Sidebar gradient end colour' },
  { key: 'page_bg', label: 'Page Background', sub: 'Main content area background' },
  { key: 'surface_bg', label: 'Card Surface', sub: 'Cards, panels, modals' },
  { key: 'text_color', label: 'Text Colour', sub: 'Primary body text' },
  { key: 'border_color', label: 'Border Colour', sub: 'Dividers, input borders, outlines' },
];

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

export default function ThemeStudioScreen() {
  const [theme, setTheme] = useState<ThemeValues | null>(null);
  const [presets, setPresets] = useState<ThemePreset[]>([]);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const load = async () => {
    const res = await getTheme();
    setTheme(res.data.theme);
    setPresets(res.data.presets);
  };

  useEffect(() => {
    load();
  }, []);

  if (!theme) {
    return (
      <View style={styles.screen}>
        <Text style={styles.loadingText}>Loading theme…</Text>
      </View>
    );
  }

  const set = (key: keyof ThemeValues, value: string) => setTheme((t) => (t ? { ...t, [key]: value } : t));

  const applyPreset = (p: ThemePreset) => {
    setTheme((t) =>
      t
        ? {
            ...t,
            primary: p.primary,
            primary_dark: p.primaryDark,
            accent: p.accent,
            sidebar_bg: p.sidebarBg,
            sidebar_bg_light: p.sidebarBgLight,
            page_bg: p.pageBg,
            surface_bg: p.surfaceBg,
            text_color: p.textColor,
            border_color: p.borderColor,
          }
        : t
    );
  };

  const handleSave = async () => {
    for (const f of COLOR_FIELDS) {
      if (!HEX_RE.test(theme[f.key])) {
        Alert.alert('Invalid colour', `${f.label} must be a valid #rrggbb hex colour.`);
        return;
      }
    }
    setSaving(true);
    try {
      const res = await saveTheme(theme);
      setTheme(res.data.theme);
      Alert.alert('Saved', res.data.message);
    } catch (err: any) {
      Alert.alert('Could not save', err?.response?.data?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    Alert.alert('Reset theme?', 'This restores all factory default colours, fonts and layout settings.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          setResetting(true);
          try {
            const res = await resetTheme();
            setTheme(res.data.theme);
            Alert.alert('Done', res.data.message);
          } catch (err: any) {
            Alert.alert('Could not reset', err?.response?.data?.message || 'Please try again.');
          } finally {
            setResetting(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Palette Library</Text>
          <Text style={styles.cardSub}>Tap a palette to apply its colours below, then Save to publish.</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.paletteScroll} contentContainerStyle={styles.paletteScrollContent}>
            {presets.map((p) => (
              <Pressable key={p.tag} style={styles.paletteCard} onPress={() => applyPreset(p)}>
                <View style={styles.paletteSwatch}>
                  <View style={[styles.swatchSeg, { backgroundColor: p.primary }]} />
                  <View style={[styles.swatchSeg, { backgroundColor: p.sidebarBg }]} />
                  <View style={[styles.swatchSeg, { backgroundColor: p.accent }]} />
                </View>
                <Text style={styles.paletteName}>{p.name}</Text>
                <Text style={styles.paletteContrast}>{p.contrast}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Colours</Text>
          {COLOR_FIELDS.map((f) => (
            <View key={f.key} style={styles.colorRow}>
              <View style={[styles.swatch, { backgroundColor: HEX_RE.test(theme[f.key]) ? theme[f.key] : '#ccc' }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.colorLabel}>{f.label}</Text>
                <Text style={styles.colorSub}>{f.sub}</Text>
              </View>
              <TextInput style={styles.hexInput} value={theme[f.key]} onChangeText={(v) => set(f.key, v)} autoCapitalize="characters" maxLength={7} />
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Typography</Text>
          <View style={styles.chipRow}>
            {FONTS.map((f) => (
              <Pressable key={f} onPress={() => set('font_family', f)} style={[styles.chip, theme.font_family === f && styles.chipActive]}>
                <Text style={[styles.chipText, theme.font_family === f && styles.chipTextActive]}>{f}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.numRow}>
            <NumField label="Font Size (12-18px)" value={theme.font_size} onChange={(v) => set('font_size', v)} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Layout</Text>
          <View style={styles.numRow}>
            <NumField label="Sidebar Width (200-320px)" value={theme.sidebar_width} onChange={(v) => set('sidebar_width', v)} />
          </View>
          <View style={styles.numRow}>
            <NumField label="Card Radius (0-20px)" value={theme.card_radius} onChange={(v) => set('card_radius', v)} />
            <NumField label="Button Radius (0-20px)" value={theme.btn_radius} onChange={(v) => set('btn_radius', v)} />
          </View>
          <Text style={styles.subLabel}>Table Density</Text>
          <View style={styles.chipRow}>
            {DENSITIES.map((d) => (
              <Pressable key={d.value} onPress={() => set('table_density', d.value)} style={[styles.chip, theme.table_density === d.value && styles.chipActive]}>
                <Text style={[styles.chipText, theme.table_density === d.value && styles.chipTextActive]}>{d.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Brand</Text>
          <Text style={styles.subLabel}>Logo Text</Text>
          <TextInput style={styles.textInput} value={theme.logo_text} onChangeText={(v) => set('logo_text', v)} maxLength={50} />
          <Text style={[styles.subLabel, { marginTop: 10 }]}>Logo Initials</Text>
          <TextInput style={styles.textInput} value={theme.logo_initials} onChangeText={(v) => set('logo_initials', v)} maxLength={3} autoCapitalize="characters" />
        </View>

        <View style={styles.actions}>
          <Button title="Reset to Defaults" variant="outline" onPress={handleReset} loading={resetting} style={{ flex: 1 }} />
          <Button title={saving ? 'Saving…' : 'Save Theme'} onPress={handleSave} loading={saving} style={{ flex: 1 }} />
        </View>
      </ScrollView>
    </View>
  );
}

function NumField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.subLabel}>{label}</Text>
      <TextInput style={styles.textInput} value={value} onChangeText={onChange} keyboardType="number-pad" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: A.bg },
  content: { padding: spacing(2), paddingBottom: spacing(5) },
  loadingText: { fontSize: 13, color: A.muted, textAlign: 'center', marginTop: 40 },

  card: { backgroundColor: A.surface, borderRadius: radius.md, padding: 14, marginBottom: 14, ...shadow.card },
  cardTitle: { fontSize: 14, fontWeight: '800', color: A.ink, marginBottom: 4 },
  cardSub: { fontSize: 11, color: A.muted, marginBottom: 10 },

  paletteScroll: { flexGrow: 0, flexShrink: 0 },
  paletteScrollContent: { alignItems: 'center' },
  paletteCard: { width: 130, backgroundColor: A.surfaceRaised, borderRadius: radius.sm, padding: 10, marginRight: 8 },
  paletteSwatch: { flexDirection: 'row', height: 28, borderRadius: 6, overflow: 'hidden', marginBottom: 6 },
  swatchSeg: { flex: 1 },
  paletteName: { fontSize: 11, fontWeight: '700', color: A.ink },
  paletteContrast: { fontSize: 9, color: A.muted, marginTop: 2 },

  colorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: A.border },
  swatch: { width: 28, height: 28, borderRadius: 8, borderWidth: 1, borderColor: A.border },
  colorLabel: { fontSize: 12, fontWeight: '700', color: A.ink },
  colorSub: { fontSize: 10, color: A.muted, marginTop: 1 },
  hexInput: { width: 88, borderWidth: 1, borderColor: A.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, fontSize: 12, color: A.ink, fontFamily: 'monospace' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: A.surfaceRaised },
  chipActive: { backgroundColor: A.primary },
  chipText: { fontSize: 11, fontWeight: '700', color: A.muted },
  chipTextActive: { color: '#fff' },

  numRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  subLabel: { fontSize: 11, color: A.muted, fontWeight: '600', marginBottom: 4 },
  textInput: { borderWidth: 1, borderColor: A.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: A.ink },

  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
});
