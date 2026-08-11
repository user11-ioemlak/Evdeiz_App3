# Emülatör ve Sahte Cihaz Tespiti — Gelişmiş İmplementasyon Planı (Faz 1 & Faz 2)

Bu plan, **Evdeiz (Expo/React Native WebView Container)** uygulaması ve **`index.php` (PHP Backend/Web katmanı)** üzerinde emülatör, sanal makine ve sahte cihaz tespitini çoklu sinyal skorlama motoruna dönüştürerek adım adım hayata geçirmeyi amaçlar.

---

## User Review Required

> [!IMPORTANT]
> **Faz 1 (JS-Only Heuristic Engine):** Herhangi bir native değişiklik gerektirmez. Mevcut Expo build akışı (Expo Go / Prebuild) bozulmadan hemen uygulanabilir.
> 
> **Faz 2 (Google Play Integrity API):** Sunucu taraflı cryptographically signed doğrulama sağlar. EAS Build (Custom Client) ve Google Play Console entegrasyonu gerektirir. İlk etapta Faz 1 tamamlanacaktır.

---

## Open Questions

> [!NOTE]
> 1. **Şüphe Eşiği (Suspicion Threshold):** Başlangıçta eşik skoru `50` olarak belirlenmiştir. Yanlış pozitifleri (örneğin bazı x86 tabanlı Intel Android tabletler) önlemek için ilk 1 hafta sadece loglama modunda çalıştırılması önerilir mi?

---

## Görevler ve Adım Adım Uygulama Adımları (Task List)

### 📌 Task 1: `utils/emulatorDetection.ts` Skorlama Motorunun Oluşturulması
Mevcut `App.tsx` içindeki basit `isDevice` ve kelime arama mantığı modüler, genişletilebilir ve puan bazlı bir skorlama motoruna dönüştürülecek.

- [ ] **Sinyaller ve Ağırlık Sistemi:**
  - `Device.isDevice === false` → **+100 Puan** (Kesin Sanal Cihaz)
  - **Genişletilmiş Keyword Eşleşmesi** (`bluestacks`, `bstk`, `nox`, `memu`, `genymotion`, `koplayer`, `gameloop`, `mumu`, `sdk_google`, `generic_x86`, `vbox`, `vmos`, `ldplayer`, `ranchu`, `goldfish`, `microvirt`, `droid4x`) → **+60 Puan**
  - **Emülatör IP Aralığı** (`10.0.2.x` / `10.0.3.x`) → **+30 Puan**
  - **x86 / x86_64 Mimarisi** (Gerçek mobil cihazlar ezici çoğunlukla `arm64-v8a` kullanır) → **+25 Puan**
  - **Generic Ürün/Model Tanımları** (`generic`, `google_sdk`, `unknown`, `sdk`) → **+20 Puan**
  - **Tam Yuvarlak RAM (Bellek) Boyutu** (`totalMemory` 1024 MB katları) → **+10 Puan**
- [ ] **Eşik Kontrolü:** Toplam skor `50` ve üzeri ise `isPhysical = false` kabul edilir.
- [ ] `EmulatorDetectionResult` arabirimi: `{ isPhysical: boolean, suspicionScore: number, reasons: string[] }`.

---

### 📌 Task 2: `App.tsx` Entegrasyonu ve Yeni Header'ların İletilmesi
- [ ] `loadDeviceInfo()` fonksiyonunda `detectEmulator()` çağrılarak sonuç elde edilecek.
- [ ] WebView isteğine şu header'lar eklenecek:
  - `X-App-Is-Physical-Device`: `"true"` | `"false"`
  - `X-App-Suspicion-Score`: `0-100` arası sayısal değer (örneğin `"65"`)
  - `X-App-Detection-Reasons`: Virgülle ayrılmış tespit nedenleri (örneğin `"keyword_match,emulator_ip,x86_arch"`)

---

### 📌 Task 3: `index.php` Backend Doğrulama, Loglama ve Arayüz Güncellemesi
- [ ] `index.php` tarafında gelen `HTTP_X_APP_SUSPICION_SCORE` ve `HTTP_X_APP_DETECTION_REASONS` header'ları ayrıştırılacak.
- [ ] **Güvenlik Logları (`logs/`):** Başarılı ve engellenen istek loglarına `SUSPICION=65 | REASONS=...` detayları eklenecek.
- [ ] **Cihaz Durum Kartı (Device Status Card):**
  - Sanal Cihaz / Emülatör tespiti durumunda detaylı skor ve tespit nedenleri (badge/pill olarak) görünecek.
  - Şüphe skoruna göre renk derecelendirmesi yapılacaktır (0-20 Yeşil, 21-49 Sarı, 50+ Kırmızı).

---

### 📌 Task 4: Birim Testler ve Eşik Kalibrasyonu
- [ ] `utils/__tests__/emulatorDetection.test.ts` oluşturularak bilinen cihaz mock'ları ile birim testler yazılacak.
- [ ] Gerçek cihazlarda skorun `0-15` aralığında kaldığı, BlueStacks / Nox / AVD üzerinde `50+` olduğu test edilecek.

---

## Proposed Changes

### Core Application (React Native / Expo)

#### [NEW] [emulatorDetection.ts](file:///c:/Users/AlperenAKKAYA/Desktop/app.ios/utils/emulatorDetection.ts)
- Çoklu sinyal skorlama motorunu ve tespit kurallarını içerir.

#### [MODIFY] [App.tsx](file:///c:/Users/AlperenAKKAYA/Desktop/app.ios/App.tsx)
- `loadDeviceInfo` fonksiyonunu `detectEmulator()` modülüne bağlar.
- `<WebView>` headers props alanına `X-App-Suspicion-Score` ve `X-App-Detection-Reasons` ekler.

---

### Backend / Web Layer (PHP)

#### [MODIFY] [index.php](file:///c:/Users/AlperenAKKAYA/Desktop/app.ios/index.php)
- Yeni emülatör skor header'larını okur.
- Güvenlik loglarına skor ve nedenleri ekler.
- Cihaz durum kartında şüphe skorunu ve tespit nedenlerini dinamik olarak gösterir.

---

## Verification Plan

### Automated Tests
- `npx tsc --noEmit`: TypeScript tip kontrollerini gerçekleştirme.

### Manual Verification
1. **BlueStacks / Nox / Android Studio AVD:**
   - Uygulama başlatılır, `index.php` kartında **"🖥️ Sanal Cihaz (Emülatör) - Şüphe Skoru: 85/100"** ve nedenlerin (`keyword_match, emulator_ip`) gösterildiği doğrulanır.
2. **Gerçek Cihaz (Android / iOS):**
   - Uygulama açıldığında **"📱 Gerçek (Fiziksel) Cihaz - Şüphe Skoru: 0/100"** gösterildiği doğrulanır.
