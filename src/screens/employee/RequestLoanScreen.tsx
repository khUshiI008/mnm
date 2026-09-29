import React, { useRef, useState } from 'react';
import { Alert, Image, PermissionsAndroid, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import SignatureScreen, { SignatureViewRef } from 'react-native-signature-canvas';
import Card from '../../components/Card';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import Icon from '../../components/Icon';
import LoanTermsModal from '../../components/employee/LoanTermsModal';
import { colors, radius, spacing } from '../../theme';
import { submitLoanRequest } from '../../api/employeeLoanRequestApi';

const E = colors.emp;

// Same footer/border strip as ProfileScreen's KYC signature pad — kept
// identical so both signature pads look and behave the same way.
const SIGNATURE_WEB_STYLE = `
  .m-signature-pad--footer { display: none; margin: 0; }
  .m-signature-pad--body { border: none; }
  .m-signature-pad { box-shadow: none; border: none; }
  body,html { background-color: #fff; }
`;

// 10% of the requested amount is the smallest installment the employee can
// choose for themselves — anything less needs an admin-approved exception
// (see LoanTermsModal's terms point about this). Deliberately never shown
// as a hint/placeholder ahead of time — an employee who could genuinely
// afford e.g. ₹5,000/month shouldn't be anchored into typing exactly the
// ₹2,000 floor just because it was visible. The message only appears once
// they've actually typed something below it.
const MIN_INSTALLMENT_PCT = 0.1;

export default function RequestLoanScreen({ navigation }: any) {
  const [amount, setAmount] = useState('');
  const [installmentAmount, setInstallmentAmount] = useState('');
  const [chequePhoto, setChequePhoto] = useState<string | null>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [termsVisible, setTermsVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const signatureRef = useRef<SignatureViewRef>(null);
  const termsLangRef = useRef<'en' | 'hi' | 'pa'>('en');

  const amt = Number(amount) || 0;
  const installmentAmt = Number(installmentAmount) || 0;
  const minInstallment = Math.ceil(amt * MIN_INSTALLMENT_PCT);
  // Only surfaces once they've typed a real (non-empty) installment that's
  // actually below the floor — never proactively, per the note above.
  const belowMin = installmentAmount.trim() !== '' && amt > 0 && installmentAmt > 0 && installmentAmt < minInstallment;
  const derivedEmis = amt > 0 && installmentAmt > 0 ? Math.ceil(amt / installmentAmt) : 0;

  const pick = async (useCamera: boolean) => {
    if (useCamera && Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert('Camera permission needed', 'Please allow camera access to take a photo, or use Gallery instead.');
        return;
      }
    }
    const result = useCamera
      ? await launchCamera({ mediaType: 'photo', quality: 0.6, includeBase64: true })
      : await launchImageLibrary({ mediaType: 'photo', quality: 0.6, includeBase64: true });
    if (result.didCancel || !result.assets?.[0]?.base64) return;
    const mime = result.assets[0].type || 'image/jpeg';
    setChequePhoto(`data:${mime};base64,${result.assets[0].base64}`);
  };

  const validate = () => {
    if (!Number.isFinite(amt) || amt <= 0) {
      Alert.alert('Enter a valid loan amount.');
      return false;
    }
    if (!Number.isFinite(installmentAmt) || installmentAmt <= 0) {
      Alert.alert('Enter a valid installment amount.');
      return false;
    }
    if (installmentAmt < minInstallment) {
      Alert.alert(
        'Installment too low',
        `Your installment must be at least ₹${minInstallment.toLocaleString('en-IN')} (10% of the loan amount). For a smaller installment, please contact admin directly.`
      );
      return false;
    }
    if (!chequePhoto) {
      Alert.alert('Please upload a photo of your cheque.');
      return false;
    }
    if (!hasSignature) {
      Alert.alert('Please draw your signature before submitting.');
      return false;
    }
    return true;
  };

  const doSubmit = () => {
    if (!validate()) return;
    setTermsVisible(true);
  };

  const onAgreeTerms = (lang: 'en' | 'hi' | 'pa') => {
    termsLangRef.current = lang;
    setTermsVisible(false);
    setSubmitting(true);
    signatureRef.current?.readSignature();
  };

  const proceedSubmit = async (signatureDataUri: string) => {
    try {
      const res = await submitLoanRequest({
        amount: amt,
        emis: derivedEmis,
        chequePhoto: chequePhoto!,
        signature: signatureDataUri,
        termsLanguage: termsLangRef.current,
      });
      if (res.data.success) {
        Alert.alert('Submitted', res.data.message, [{ text: 'OK', onPress: () => navigation.goBack() }]);
      } else {
        Alert.alert('Could not submit', res.data.message);
      }
    } catch (err: any) {
      Alert.alert('Could not submit', err?.response?.data?.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignatureEmpty = () => {
    setSubmitting(false);
    Alert.alert('Please draw your signature before submitting.');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} scrollEnabled={scrollEnabled}>
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Loan Details</Text>
        <TextField label="Amount requested (Rs.)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="e.g. 20000" />
        <TextField
          label="Installment amount per EMI (Rs.)"
          value={installmentAmount}
          onChangeText={setInstallmentAmount}
          keyboardType="decimal-pad"
          placeholder="How much can you pay each installment?"
          error={belowMin ? `Minimum ₹${minInstallment.toLocaleString('en-IN')} (10% of the loan amount) — or contact admin for a smaller installment.` : null}
        />
        {!belowMin && derivedEmis > 0 && (
          <Text style={styles.emiHint}>
            = {derivedEmis} EMI{derivedEmis === 1 ? '' : 's'}
          </Text>
        )}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Cheque Photo</Text>
        {chequePhoto ? <Image source={{ uri: chequePhoto }} style={styles.preview} /> : null}
        <View style={styles.pickRow}>
          <Pressable style={styles.pickChip} onPress={() => pick(true)}>
            <Icon name="camera" size={16} color={E.primary} />
            <Text style={styles.pickChipText}>Camera</Text>
          </Pressable>
          <Pressable style={styles.pickChip} onPress={() => pick(false)}>
            <Icon name="image" size={16} color={E.primary} />
            <Text style={styles.pickChipText}>Gallery</Text>
          </Pressable>
        </View>
      </Card>

      <Card style={styles.card}>
        <View style={styles.sigPadHeaderRow}>
          <Text style={styles.sectionTitle}>Digital Signature</Text>
          <Button
            title="Clear"
            variant="outline"
            onPress={() => {
              signatureRef.current?.clearSignature();
              setHasSignature(false);
            }}
            style={styles.sigClearBtn}
            textStyle={styles.sigClearBtnText}
          />
        </View>
        <View style={styles.sigPadBox}>
          <SignatureScreen
            ref={signatureRef}
            onOK={proceedSubmit}
            onEmpty={handleSignatureEmpty}
            onBegin={() => {
              setHasSignature(true);
              setScrollEnabled(false);
            }}
            onEnd={() => setScrollEnabled(true)}
            autoClear={false}
            webStyle={SIGNATURE_WEB_STYLE}
          />
          {!hasSignature ? (
            <Text style={styles.sigPlaceholder} pointerEvents="none">
              Draw your signature here
            </Text>
          ) : null}
        </View>
      </Card>

      <Button title="Review Terms & Submit" onPress={doSubmit} loading={submitting} style={{ marginTop: spacing(1) }} />

      <LoanTermsModal visible={termsVisible} onClose={() => setTermsVisible(false)} onAgree={onAgreeTerms} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: E.bg },
  content: { padding: spacing(2), paddingBottom: spacing(5) },
  card: { marginBottom: spacing(2) },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: E.ink, marginBottom: spacing(1.5) },
  emiHint: { fontSize: 12, color: E.muted, marginTop: -8, marginBottom: spacing(1) },
  preview: { width: '100%', height: 160, borderRadius: radius.sm, marginBottom: spacing(1), resizeMode: 'cover' },
  pickRow: { flexDirection: 'row', gap: 10 },
  pickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: E.border,
    backgroundColor: E.surface2,
  },
  pickChipText: { fontSize: 12.5, fontWeight: '700', color: E.primary },
  sigPadHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing(1) },
  sigClearBtn: { paddingHorizontal: 14, paddingVertical: 6 },
  sigClearBtnText: { fontSize: 12 },
  sigPadBox: { height: 180, borderWidth: 1, borderColor: E.border, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: '#fff' },
  sigPlaceholder: { position: 'absolute', top: 12, left: 12, fontSize: 12, color: E.muted },
});
