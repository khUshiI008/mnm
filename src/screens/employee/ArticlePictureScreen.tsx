import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, PermissionsAndroid, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { launchCamera, launchImageLibrary, ImagePickerResponse } from 'react-native-image-picker';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import SearchableSelect from '../../components/common/SearchableSelect';
import { colors, radius, spacing } from '../../theme';
import { resolveFileUrl } from '../../utils/fileUrl';
import { EmployeeBrandOption } from '../../api/employeeLiveStockApi';
import {
  ArticleMatch,
  ArticlePictureDto,
  ArticlePictureRequest,
  getArticlePictureBrands,
  getArticlePictureRequests,
  getArticlePictures,
  searchArticles,
  uploadArticlePicture,
} from '../../api/articlePictureApi';

const E = colors.emp;
const MIN_SEARCH_CHARS = 3;
const PICK_OPTIONS = { mediaType: 'photo' as const, includeBase64: true, maxWidth: 1600, maxHeight: 1600, quality: 0.7 as const };

type Params = { brandId?: number; brandName?: string; articleNo?: string };

/** Picture of a web- or app-uploaded Article, or a placeholder if none / it fails to load. */
function ArticleThumb({ path, size, style }: { path?: string | null; size: number; style?: object }) {
  const [failed, setFailed] = useState(false);
  const uri = resolveFileUrl(path);
  if (uri && !failed) {
    return <Image source={{ uri }} style={[{ width: size, height: size, borderRadius: 10, backgroundColor: E.surface2 }, style]} onError={() => setFailed(true)} />;
  }
  return (
    <View style={[{ width: size, height: size, borderRadius: 10 }, styles.thumbPlaceholder, style]}>
      <Icon name="image" size={Math.max(16, size * 0.4)} color={E.muted} strokeWidth={1.5} />
    </View>
  );
}

/**
 * Node/app port of Employee/ArticlePictureUpload.aspx. Flow: Brand (auto-picked
 * when the employee has only one) -> type the last digits of the Article No ->
 * pick from the matching Articles -> take a photo or choose from the gallery ->
 * Save. Writes the shared ArticlePictures table, so a picture uploaded here or
 * on the web portal shows up in both, and one picture is reused for every
 * sale of that Article (all sizes/colours).
 */
export default function ArticlePictureScreen({ route }: { route?: { params?: Params } }) {
  const params = route?.params;
  const [loading, setLoading] = useState(true);
  const [brands, setBrands] = useState<EmployeeBrandOption[]>([]);
  const [brandId, setBrandId] = useState<number | null>(null);
  const [requests, setRequests] = useState<ArticlePictureRequest[]>([]);

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState<ArticleMatch[] | null>(null);
  const [selected, setSelected] = useState<ArticleMatch | null>(null);

  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [gallery, setGallery] = useState<ArticlePictureDto[]>([]);
  const [viewing, setViewing] = useState<ArticlePictureDto | null>(null);
  const searchSeq = useRef(0);

  const loadGallery = useCallback((id: number) => {
    getArticlePictures(id)
      .then((res) => setGallery(res.data.pictures))
      .catch(() => setGallery([]));
  }, []);

  const loadRequests = useCallback(() => {
    getArticlePictureRequests()
      .then((res) => setRequests(res.data.requests))
      .catch(() => {});
  }, []);

  // Brand the screen was opened for — by id (notification / request) or by
  // name (Sales Target bill detail, which only knows the sold Brand's name).
  const [paramBrandId, setParamBrandId] = useState<number | null>(null);

  useEffect(() => {
    getArticlePictureBrands()
      .then((res) => {
        const list = res.data.brands;
        setBrands(list);
        const byName = params?.brandName ? params.brandName.trim().toUpperCase() : null;
        const wanted =
          (params?.brandId != null ? list.find((b) => b.id === Number(params.brandId)) : null) ||
          (byName ? list.find((b) => b.display.trim().toUpperCase() === byName) : null) ||
          null;
        setParamBrandId(wanted ? wanted.id : null);
        if (wanted) setBrandId(wanted.id);
        else if (list.length === 1) setBrandId(list[0].id);
        if ((params?.brandId != null || byName) && !wanted && params?.articleNo) {
          Alert.alert('Brand not allocated', `${params.brandName || 'This Brand'} isn't allocated to you, so you can't upload a picture for Article ${params.articleNo}.`);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    loadRequests();
  }, [params?.brandId, params?.brandName, params?.articleNo, loadRequests]);

  // Opened for a specific Article (notification, request, or Sales Target) — jump straight to it.
  useEffect(() => {
    if (params?.articleNo && brandId != null && brandId === paramBrandId) {
      setQuery(params.articleNo);
    }
  }, [params?.articleNo, paramBrandId, brandId]);

  const resetArticle = () => {
    setSelected(null);
    setPendingImage(null);
  };

  const changeBrand = (id: number) => {
    setBrandId(id);
    setQuery('');
    setMatches(null);
    resetArticle();
  };

  useEffect(() => {
    if (brandId != null) loadGallery(brandId);
    else setGallery([]);
  }, [brandId, loadGallery]);

  // Debounced search as the employee types the last digits.
  useEffect(() => {
    const q = query.trim();
    if (brandId == null || q.length < MIN_SEARCH_CHARS) {
      setMatches(null);
      return;
    }
    const seq = ++searchSeq.current;
    setSearching(true);
    const t = setTimeout(() => {
      searchArticles(brandId, q)
        .then((res) => {
          if (seq !== searchSeq.current) return;
          setMatches(res.data.articles);
          // Came from a request with the full Article No — select it directly
          // (even if it isn't in recent sales history, the admin asked for it).
          if (params?.articleNo && q.toUpperCase() === params.articleNo.toUpperCase()) {
            const exact = res.data.articles.find((a) => a.articleNo.toUpperCase() === q.toUpperCase());
            setSelected(exact || { articleNo: params.articleNo, qtySold: 0, lastSold: null, picture: null });
          }
        })
        .catch(() => seq === searchSeq.current && setMatches([]))
        .finally(() => seq === searchSeq.current && setSearching(false));
    }, 400);
    return () => clearTimeout(t);
  }, [query, brandId, params?.articleNo]);

  const handlePicked = (result: ImagePickerResponse) => {
    if (result.didCancel) return;
    const asset = result.assets?.[0];
    if (result.errorCode || !asset?.base64) {
      Alert.alert('Could not get the picture', result.errorMessage || 'Please try again.');
      return;
    }
    setPendingImage(`data:${asset.type || 'image/jpeg'};base64,${asset.base64}`);
  };

  const pickFromCamera = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert('Camera permission needed', 'Allow camera access to take the article picture.');
        return;
      }
    }
    // Product photo — always open on the BACK camera (the phone's camera app
    // may still offer its own flip button; the app can't hide that).
    handlePicked(await launchCamera({ ...PICK_OPTIONS, cameraType: 'back', saveToPhotos: false }));
  };

  const pickFromGallery = async () => {
    handlePicked(await launchImageLibrary({ ...PICK_OPTIONS, selectionLimit: 1 }));
  };

  const choosePicture = () => {
    Alert.alert('Add picture', `Article ${selected?.articleNo}`, [
      { text: 'Take Photo', onPress: pickFromCamera },
      { text: 'Choose from Gallery', onPress: pickFromGallery },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const save = async () => {
    if (!selected || !pendingImage || brandId == null || saving) return;
    setSaving(true);
    try {
      const res = await uploadArticlePicture({ brandId, articleNo: selected.articleNo, image: pendingImage });
      const pic = res.data.picture;
      const updated = { ...selected, picture: pic };
      setSelected(updated);
      setMatches((m) => (m ? m.map((a) => (a.articleNo === selected.articleNo ? updated : a)) : m));
      setPendingImage(null);
      loadGallery(brandId);
      loadRequests();
      Alert.alert('Picture saved', `Article ${selected.articleNo} now has a picture.`);
    } catch (err: any) {
      Alert.alert('Could not save', err?.response?.data?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // "Change Picture" on a gallery picture — select that Article (step 3) and open the camera/gallery choice.
  const changeFromGallery = (p: ArticlePictureDto) => {
    setViewing(null);
    setPendingImage(null);
    setMatches(null);
    setQuery(p.articleNo);
    const article: ArticleMatch = { articleNo: p.articleNo, qtySold: 0, lastSold: null, picture: p };
    // setQuery above re-runs the search; select after it so the result list doesn't cover step 3.
    setTimeout(() => {
      setSelected(article);
      Alert.alert('Change picture', `Article ${p.articleNo}`, [
        { text: 'Take Photo', onPress: pickFromCamera },
        { text: 'Choose from Gallery', onPress: pickFromGallery },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }, 0);
  };

  const openRequest = (r: ArticlePictureRequest) => {
    if (r.brandId !== brandId) changeBrand(r.brandId);
    else resetArticle();
    setQuery(r.articleNo);
    // Selected once the search returns the exact Article (see search effect).
    searchArticles(r.brandId, r.articleNo)
      .then((res) => {
        const exact = res.data.articles.find((a) => a.articleNo.toUpperCase() === r.articleNo.toUpperCase());
        setSelected(exact || { articleNo: r.articleNo, qtySold: 0, lastSold: null, picture: null });
      })
      .catch(() => setSelected({ articleNo: r.articleNo, qtySold: 0, lastSold: null, picture: null }));
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={E.primary} />
      </View>
    );
  }

  if (!brands.length) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Article pictures can be uploaded once you're assigned to a Sales Target with a Brand — contact admin if you think this is a mistake.</Text>
      </View>
    );
  }

  const activeBrand = brands.find((b) => b.id === brandId) || null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {requests.length > 0 && (
        <Card style={styles.requestCard}>
          <Text style={styles.requestTitle}>Pictures requested by admin ({requests.length})</Text>
          {requests.map((r) => (
            <Pressable key={`${r.brandId}|${r.articleNo}`} style={styles.requestRow} onPress={() => openRequest(r)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.requestArticle}>{r.articleNo}</Text>
                <Text style={styles.requestMeta}>
                  {r.brandName}
                  {r.requestedDate ? ` · requested ${r.requestedDate}` : ''}
                </Text>
              </View>
              <Text style={styles.requestAction}>Upload</Text>
            </Pressable>
          ))}
        </Card>
      )}

      <Card style={styles.card}>
        <Text style={styles.stepLabel}>1. Brand</Text>
        {brands.length === 1 ? (
          <View style={styles.brandChip}>
            <Text style={styles.brandChipText}>{brands[0].display}</Text>
          </View>
        ) : (
          <SearchableSelect
            items={brands.map((b) => ({ label: b.display, value: b.id }))}
            selectedValue={brandId ?? ''}
            onValueChange={(v) => changeBrand(Number(v))}
            placeholder="Select your brand"
            searchPlaceholder="Search brand…"
            title="Select Brand"
            theme={E}
          />
        )}
      </Card>

      {activeBrand && (
        <Card style={styles.card}>
          <Text style={styles.stepLabel}>2. Article No</Text>
          <View style={styles.searchBox}>
            <Icon name="search" size={16} color={E.muted} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={(t) => {
                setQuery(t);
                resetArticle();
              }}
              placeholder="Type the last 4 digits"
              placeholderTextColor={E.muted}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            {searching && <ActivityIndicator size="small" color={E.primary} />}
          </View>
          {query.trim().length > 0 && query.trim().length < MIN_SEARCH_CHARS && <Text style={styles.hint}>Keep typing — at least {MIN_SEARCH_CHARS} characters.</Text>}

          {matches && !selected && (
            <View style={{ marginTop: spacing(1) }}>
              {matches.length === 0 ? (
                <Text style={styles.hint}>No {activeBrand.display} article matches "{query.trim()}".</Text>
              ) : (
                matches.map((a) => (
                  <Pressable key={a.articleNo} style={styles.matchRow} onPress={() => setSelected(a)}>
                    <ArticleThumb path={a.picture?.imagePath} size={44} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.matchArticle} numberOfLines={1}>
                        {a.articleNo}
                      </Text>
                      <Text style={styles.matchMeta} numberOfLines={1}>
                        {a.qtySold} pcs sold{a.lastSold ? ` · last ${a.lastSold}` : ''}
                      </Text>
                    </View>
                    {a.picture ? <Text style={styles.hasPic}>✓ Picture</Text> : <Text style={styles.noPic}>No picture</Text>}
                  </Pressable>
                ))
              )}
            </View>
          )}
        </Card>
      )}

      {selected && activeBrand && (
        <Card style={styles.card}>
          <View style={styles.selectedHead}>
            <Text style={styles.stepLabel}>3. Picture for {selected.articleNo}</Text>
            <Pressable onPress={resetArticle} hitSlop={8}>
              <Text style={styles.changeLink}>Change</Text>
            </Pressable>
          </View>

          {pendingImage ? (
            <Image source={{ uri: pendingImage }} style={styles.bigImage} resizeMode="contain" />
          ) : (
            <ArticleThumb path={selected.picture?.imagePath} size={0} style={styles.bigImage} />
          )}

          {selected.picture && !pendingImage && (
            <Text style={styles.hint}>
              Uploaded by {selected.picture.uploadedByName || '—'}
              {selected.picture.uploadedDate ? ` on ${selected.picture.uploadedDate}` : ''}. A new picture will replace it.
            </Text>
          )}

          {pendingImage ? (
            // Full-width, stacked (not two half-width buttons side by side) —
            // the half-width primary button was rendering with its label missing.
            <View style={styles.btnStack}>
              <Button
                title={selected.picture ? 'Save New Picture' : 'Save Picture'}
                onPress={save}
                loading={saving}
                textStyle={styles.btnTextOnPrimary}
              />
              <Button title="Retake / Choose Another" variant="outline" onPress={choosePicture} disabled={saving} />
            </View>
          ) : selected.picture ? (
            // Already has a picture (from the web or the app) — anyone with this Brand can change it.
            <Button title="Change Picture" onPress={choosePicture} style={{ marginTop: spacing(1.5) }} />
          ) : (
            <View style={styles.btnStack}>
              <Button title="Take Photo" onPress={pickFromCamera} textStyle={styles.btnTextOnPrimary} />
              <Button title="Choose from Gallery" variant="outline" onPress={pickFromGallery} />
            </View>
          )}
        </Card>
      )}

      {activeBrand && gallery.length > 0 && (
        <Card style={styles.card}>
          <Text style={styles.stepLabel}>
            Uploaded pictures · {activeBrand.display} ({gallery.length})
          </Text>
          <View style={styles.galleryGrid}>
            {gallery.map((p) => (
              <Pressable key={`${p.articleNo}|${p.color}`} style={styles.galleryItem} onPress={() => setViewing(p)}>
                <ArticleThumb path={p.imagePath} size={0} style={styles.galleryImage} />
                <Text style={styles.galleryLabel} numberOfLines={1}>
                  {p.articleNo}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>
      )}

      <Modal visible={!!viewing} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <View style={styles.viewRoot}>
          <Pressable style={[StyleSheet.absoluteFill, styles.viewBackdrop]} onPress={() => setViewing(null)} />
          {viewing && (
            <View style={styles.viewBox}>
              <ArticleThumb path={viewing.imagePath} size={0} style={styles.viewImage} />
              <Text style={styles.viewTitle}>{viewing.articleNo}</Text>
              <Text style={styles.hint}>
                {viewing.brandName}
                {viewing.color ? ` · ${viewing.color}` : ''} · by {viewing.uploadedByName || '—'}
                {viewing.uploadedDate ? ` on ${viewing.uploadedDate}` : ''}
              </Text>
              <Button title="Change Picture" onPress={() => changeFromGallery(viewing)} style={{ marginTop: spacing(1.5) }} />
              <Button title="Close" variant="outline" onPress={() => setViewing(null)} style={{ marginTop: spacing(1) }} />
            </View>
          )}
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: E.bg },
  content: { padding: spacing(2), paddingBottom: spacing(5) },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing(3), backgroundColor: E.bg },
  emptyText: { color: E.muted, fontSize: 13, textAlign: 'center', lineHeight: 19 },

  card: { marginBottom: spacing(2) },
  stepLabel: { fontSize: 13, fontWeight: '800', color: E.ink, marginBottom: spacing(1) },
  hint: { fontSize: 11.5, color: E.muted, marginTop: 6, lineHeight: 16 },

  brandChip: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: E.primary + '1a' },
  brandChipText: { fontSize: 13, fontWeight: '700', color: E.primary },

  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: E.border, borderRadius: radius.sm, paddingHorizontal: 12, backgroundColor: E.surface },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 15, color: E.ink },

  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: E.border },
  matchArticle: { fontSize: 13.5, fontWeight: '700', color: E.ink },
  matchMeta: { fontSize: 11, color: E.muted, marginTop: 1 },
  hasPic: { fontSize: 11, fontWeight: '700', color: E.green },
  noPic: { fontSize: 11, fontWeight: '600', color: E.muted },
  thumbPlaceholder: { backgroundColor: E.surface2, borderWidth: 1, borderColor: E.border, alignItems: 'center', justifyContent: 'center' },

  selectedHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  changeLink: { fontSize: 12, fontWeight: '700', color: E.primary, marginBottom: spacing(1) },
  bigImage: { width: '100%', height: 260, borderRadius: radius.md },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: spacing(1.5) },
  btnStack: { gap: 10, marginTop: spacing(1.5) },
  btnTextOnPrimary: { color: '#fff' },

  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  galleryItem: { width: '30%' },
  galleryImage: { width: '100%', height: 90 },
  galleryLabel: { fontSize: 10.5, fontWeight: '600', color: E.ink, marginTop: 3 },

  requestCard: { marginBottom: spacing(2), borderWidth: 1, borderColor: '#fcd34d', backgroundColor: '#fffbeb' },
  requestTitle: { fontSize: 13, fontWeight: '800', color: '#92400e', marginBottom: 6 },
  requestRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#fde68a' },
  requestArticle: { fontSize: 13, fontWeight: '700', color: E.ink },
  requestMeta: { fontSize: 11, color: E.muted, marginTop: 1 },
  requestAction: { fontSize: 12, fontWeight: '800', color: E.primary },

  viewRoot: { flex: 1, justifyContent: 'center', padding: spacing(2.5) },
  viewBackdrop: { backgroundColor: 'rgba(15,13,35,0.6)' },
  viewBox: { backgroundColor: E.surface, borderRadius: 20, padding: spacing(2.5) },
  viewImage: { width: '100%', height: 300 },
  viewTitle: { fontSize: 16, fontWeight: '800', color: E.ink, marginTop: spacing(1.5) },
});
