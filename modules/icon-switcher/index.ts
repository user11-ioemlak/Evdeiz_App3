import { requireNativeModule, Platform } from 'expo-modules-core';

// Expo Go / geliştirme ortamında native modül yüklenemezse fallback
let IconSwitcherNative: any = null;
try {
  IconSwitcherNative = requireNativeModule('IconSwitcher');
} catch {
  console.warn('[IconSwitcher] Native modül yüklenemedi — Expo Go ortamında çalışıyor olabilirsiniz.');
}

/**
 * Mevcut aktif ikon temasını döndürür.
 * @returns Tema adı (örn: "19Mayis") veya null (varsayılan ikon aktif)
 */
export function getCurrentIcon(): string | null {
  if (!IconSwitcherNative) return null;
  try {
    return IconSwitcherNative.getCurrentIcon() ?? null;
  } catch {
    return null;
  }
}

/**
 * Uygulama ikonunu belirtilen temaya değiştirir.
 * @param iconName Tema adı (örn: "19Mayis", "30Agustos", "29Ekim") veya null (varsayılan ikona dön)
 * @returns Başarı durumu
 */
export async function setAppIcon(iconName: string | null): Promise<boolean> {
  if (!IconSwitcherNative) {
    console.warn('[IconSwitcher] Native modül mevcut değil, ikon değiştirilemedi.');
    return false;
  }
  try {
    if (Platform.OS === 'ios') {
      return await IconSwitcherNative.setAppIcon(iconName);
    } else {
      return IconSwitcherNative.setAppIcon(iconName);
    }
  } catch (error) {
    console.error('[IconSwitcher] İkon değiştirme hatası:', error);
    return false;
  }
}

/**
 * Cihaz alternate icon desteği sunuyor mu kontrol eder.
 */
export function supportsAlternateIcons(): boolean {
  if (!IconSwitcherNative) return false;
  try {
    return IconSwitcherNative.supportsAlternateIcons() ?? false;
  } catch {
    return false;
  }
}
