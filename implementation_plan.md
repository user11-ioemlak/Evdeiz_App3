# VPN Tespiti — Kapsamlı İmplementasyon ve Revizyon Planı (iOS + Android)

**Proje:** Evdeiz Sağlık (Expo / React Native WebView Container App)  
**Amaç:** Mevcut `expo-network` tabanlı VPN tespitinin ürettiği **false negative** problemini (Ultrasurf, Psiphon vb. VPN'lerde "VPN Yok" görülmesi) gidermek; iOS Swift ve Android Kotlin native modülü ile çoklu katmanlı VPN tespit ve skorlama mekanizmasını tam ve eksiksiz entegre etmek.

---

## User Review Required

> [!IMPORTANT]
> - **Native Modül Yapısı:** Projede `modules/vpn-detector` dizininde iOS (Swift `getifaddrs()`) ve Android (Kotlin `NetworkInterface` + `ConnectivityManager`) kodlarını barındıran yerel bir Expo Native Modülü kurulacaktır.
> - **Prebuild & CI/CD Uyumlu:** Expo Autolinking sayesinde GitHub Actions üzerindeki `npx expo prebuild` adımı modülü otomatik algılayıp hem iOS (IPA) hem Android (APK) derlemelerine dahil edecektir.
> - **Eşik Değeri:** VPN Şüphe Skoru `suspicionScore >= 40` olduğunda `isVpnActive = true` olarak değerlendirilecektir.

---

## Open Questions

> [!NOTE]
> 1. **Erişim Engelleme Tipi:** VPN tespit edildiğinde backend `index.php` şu an bilgilendirme rozeti göstermektedir. VPN aktif kullanıcıları tamamen engellemek (403 ekranı gösterip içerik vermemek) ister misiniz, yoksa mevcut durumdaki gibi loglama ve canlı skor gösterimi mi devam etsin?

---

## Proposed Changes

### Native VPN Detector Module (`modules/vpn-detector/`)

#### [NEW] [expo-module.config.json](file:///c:/Users/AlperenAKKAYA/Desktop/app.ios/modules/vpn-detector/expo-module.config.json)
Expo Native Modül konfigürasyonu. iOS `VpnDetectorModule` ve Android `com.evdeiz.vpndetector.VpnDetectorModule` tanımlamalarını içerir.

#### [NEW] [VpnDetectorModule.swift](file:///c:/Users/AlperenAKKAYA/Desktop/app.ios/modules/vpn-detector/ios/VpnDetectorModule.swift)
iOS Native Swift modülü:
- POSIX `getifaddrs()` ile aktif ağ arayüzlerinin taranması (`utun`, `ppp`, `ipsec`, `tap`, `tun`, `gpc` prefix kontrolü).
- `CFNetworkCopySystemProxySettings` ile sistem HTTP/HTTPS proxy kontrolü.

#### [NEW] [VpnDetectorModule.kt](file:///c:/Users/AlperenAKKAYA/Desktop/app.ios/modules/vpn-detector/android/src/main/java/com/evdeiz/vpndetector/VpnDetectorModule.kt)
Android Native Kotlin modülü:
- `java.net.NetworkInterface.getNetworkInterfaces()` ile aktif tünel arayüzü taraması (`tun`, `ppp`, `pptp`, `tap`, `p2p`, `wlan-vpn`).
- `ConnectivityManager` üzerinden `TRANSPORT_VPN` bayrağı kontrolü.
- System HTTP Proxy (`http.proxyHost`) kontrolü.

#### [NEW] [index.ts](file:///c:/Users/AlperenAKKAYA/Desktop/app.ios/modules/vpn-detector/index.ts)
JS köprü katmanı. Expo Go veya native bağımlılığı eksik ortamlar için güvenli fallback mekanizmalı `getVpnDetailsNative()` aktarımı.

---

### Frontend Katmanı

#### [NEW] [vpnDetection.ts](file:///c:/Users/AlperenAKKAYA/Desktop/app.ios/utils/vpnDetection.ts)
Çoklu sinyal skorlama motoru:
- Native tünel arayüzü tespiti (Ağırlık: **70**)
- Native Transport VPN / Scoped VPN (Ağırlık: **20**)
- Sistem Proxy tespiti (Ağırlık: **20**)
- `expo-network` `NetworkStateType.VPN` (Ağırlık: **30**)
- Yerel IP anomalisi (`0.0.0.0` / eksik IP) (Ağırlık: **5**)
- Toplam skor hesabı (Max 100) ve `suspicionScore >= 40` eşik kontrolü.

#### [MODIFY] [App.tsx](file:///c:/Users/AlperenAKKAYA/Desktop/app.ios/App.tsx)
- `loadDeviceInfo()` içinde `detectVpn()` asenkron çağrısı.
- WebView header'larına `X-App-Vpn-Suspicion-Score` ve `X-App-Vpn-Detection-Reasons` eklenmesi.

---

### Backend Katmanı

#### [MODIFY] [index.php](file:///c:/Users/AlperenAKKAYA/Desktop/app.ios/index.php)
- `HTTP_X_APP_VPN_SUSPICION_SCORE` ve `HTTP_X_APP_VPN_DETECTION_REASONS` header'larının okunması.
- `securityLog()` güncellenerek VPN skorunun ve tetiklenen sinyallerin loglanması.
- HTML bilgi kartında VPN durumu, skor ve sinyallerin görsel olarak gösterilmesi.

---

## Verification Plan

### Automated Tests
- `npx tsc --noEmit` ile TypeScript tip ve derleme doğrulaması.

### Manual Verification
1. VPN pasif durum testi: Cihaz normal internete bağlıyken `isVpnActive: false`, `vpnSuspicionScore: 0`.
2. Ultrasurf / Proton VPN aktif testi: VPN açıldığında native arayüz tespiti ile `isVpnActive: true`, `vpnSuspicionScore >= 70`.
3. Header doğrulama: `index.php` loglarında ve ekranındaki bilgi kartında `X-App-Vpn-Suspicion-Score` ve sinyal detaylarının doğru aktarıldığının görülmesi.
