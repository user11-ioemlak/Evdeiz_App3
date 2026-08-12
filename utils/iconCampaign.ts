import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentIcon, setAppIcon, supportsAlternateIcons } from '../modules/icon-switcher';
import appJson from '../app.json';

// ────────────────────────────────────────────
// Tip Tanımları (Sunucu API yapısına uyumlu)
// ────────────────────────────────────────────

interface PlatformIconInfo {
  tema: string;
  klasor: string;
  base_url: string;
  dosyalar: string[];
}

interface OzelGun {
  ozel_gun_adi: string;
  baslama_tarihi: string;
  bitis_tarihi: string;
  android: PlatformIconInfo;
  ios: PlatformIconInfo;
}

interface IconCampaignConfig {
  success: boolean;
  generated_at: string;
  base_url: string;
  ozel_gunler: OzelGun[];
}

export interface CampaignCheckResult {
  hasActiveCampaign: boolean;
  campaign: OzelGun | null;
  tema: string | null;
  previewImageUrl: string | null;
  shouldPromptUser: boolean;
  shouldResetToDefault: boolean;
}

// ────────────────────────────────────────────
// AsyncStorage Anahtarları
// ────────────────────────────────────────────

const STORAGE_KEY_LAST_CAMPAIGN = '@icon_campaign_last_id';
const STORAGE_KEY_USER_CHOICE = '@icon_campaign_user_choice'; // "accepted" | "rejected"
const STORAGE_KEY_ACTIVE_TEMA = '@icon_campaign_active_tema';

// ────────────────────────────────────────────
// API URL (app.json extra'dan)
// ────────────────────────────────────────────

function getCampaignUrl(): string {
  const baseUrl = appJson.expo?.extra?.buildUrl || 'https://ioemlak.com/';
  const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return `${cleanBaseUrl}/app_icon/config.json`;
}

// ────────────────────────────────────────────
// Sunucudan Kampanya Verisi Çekme
// ────────────────────────────────────────────

async function fetchCampaignConfig(): Promise<IconCampaignConfig | null> {
  try {
    const url = getCampaignUrl();
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache' },
    });

    if (!response.ok) {
      console.warn(`[IconCampaign] API yanıt hatası: ${response.status}`);
      return null;
    }

    const data: IconCampaignConfig = await response.json();
    if (!data.success || !Array.isArray(data.ozel_gunler)) {
      console.warn('[IconCampaign] API yanıtı geçersiz:', data);
      return null;
    }

    return data;
  } catch (error) {
    console.error('[IconCampaign] API isteği başarısız:', error);
    return null;
  }
}

// ────────────────────────────────────────────
// Aktif Kampanya Bulma
// ────────────────────────────────────────────

function findActiveCampaign(config: IconCampaignConfig): OzelGun | null {
  const now = new Date();

  for (const gun of config.ozel_gunler) {
    const start = new Date(gun.baslama_tarihi);
    const end = new Date(gun.bitis_tarihi);

    if (now >= start && now <= end) {
      // Platform'a göre dosyaların var olup olmadığını kontrol et
      const platformInfo = Platform.OS === 'ios' ? gun.ios : gun.android;
      if (platformInfo.dosyalar && platformInfo.dosyalar.length > 0) {
        return gun;
      }
    }
  }

  return null;
}

// ────────────────────────────────────────────
// Kampanya ID oluştur (benzersiz tanımlama için)
// ────────────────────────────────────────────

function getCampaignId(campaign: OzelGun): string {
  const platformInfo = Platform.OS === 'ios' ? campaign.ios : campaign.android;
  return `${platformInfo.tema}_${campaign.baslama_tarihi}_${campaign.bitis_tarihi}`;
}

// ────────────────────────────────────────────
// Önizleme Görsel URL'si
// ────────────────────────────────────────────

function getPreviewImageUrl(campaign: OzelGun): string | null {
  const platformInfo = Platform.OS === 'ios' ? campaign.ios : campaign.android;
  if (!platformInfo.dosyalar || platformInfo.dosyalar.length === 0) return null;

  // En büyük ikonu önizleme için seç
  if (Platform.OS === 'ios') {
    const largeIcon = platformInfo.dosyalar.find(f => f.includes('1024x1024'))
      || platformInfo.dosyalar.find(f => f.includes('60x60@3x'))
      || platformInfo.dosyalar[0];
    return platformInfo.base_url + largeIcon;
  } else {
    const largeIcon = platformInfo.dosyalar.find(f => f.includes('xxxhdpi'))
      || platformInfo.dosyalar[platformInfo.dosyalar.length - 1];
    return platformInfo.base_url + largeIcon;
  }
}

// ────────────────────────────────────────────
// Ana Kontrol Fonksiyonu
// ────────────────────────────────────────────

export async function checkIconCampaign(): Promise<CampaignCheckResult> {
  const defaultResult: CampaignCheckResult = {
    hasActiveCampaign: false,
    campaign: null,
    tema: null,
    previewImageUrl: null,
    shouldPromptUser: false,
    shouldResetToDefault: false,
  };

  try {
    // Alternate icon desteği kontrolü
    if (!supportsAlternateIcons()) {
      return defaultResult;
    }

    // Sunucu verisini çek
    const config = await fetchCampaignConfig();
    if (!config) return defaultResult;

    // Aktif kampanya bul
    const activeCampaign = findActiveCampaign(config);
    const currentIcon = getCurrentIcon();
    const savedTema = await AsyncStorage.getItem(STORAGE_KEY_ACTIVE_TEMA);

    // Aktif kampanya yok
    if (!activeCampaign) {
      // Varsayılan olmayan bir ikon aktifse, geri dön
      if (currentIcon !== null || (savedTema && savedTema !== 'default')) {
        return {
          ...defaultResult,
          shouldResetToDefault: true,
        };
      }
      return defaultResult;
    }

    // Aktif kampanya var
    const platformInfo = Platform.OS === 'ios' ? activeCampaign.ios : activeCampaign.android;
    const tema = platformInfo.tema;
    const campaignId = getCampaignId(activeCampaign);

    // İkon zaten doğru temada mı?
    if (currentIcon === tema) {
      return {
        hasActiveCampaign: true,
        campaign: activeCampaign,
        tema,
        previewImageUrl: getPreviewImageUrl(activeCampaign),
        shouldPromptUser: false,
        shouldResetToDefault: false,
      };
    }

    // Bu özel gün için kullanıcıya daha önce sorulmuş mu?
    const savedCampaignId = await AsyncStorage.getItem(STORAGE_KEY_LAST_CAMPAIGN);
    if (savedCampaignId === campaignId) {
      // Bu özel gün için kullanıcıya zaten 1 defa sorulmuş (kabul veya red). Tekrar sorma!
      return {
        hasActiveCampaign: true,
        campaign: activeCampaign,
        tema,
        previewImageUrl: getPreviewImageUrl(activeCampaign),
        shouldPromptUser: false,
        shouldResetToDefault: false,
      };
    }

    // Kullanıcıya sor
    return {
      hasActiveCampaign: true,
      campaign: activeCampaign,
      tema,
      previewImageUrl: getPreviewImageUrl(activeCampaign),
      shouldPromptUser: true,
      shouldResetToDefault: false,
    };
  } catch (error) {
    console.error('[IconCampaign] Kampanya kontrol hatası:', error);
    return defaultResult;
  }
}

// ────────────────────────────────────────────
// Kampanya İkonunu Uygula
// ────────────────────────────────────────────

export async function applyIconCampaign(campaign: OzelGun): Promise<boolean> {
  try {
    const platformInfo = Platform.OS === 'ios' ? campaign.ios : campaign.android;
    const tema = platformInfo.tema;
    const campaignId = getCampaignId(campaign);

    const success = await setAppIcon(tema);

    if (success) {
      await AsyncStorage.setItem(STORAGE_KEY_LAST_CAMPAIGN, campaignId);
      await AsyncStorage.setItem(STORAGE_KEY_USER_CHOICE, 'accepted');
      await AsyncStorage.setItem(STORAGE_KEY_ACTIVE_TEMA, tema);
      console.log(`[IconCampaign] İkon "${tema}" olarak güncellendi.`);
    }

    return success;
  } catch (error) {
    console.error('[IconCampaign] İkon uygulama hatası:', error);
    return false;
  }
}

// ────────────────────────────────────────────
// Kampanya Reddi Kaydet
// ────────────────────────────────────────────

export async function rejectIconCampaign(campaign: OzelGun): Promise<void> {
  try {
    const campaignId = getCampaignId(campaign);
    await AsyncStorage.setItem(STORAGE_KEY_LAST_CAMPAIGN, campaignId);
    await AsyncStorage.setItem(STORAGE_KEY_USER_CHOICE, 'rejected');
    console.log(`[IconCampaign] Kampanya "${campaign.ozel_gun_adi}" reddedildi.`);
  } catch (error) {
    console.error('[IconCampaign] Red kaydetme hatası:', error);
  }
}

// ────────────────────────────────────────────
// Varsayılan İkona Dön
// ────────────────────────────────────────────

export async function resetToDefaultIcon(): Promise<boolean> {
  try {
    const success = await setAppIcon(null);

    if (success) {
      await AsyncStorage.setItem(STORAGE_KEY_ACTIVE_TEMA, 'default');
      await AsyncStorage.removeItem(STORAGE_KEY_LAST_CAMPAIGN);
      await AsyncStorage.removeItem(STORAGE_KEY_USER_CHOICE);
      console.log('[IconCampaign] Varsayılan ikona dönüldü.');
    }

    return success;
  } catch (error) {
    console.error('[IconCampaign] Varsayılan ikona dönüş hatası:', error);
    return false;
  }
}
