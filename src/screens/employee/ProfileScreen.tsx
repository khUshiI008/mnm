import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, PermissionsAndroid, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { Picker } from '../../components/AppPicker';
import SignatureScreen, { SignatureViewRef } from 'react-native-signature-canvas';
import Card from '../../components/Card';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import DateField from '../../components/DateField';
import Icon, { IconName } from '../../components/Icon';
import { colors, radius, shadow, spacing } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { getProfile, ProfileResponse, sendEmailCode, submitKyc, updateContactDetails, verifyEmailCode } from '../../api/profileApi';
import { resolveFileUrl } from '../../utils/fileUrl';

const E = colors.emp;
// A few tones from the .NET reference's mobile Profile/KYC screen with no
// close match already in colors.emp — everything else below reuses E.* so
// this screen stays consistent with the rest of the app's palette.
const PROFILE_HIGHLIGHT = '#EDF3FB';
const SUCCESS_FILL = '#ECFDF5';
const SUCCESS_BORDER = '#A7F3D0';
const SUCCESS_TEXT = '#059669';

// Hides the library's own Clear/Confirm footer (this screen provides its
// own Clear button + triggers readSignature() from the main submit action
// instead) and strips the default drop-shadow/border so the pad blends into
// sigPadBox below rather than doubling it.
const SIGNATURE_WEB_STYLE = `
  .m-signature-pad--footer { display: none; margin: 0; }
  .m-signature-pad--body { border: none; }
  .m-signature-pad { box-shadow: none; border: none; }
  body,html { background-color: #fff; }
`;

export default function ProfileScreen() {
  const { signOut } = useAuth();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  // The signature pad is a WebView nested inside this screen's ScrollView —
  // without this, the ScrollView's own pan responder wins the gesture after
  // the initial touch-down, so drags never reach the canvas and only
  // isolated taps ("dots") register. Disabling scroll for the duration of
  // a stroke (KycForm's onBegin/onEnd below) lets the WebView see the full
  // drag instead.
  const [scrollEnabled, setScrollEnabled] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    getProfile()
      .then((res) => setProfile(res.data))
      .catch(() => Alert.alert('Could not load profile'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={E.primary} />
      </View>
    );
  }
  if (!profile) {
    return (
      <View style={styles.center}>
        <Text style={{ color: E.muted }}>Profile not found. Please contact HR.</Text>
      </View>
    );
  }

  const initials = (profile.fullName || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase();
  const locked = !!profile.kyc?.locked;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} scrollEnabled={scrollEnabled}>
      {/* ── Summary card — mirrors Profile.aspx's .kyc-left avatar/summary panel ── */}
      <Card style={styles.summaryCard}>
        {profile.kyc?.profilePicturePath ? (
          <Image source={{ uri: resolveFileUrl(profile.kyc.profilePicturePath)! }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        )}
        <Text style={styles.name}>{profile.fullName}</Text>
        {profile.employeeCode ? <Text style={styles.sub}>EMP: {profile.employeeCode}</Text> : null}
        <View style={[styles.kycPill, locked ? styles.kycPillVerified : styles.kycPillPending]}>
          <Text style={locked ? styles.kycVerifiedText : styles.kycPendingText}>{locked ? '✔ KYC Verified' : '⏳ KYC Pending'}</Text>
        </View>

        <View style={styles.metaList}>
          <InfoRow label="Mobile" value={profile.mobile} />
          <InfoRow label="Email" value={profile.email} />
          <InfoRow label="Gender" value={profile.gender} />
          <InfoRow label="Date of Birth" value={fmtDate(profile.dateOfBirth)} />
          <InfoRow label="Anniversary" value={fmtDate(profile.anniversaryDate)} />
          <InfoRow label="Joined" value={fmtDate(profile.dateOfJoining)} />
          <InfoRow label="Department" value={profile.department} />
          <InfoRow label="Designation" value={profile.designation} />
          <InfoRow label="Emp Type" value={profile.employmentType} />
          <InfoRow label="Last Login" value={fmtDate(profile.lastLoginDate)} last />
        </View>
      </Card>

      {/* ── Portal Account card — mirrors Profile.aspx's always-visible "Portal Account" card ── */}
      <SectionCard title="Portal Account" icon="user">
        <InfoRow label="Registered Mobile" value={profile.portal.mobile} />
        <InfoRow label="Registered Email" value={profile.portal.email} />
        <StatusInfoRow label="Account Status" ok={profile.portal.isVerified} okLabel="Verified" badLabel="Unverified" />
        <StatusInfoRow label="Approval Status" ok={profile.portal.approvalStatus === 'Approved'} okLabel="Approved" badLabel={profile.portal.approvalStatus || '—'} />
        <InfoRow label="Member Since" value={fmtDate(profile.portal.since)} last />
        <Text style={styles.footerNote}>To update your mobile or email, contact HR.</Text>
      </SectionCard>

      {locked ? <LockedKycView profile={profile} onUpdated={load} /> : <KycForm onSubmitted={load} setScrollEnabled={setScrollEnabled} />}

      <Button title="Sign out" variant="outline" onPress={signOut} style={{ marginTop: spacing(1) }} />
    </ScrollView>
  );
}

/** Mirrors Dashboard.Master.cs's IsProfileIncomplete(Employee emp). */
function isContactIncomplete(kyc: NonNullable<ProfileResponse['kyc']>) {
  const missingMaritalStatus = !kyc.maritalStatus;
  const missingAnniversary = kyc.maritalStatus === 'Married' && !kyc.anniversaryDate;
  const missingAddress = !kyc.address;
  const missingEmail = !kyc.email || !kyc.isEmailVerified;
  return missingMaritalStatus || missingAnniversary || missingAddress || missingEmail;
}

/** Read-only view of previously-submitted KYC — mirrors Profile.aspx's pnlKycLocked. */
function LockedKycView({ profile, onUpdated }: { profile: ProfileResponse; onUpdated: () => void }) {
  const kyc = profile.kyc!;
  return (
    <>
      {isContactIncomplete(kyc) && <ContactDetailsNag kyc={kyc} onSaved={onUpdated} />}

      <View style={styles.lockedBanner}>
        <Icon name="lock" size={16} color={SUCCESS_TEXT} />
        <Text style={styles.lockedBannerText}>
          KYC submitted on <Text style={styles.lockedBannerBold}>{fmtDate(kyc.submittedDate) || '—'}</Text> and locked. Contact HR for corrections.
        </Text>
      </View>

      <SectionCard title="Submitted Documents" icon="camera">
        <DocRow label="Profile Photo" path={kyc.profilePicturePath} />
        <DocRow label="Aadhaar – Front" path={kyc.aadharFrontPath} />
        <DocRow label="Aadhaar – Back" path={kyc.aadharBackPath} />
        <Text style={styles.docLabel}>Digital Signature</Text>
        {kyc.signaturePath ? (
          <Image source={{ uri: resolveFileUrl(kyc.signaturePath)! }} style={styles.signatureImg} resizeMode="contain" />
        ) : (
          <View style={[styles.signatureImg, styles.docEmpty]} />
        )}
      </SectionCard>

      <SectionCard title="Submitted Details" icon="creditCardDot" last>
        <InfoRow label="Gender" value={kyc.gender} />
        <InfoRow label="Date of Birth" value={fmtDate(kyc.dateOfBirth)} />
        <InfoRow label="Marital Status" value={kyc.maritalStatus} />
        {kyc.maritalStatus === 'Married' ? <InfoRow label="Anniversary" value={fmtDate(kyc.anniversaryDate)} /> : null}
        <InfoRow label="Address" value={kyc.address} />
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Email</Text>
          <Text style={[styles.infoValue, kyc.isEmailVerified && styles.infoValueSuccess]} numberOfLines={1}>
            {kyc.email ? `${kyc.isEmailVerified ? '✔ ' : ''}${kyc.email}${kyc.isEmailVerified ? ' — Verified' : ''}` : '—'}
          </Text>
        </View>
        <InfoRow label="Bank Name" value={kyc.bankName} />
        <InfoRow label="IFSC Code" value={kyc.ifscCode} />
        <InfoRow label="Account Number" value={kyc.accountNo} />
        <InfoRow label="Aadhaar Number" value={kyc.aadharNumberMasked} last />
      </SectionCard>
    </>
  );
}

/**
 * Post-lock "complete your profile" card — mirrors Dashboard.Master's
 * profile-completion nag popup (BindProfileNag/btnNagSave_Click), just
 * surfaced inline on the Profile tab instead of as a dashboard overlay.
 * Marital status / anniversary / address save through the lightweight
 * contact-details endpoint; email reuses the same send-code/verify-code
 * flow as the one-time KYC form above.
 */
function ContactDetailsNag({ kyc, onSaved }: { kyc: NonNullable<ProfileResponse['kyc']>; onSaved: () => void }) {
  const [maritalStatus, setMaritalStatus] = useState(kyc.maritalStatus || 'Single');
  const [anniversary, setAnniversary] = useState(kyc.anniversaryDate ? kyc.anniversaryDate.slice(0, 10) : '');
  const [address, setAddress] = useState(kyc.address || '');
  const [email, setEmail] = useState(kyc.email || '');
  const [emailCode, setEmailCode] = useState('');
  const [emailVerified, setEmailVerified] = useState(!!kyc.isEmailVerified);
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [saving, setSaving] = useState(false);

  const doSendCode = async () => {
    if (!email) return Alert.alert('Enter an email address first.');
    setSendingCode(true);
    try {
      const res = await sendEmailCode(email);
      Alert.alert('Code sent', (res.data as any).message);
      setCodeSent(true);
    } catch (err: any) {
      Alert.alert('Could not send code', err?.response?.data?.message || 'Please try again.');
    } finally {
      setSendingCode(false);
    }
  };

  const doVerifyCode = async () => {
    if (!emailCode) return;
    setVerifyingCode(true);
    try {
      await verifyEmailCode(emailCode);
      setEmailVerified(true);
      Alert.alert('Verified', 'Email verified successfully.');
      onSaved();
    } catch (err: any) {
      Alert.alert('Incorrect code', err?.response?.data?.message || 'Please try again.');
    } finally {
      setVerifyingCode(false);
    }
  };

  const doSave = async () => {
    setSaving(true);
    try {
      await updateContactDetails({
        maritalStatus,
        anniversaryDate: maritalStatus === 'Married' ? anniversary : undefined,
        address,
      });
      Alert.alert('Saved', 'Your details have been updated.');
      onSaved();
    } catch (err: any) {
      Alert.alert('Could not save', err?.response?.data?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard title="Complete your profile" subtitle="A few details are missing — fill them in when you get a chance.">
      <Text style={styles.label}>Marital status</Text>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={maritalStatus} onValueChange={setMaritalStatus}>
          <Picker.Item label="Single" value="Single" />
          <Picker.Item label="Married" value="Married" />
        </Picker>
      </View>
      {maritalStatus === 'Married' && (
        <DateField label="Anniversary date" granularity="day" value={anniversary} onChange={setAnniversary} placeholder="Select date" />
      )}
      <TextField label="Address" value={address} onChangeText={setAddress} multiline numberOfLines={2} />
      <Button title="Save" onPress={doSave} loading={saving} style={{ marginBottom: spacing(2) }} />

      <Text style={styles.label}>Email {emailVerified ? '(verified)' : ''}</Text>
      <TextField value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" editable={!emailVerified} />
      {email && !emailVerified && (
        <View style={{ marginTop: spacing(1) }}>
          <Button title={codeSent ? 'Resend code' : 'Send verification code'} variant="outline" onPress={doSendCode} loading={sendingCode} />
          {codeSent && (
            <View style={{ marginTop: spacing(1) }}>
              <TextField label="Enter code" value={emailCode} onChangeText={setEmailCode} keyboardType="number-pad" maxLength={6} />
              <Button title="Verify code" onPress={doVerifyCode} loading={verifyingCode} />
            </View>
          )}
        </View>
      )}
      {emailVerified && <Text style={styles.verifiedText}>✔ Email verified</Text>}
    </SectionCard>
  );
}

/** Full-width stacked document preview — mirrors the reference's "Submitted Documents" card rows. */
function DocRow({ label, path }: { label: string; path: string | null }) {
  return (
    <View style={styles.docRow}>
      <Text style={styles.docLabel}>{label}</Text>
      {path ? <Image source={{ uri: resolveFileUrl(path)! }} style={styles.docPreview} /> : <View style={[styles.docPreview, styles.docEmpty]} />}
    </View>
  );
}

function SectionCard({
  title,
  subtitle,
  icon,
  children,
  last,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <Card style={[styles.sectionCard, last && { marginBottom: 0 }]}>
      <View style={styles.sectionTitleRow}>
        {icon ? <Icon name={icon} size={16} color={E.ink} /> : null}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      {children}
    </Card>
  );
}

function InfoRow({ label, value, last }: { label: string; value: string | null | undefined; last?: boolean }) {
  return (
    <View style={[styles.infoRow, last && styles.infoRowLast]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '—'}</Text>
    </View>
  );
}

/** Green-checkmark variant of InfoRow for the Portal Account status fields. */
function StatusInfoRow({ label, ok, okLabel, badLabel }: { label: string; ok: boolean; okLabel: string; badLabel: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, ok && styles.infoValueSuccess]}>{ok ? `✔ ${okLabel}` : badLabel}</Text>
    </View>
  );
}

function fmtDate(d: string | null | undefined) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * The one-time KYC submission form — mirrors Profile.aspx.cs's pnlKycEdit.
 * Same fields/state/validation/submit flow as before; only regrouped into
 * .NET's 5 section cards (Personal Information / Bank Details / Aadhaar
 * Details / Document Uploads / Digital Signature) instead of one big card.
 */
function KycForm({ onSubmitted, setScrollEnabled }: { onSubmitted: () => void; setScrollEnabled: (v: boolean) => void }) {
  const [gender, setGender] = useState('Male');
  const [dob, setDob] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('Single');
  const [anniversary, setAnniversary] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [bankName, setBankName] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [accountNo, setAccountNo] = useState('');
  const [aadharNumber, setAadharNumber] = useState('');

  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [aadharFront, setAadharFront] = useState<string | null>(null);
  const [aadharBack, setAadharBack] = useState<string | null>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const signatureRef = useRef<SignatureViewRef>(null);

  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const pick = async (setter: (v: string) => void, useCamera: boolean) => {
    // launchCamera silently no-ops without this on some Android versions/OEMs
    // instead of prompting — same root cause as useSelfieCapture.ts's location
    // bug, just for the CAMERA permission this time.
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
    setter(`data:${mime};base64,${result.assets[0].base64}`);
  };

  const doSendCode = async () => {
    if (!email) return Alert.alert('Enter an email address first.');
    setSendingCode(true);
    try {
      const res = await sendEmailCode(email);
      Alert.alert('Code sent', (res.data as any).message);
      setCodeSent(true);
    } catch (err: any) {
      Alert.alert('Could not send code', err?.response?.data?.message || 'Please try again.');
    } finally {
      setSendingCode(false);
    }
  };

  const doVerifyCode = async () => {
    if (!emailCode) return;
    setVerifyingCode(true);
    try {
      await verifyEmailCode(emailCode);
      setEmailVerified(true);
      Alert.alert('Verified', 'Email verified successfully.');
    } catch (err: any) {
      Alert.alert('Incorrect code', err?.response?.data?.message || 'Please try again.');
    } finally {
      setVerifyingCode(false);
    }
  };

  /**
   * Mirrors Profile.aspx's sigPad — the canvas itself isn't "saved" by its own
   * button; readSignature() is triggered from the main submit action below,
   * and its onOK/onEmpty callback is what actually carries on with (or blocks)
   * the rest of the submission, since the drawn image only exists once read.
   */
  const proceedSubmit = async (signatureDataUri: string) => {
    try {
      const res = await submitKyc({
        gender,
        dateOfBirth: dob,
        maritalStatus,
        anniversaryDate: maritalStatus === 'Married' ? anniversary : undefined,
        address,
        bankName,
        ifscCode: ifsc,
        accountNo,
        aadharNumber,
        email: email || undefined,
        profilePicture: profilePic!,
        aadharFront: aadharFront!,
        aadharBack: aadharBack!,
        signature: signatureDataUri,
      });
      Alert.alert('Submitted', (res.data as any).message);
      onSubmitted();
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

  const doSubmit = () => {
    if (!gender) return Alert.alert('Please select your gender.');
    if (!dob) return Alert.alert('Please select your date of birth.');
    if (email && !emailVerified) return Alert.alert('Please verify your email before submitting, or clear the email field.');
    if (!bankName) return Alert.alert('Bank name is required.');
    if (ifsc.trim().length !== 11) return Alert.alert('IFSC code must be exactly 11 characters.');
    if (!accountNo) return Alert.alert('Account number is required.');
    if (!/^\d{12}$/.test(aadharNumber.trim())) return Alert.alert('Aadhaar number must be exactly 12 digits.');
    if (!profilePic) return Alert.alert('Please upload your profile photo.');
    if (!aadharFront) return Alert.alert('Please upload Aadhaar card front side.');
    if (!aadharBack) return Alert.alert('Please upload Aadhaar card back side.');
    if (!hasSignature) return Alert.alert('Please draw your signature before submitting.');

    setSubmitting(true);
    signatureRef.current?.readSignature();
  };

  return (
    <>
      <Text style={styles.kycNote}>Complete your KYC (one-time). Once submitted, these details are locked — HR can amend them later if needed.</Text>

      <SectionCard title="Personal Information">
        <Text style={styles.label}>Gender</Text>
        <View style={styles.pickerWrap}>
          <Picker selectedValue={gender} onValueChange={setGender}>
            <Picker.Item label="Male" value="Male" />
            <Picker.Item label="Female" value="Female" />
            <Picker.Item label="Other" value="Other" />
          </Picker>
        </View>
        <DateField label="Date of birth" granularity="day" value={dob} onChange={setDob} placeholder="Select date" />

        <Text style={styles.label}>Marital status</Text>
        <View style={styles.pickerWrap}>
          <Picker selectedValue={maritalStatus} onValueChange={setMaritalStatus}>
            <Picker.Item label="Single" value="Single" />
            <Picker.Item label="Married" value="Married" />
          </Picker>
        </View>
        {maritalStatus === 'Married' && (
          <DateField label="Anniversary date" granularity="day" value={anniversary} onChange={setAnniversary} placeholder="Select date" />
        )}
        <TextField label="Address" value={address} onChangeText={setAddress} multiline numberOfLines={2} />

        <Text style={styles.label}>Email (optional — verify before submitting)</Text>
        <TextField value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" editable={!emailVerified} />
        {email && !emailVerified && (
          <View style={{ marginBottom: spacing(2) }}>
            <Button title="Send verification code" variant="outline" onPress={doSendCode} loading={sendingCode} />
            {codeSent && (
              <View style={{ marginTop: spacing(1) }}>
                <TextField label="Enter code" value={emailCode} onChangeText={setEmailCode} keyboardType="number-pad" maxLength={6} />
                <Button title="Verify code" onPress={doVerifyCode} loading={verifyingCode} />
              </View>
            )}
          </View>
        )}
        {emailVerified && <Text style={styles.verifiedText}>✔ Email verified</Text>}
      </SectionCard>

      <SectionCard title="Bank Details">
        <TextField label="Bank name" value={bankName} onChangeText={setBankName} />
        <TextField label="IFSC code" value={ifsc} onChangeText={(v) => setIfsc(v.toUpperCase())} maxLength={11} autoCapitalize="characters" />
        <TextField label="Account number" value={accountNo} onChangeText={setAccountNo} keyboardType="number-pad" />
      </SectionCard>

      <SectionCard title="Aadhaar Details">
        <TextField label="Aadhaar number (12 digits)" value={aadharNumber} onChangeText={setAadharNumber} keyboardType="number-pad" maxLength={12} />
      </SectionCard>

      <SectionCard title="Document Uploads">
        <ImagePickRow label="Profile photo" value={profilePic} onPick={(cam) => pick(setProfilePic, cam)} />
        <ImagePickRow label="Aadhaar front" value={aadharFront} onPick={(cam) => pick(setAadharFront, cam)} />
        <ImagePickRow label="Aadhaar back" value={aadharBack} onPick={(cam) => pick(setAadharBack, cam)} />
      </SectionCard>

      <SectionCard title="Digital Signature" last>
        <View style={styles.sigPadHeaderRow}>
          <Text style={styles.label}>✍ Draw your signature</Text>
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
          {!hasSignature ? <Text style={styles.sigPlaceholder} pointerEvents="none">Draw your signature here</Text> : null}
        </View>
        <Text style={styles.sigNote}>Use your finger to draw your signature in the box above. This will be stored as your official digital signature.</Text>
        <Button title="Submit & lock KYC" onPress={doSubmit} loading={submitting} style={{ marginTop: spacing(1) }} />
      </SectionCard>
    </>
  );
}

function ImagePickRow({ label, value, onPick }: { label: string; value: string | null; onPick: (useCamera: boolean) => void }) {
  return (
    <View style={{ marginBottom: spacing(2) }}>
      <Text style={styles.label}>{label}</Text>
      {value ? <Image source={{ uri: value }} style={styles.preview} /> : null}
      <View style={styles.pickRow}>
        <Pressable style={styles.pickChip} onPress={() => onPick(true)}>
          <Icon name="camera" size={16} color={E.primary} />
          <Text style={styles.pickChipText}>Camera</Text>
        </Pressable>
        <Pressable style={styles.pickChip} onPress={() => onPick(false)}>
          <Icon name="image" size={16} color={E.primary} />
          <Text style={styles.pickChipText}>Gallery</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: E.bg },
  content: { padding: spacing(2), paddingBottom: spacing(5) },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: E.bg },

  summaryCard: { alignItems: 'center', marginBottom: spacing(2), borderRadius: radius.md, backgroundColor: PROFILE_HIGHLIGHT, ...shadow.card },
  avatar: { width: 88, height: 88, borderRadius: 44, marginBottom: spacing(1), borderWidth: 3, borderColor: '#fff', ...shadow.card },
  avatarPlaceholder: { backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 30, fontWeight: '800', color: '#fff' },
  name: { fontSize: 16, fontWeight: '800', color: E.ink, textAlign: 'center', textTransform: 'uppercase' },
  sub: { fontSize: 13, color: E.muted, marginTop: 2 },

  kycPill: { marginTop: spacing(1), paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  kycPillVerified: { backgroundColor: SUCCESS_FILL, borderColor: SUCCESS_BORDER },
  kycPillPending: { backgroundColor: '#fef3c7', borderColor: '#fde68a' },
  kycVerifiedText: { color: SUCCESS_TEXT, fontWeight: '700', fontSize: 12 },
  kycPendingText: { color: E.yellow, fontWeight: '700', fontSize: 12 },

  metaList: { width: '100%', marginTop: spacing(2) },

  sectionCard: { marginBottom: spacing(2), borderRadius: radius.md, ...shadow.card },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: E.ink },
  sectionSubtitle: { fontSize: 12, color: E.muted, marginBottom: spacing(1.5) },
  kycNote: { fontSize: 12, color: E.muted, marginBottom: spacing(1.5) },

  lockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: SUCCESS_FILL,
    borderWidth: 1,
    borderColor: SUCCESS_BORDER,
    borderRadius: radius.sm,
    padding: spacing(1.5),
    marginBottom: spacing(2),
  },
  lockedBannerText: { flex: 1, fontSize: 12, color: SUCCESS_TEXT },
  lockedBannerBold: { fontWeight: '800' },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: E.border },
  infoRowLast: { borderBottomWidth: 0 },
  infoLabel: { color: E.muted, fontSize: 12 },
  infoValue: { color: E.ink, fontSize: 13, fontWeight: '500', flexShrink: 1, textAlign: 'right' },
  infoValueSuccess: { color: SUCCESS_TEXT, fontWeight: '700' },
  footerNote: { fontSize: 11, color: E.muted, marginTop: spacing(1) },

  label: { fontSize: 13, color: E.muted, marginBottom: 6, fontWeight: '500' },
  pickerWrap: { borderWidth: 1, borderColor: E.border, borderRadius: radius.sm, marginBottom: spacing(2), backgroundColor: E.surface },
  verifiedText: { color: E.green, fontWeight: '700', fontSize: 12, marginBottom: spacing(2) },
  preview: { width: 120, height: 90, borderRadius: 8, marginBottom: spacing(1) },
  pickRow: { flexDirection: 'row', gap: spacing(1) },
  pickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: E.primary + '12',
    borderWidth: 1,
    borderColor: E.primary + '30',
  },
  pickChipText: { fontSize: 12, fontWeight: '700', color: E.primary },

  docRow: { marginBottom: spacing(2) },
  docLabel: { fontSize: 12, fontWeight: '700', color: E.ink, marginBottom: 6 },
  docPreview: { width: '100%', aspectRatio: 16 / 10, borderRadius: 10, backgroundColor: E.surface2 },
  docEmpty: { borderWidth: 1, borderColor: E.border, borderStyle: 'dashed' },
  signatureImg: { width: '100%', height: 100, backgroundColor: E.surface2, borderRadius: 10 },

  sigPadHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  sigClearBtn: { paddingVertical: 6, paddingHorizontal: 14 },
  sigClearBtnText: { fontSize: 12 },
  sigPadBox: {
    height: 160,
    borderWidth: 1,
    borderColor: E.border,
    borderRadius: radius.sm,
    backgroundColor: '#fff',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  sigPlaceholder: { position: 'absolute', alignSelf: 'center', fontSize: 13, color: E.muted },
  sigNote: { fontSize: 11, color: E.muted, marginTop: 6, marginBottom: spacing(1.5) },
});
