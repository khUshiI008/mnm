import { useState } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import { launchCamera } from 'react-native-image-picker';
import Geolocation from '@react-native-community/geolocation';
import { uploadBreakSelfie, uploadCheckInSelfie } from '../api/attendanceApi';

export type SelfieType = 'checkin' | 'break';

/**
 * Explicitly requests both permissions up front (Rapido-style) instead of
 * letting Camera/Geolocation fail silently when never-asked. Android leaves
 * an unrequested permission in a "not determined" state forever — nothing
 * ever prompts the user, so Geolocation.getCurrentPosition() below would
 * just keep resolving to {} indefinitely without this. iOS prompts natively
 * from the Camera/Geolocation calls themselves via Info.plist usage
 * descriptions, so this is Android-only.
 */
async function ensurePermissions() {
  if (Platform.OS !== 'android') return;
  await PermissionsAndroid.requestMultiple([PermissionsAndroid.PERMISSIONS.CAMERA, PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]);
}

function getLocation(): Promise<{ lat?: number; lng?: number }> {
  return new Promise((resolve) => {
    Geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve({}),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
  });
}

/** Shared front-camera capture + geolocation + upload flow for check-in/break selfies — used by DashboardScreen and AttendanceScreen. */
export function useSelfieCapture(onDone: (type: SelfieType, success: boolean, message: string) => void) {
  const [capturing, setCapturing] = useState<SelfieType | null>(null);

  const capture = async (type: SelfieType) => {
    setCapturing(type);
    try {
      await ensurePermissions();

      const result = await launchCamera({ mediaType: 'photo', cameraType: 'front', quality: 0.6, includeBase64: true, saveToPhotos: false });
      if (result.didCancel || !result.assets?.[0]?.base64) return;

      const mime = result.assets[0].type || 'image/jpeg';
      const dataUri = `data:${mime};base64,${result.assets[0].base64}`;
      const { lat, lng } = await getLocation();

      const res = type === 'checkin' ? await uploadCheckInSelfie(dataUri, lat, lng) : await uploadBreakSelfie(dataUri, lat, lng);
      onDone(type, !!res.data.success, res.data.message);
    } catch (err: any) {
      onDone(type, false, err?.response?.data?.message || 'Selfie upload failed. Please try again.');
    } finally {
      setCapturing(null);
    }
  };

  return { capturing, capture };
}
