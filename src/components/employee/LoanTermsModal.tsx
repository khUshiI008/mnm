import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Button from '../Button';
import { colors, radius, spacing } from '../../theme';

const E = colors.emp;

type Lang = 'en' | 'hi' | 'pa';

const LANG_LABEL: Record<Lang, string> = { en: 'English', hi: 'हिंदी', pa: 'ਪੰਜਾਬੀ' };

const TERMS: Record<Lang, { heading: string; points: string[] }> = {
  en: {
    heading: 'Loan Terms & Conditions',
    points: [
      'The loan is provided to employees interest-free.',
      'Each installment (EMI) must be at least 10% of the loan amount. If you need a smaller installment, please contact admin directly.',
      'Loan instalments must be repaid on time as per the agreed schedule.',
      'Before leaving the company, the employee must clear the complete outstanding loan amount.',
      'If the employee leaves without informing the company or fails to repay the loan, the outstanding amount will remain legally recoverable.',
      'Interest may be applicable on overdue/outstanding amounts as per agreed terms and applicable law.',
      'By accepting the loan, the employee agrees to these Terms & Conditions.',
    ],
  },
  hi: {
    heading: 'ऋण नियम एवं शर्तें',
    points: [
      'कर्मचारियों को ऋण बिना ब्याज के दिया जाता है।',
      'प्रत्येक किस्त (EMI) ऋण राशि का कम से कम 10% होनी चाहिए। छोटी किस्त के लिए कृपया सीधे एडमिन से संपर्क करें।',
      'ऋण की किस्तों का भुगतान तय समय के अनुसार समय पर करना अनिवार्य है।',
      'कंपनी छोड़ने से पहले कर्मचारी को पूरी बकाया ऋण राशि चुकानी होगी।',
      'बिना सूचना दिए कंपनी छोड़ने या ऋण न चुकाने पर बकाया राशि कानूनी रूप से वसूली योग्य रहेगी।',
      'भुगतान में देरी या बकाया राशि पर सहमत शर्तों एवं लागू कानून के अनुसार ब्याज लगाया जा सकता है।',
      'ऋण स्वीकार करने पर कर्मचारी इन नियमों एवं शर्तों से सहमत माना जाएगा।',
    ],
  },
  pa: {
    heading: 'ਲੋਨ ਨਿਯਮ ਅਤੇ ਸ਼ਰਤਾਂ',
    points: [
      'ਕਰਮਚਾਰੀਆਂ ਨੂੰ ਲੋਨ ਬਿਨਾਂ ਵਿਆਜ ਦਿੱਤਾ ਜਾਂਦਾ ਹੈ।',
      'ਹਰੇਕ ਕਿਸ਼ਤ (EMI) ਲੋਨ ਰਕਮ ਦਾ ਘੱਟੋ-ਘੱਟ 10% ਹੋਣੀ ਚਾਹੀਦੀ ਹੈ। ਛੋਟੀ ਕਿਸ਼ਤ ਲਈ ਕਿਰਪਾ ਕਰਕੇ ਸਿੱਧੇ ਐਡਮਿਨ ਨਾਲ ਸੰਪਰਕ ਕਰੋ।',
      'ਲੋਨ ਦੀਆਂ ਕਿਸ਼ਤਾਂ ਤੈਅ ਸਮਾਂ-ਸਾਰਣੀ ਅਨੁਸਾਰ ਸਮੇਂ ਸਿਰ ਭਰਨੀਆਂ ਲਾਜ਼ਮੀ ਹਨ।',
      'ਕੰਪਨੀ ਛੱਡਣ ਤੋਂ ਪਹਿਲਾਂ ਕਰਮਚਾਰੀ ਨੂੰ ਲੋਨ ਦੀ ਪੂਰੀ ਬਕਾਇਆ ਰਕਮ ਅਦਾ ਕਰਨੀ ਹੋਵੇਗੀ।',
      'ਬਿਨਾਂ ਸੂਚਨਾ ਦਿੱਤੇ ਕੰਪਨੀ ਛੱਡਣ ਜਾਂ ਲੋਨ ਦੀ ਅਦਾਇਗੀ ਨਾ ਕਰਨ ਦੀ ਸਥਿਤੀ ਵਿੱਚ ਬਕਾਇਆ ਰਕਮ ਕਾਨੂੰਨੀ ਤੌਰ ’ਤੇ ਵਸੂਲਯੋਗ ਰਹੇਗੀ।',
      'ਦੇਰੀ ਨਾਲ ਭੁਗਤਾਨ ਜਾਂ ਬਕਾਇਆ ਰਕਮ ’ਤੇ ਸਹਿਮਤ ਸ਼ਰਤਾਂ ਅਤੇ ਲਾਗੂ ਕਾਨੂੰਨ ਅਨੁਸਾਰ ਵਿਆਜ ਲੱਗ ਸਕਦਾ ਹੈ।',
      'ਲੋਨ ਸਵੀਕਾਰ ਕਰਨ ਨਾਲ ਕਰਮਚਾਰੀ ਇਨ੍ਹਾਂ ਨਿਯਮਾਂ ਅਤੇ ਸ਼ਰਤਾਂ ਨਾਲ ਸਹਿਮਤ ਮੰਨਿਆ ਜਾਵੇਗਾ।',
    ],
  },
};

/**
 * Gates loan submission behind an explicit read + agree — RequestLoanScreen
 * only calls onAgree (which carries the language the employee read it in,
 * stored server-side as TermsLanguage) once they've scrolled to this and
 * tapped Agree; closing without agreeing leaves the request unsubmitted.
 */
export default function LoanTermsModal({ visible, onClose, onAgree }: { visible: boolean; onClose: () => void; onAgree: (lang: Lang) => void }) {
  const [lang, setLang] = useState<Lang>('en');
  const t = TERMS[lang];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.box} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{t.heading}</Text>

          <View style={styles.langRow}>
            {(Object.keys(LANG_LABEL) as Lang[]).map((l) => (
              <Pressable key={l} style={[styles.langChip, lang === l && styles.langChipActive]} onPress={() => setLang(l)}>
                <Text style={[styles.langChipText, lang === l && styles.langChipTextActive]}>{LANG_LABEL[l]}</Text>
              </Pressable>
            ))}
          </View>

          <ScrollView style={styles.pointsScroll} showsVerticalScrollIndicator={false}>
            {t.points.map((p, i) => (
              <View key={i} style={styles.pointRow}>
                <Text style={styles.pointNumber}>{i + 1}.</Text>
                <Text style={styles.pointText}>{p}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.actions}>
            <Button title="Close" variant="outline" onPress={onClose} style={{ flex: 1 }} />
            <Button title="I Agree" onPress={() => onAgree(lang)} style={{ flex: 1 }} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,13,35,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing(3) },
  box: { width: '100%', maxHeight: '85%', backgroundColor: E.surface, borderRadius: radius.md, padding: spacing(2.5) },
  title: { fontSize: 16, fontWeight: '800', color: E.ink, marginBottom: spacing(1.5) },
  langRow: { flexDirection: 'row', gap: 8, marginBottom: spacing(1.5) },
  langChip: { flex: 1, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: E.border, alignItems: 'center' },
  langChipActive: { backgroundColor: E.primary, borderColor: E.primary },
  langChipText: { fontSize: 12.5, fontWeight: '700', color: E.muted },
  langChipTextActive: { color: '#fff' },
  pointsScroll: { marginBottom: spacing(2) },
  pointRow: { flexDirection: 'row', marginBottom: spacing(1.25), gap: 6 },
  pointNumber: { fontSize: 13.5, fontWeight: '800', color: E.primary, width: 18 },
  pointText: { flex: 1, fontSize: 13.5, color: E.ink, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 10 },
});
