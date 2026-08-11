# Prototype & Evdeiz Sağlık - Cross-Platform Şablon Projesi

Node.js tabanlı, tek kod tabanından hem **Android** hem **iOS** uygulama üreten, gelişmiş güvenlik, cihaz tespiti, dinamik başlık yapısı ve otomatik CI/CD süreçlerine sahip yeniden kullanılabilir cross-platform mobil uygulama şablonu.

---

## 🚀 Öne Çıkan Özellikler

- 🔒 **Güvenli Mobil Katman & Token Doğrulaması:** Sunucu isteklerinde gizli `X-App-Secret-Key`, dinamik `X-App-Version` ve özel `User-Agent` ile yetkisiz erişimleri engelleme.
- 📱 **Gelişmiş Cihaz & Donanım Tespiti (`expo-device` & `expo-network`):**
  - **Sanal Cihaz / Emülatör Tespiti:** (`X-App-Is-Physical-Device` -> `true`/`false`)
  - **Detaylı Cihaz Kimliği:** Model (`X-App-Device-Model`), Marka (`X-App-Device-Brand`), İşletim Sistemi Sürümü (`X-App-OS-Version`), Cihaz Adı (`X-App-Device-Name`).
  - **Ağ İletişimi:** İstemci Dış IP (`REMOTE_ADDR`) ve Yerel Wi-Fi IP Adresi (`X-App-Local-IP`).
- 🚫 **Tam Zoom Engelleme Mantığı:**
  - Native WebView seviyesinde `scalesPageToFit={false}`, `setBuiltInZoomControls={false}`, `setDisplayZoomControls={false}`, `textZoom={100}`.
  - Sayfaya entegre `DISABLE_ZOOM_SCRIPT` (Çift dokunma ve iki parmakla zoom engeli).
  - HTML `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">`.
- 📶 **Akıllı Ağ Bağlantısı Hata Yönetimi:** İnternet yokluğu ile sunucuya ulaşılamama durumunu ayırt eden özel hata ekranları.
- 🎨 **Özel Opak Yükleme Ekranı:** Tam ekran düz beyaz (`#FFFFFF`) arka planda `assets/loading.gif` animasyonu.
- 📐 **Çoklu Çözünürlüklü İkon Yönetimi:**
  - `assets/android_icons/`: LDPI (36x36), MDPI (48x48), HDPI (72x72), XHDPI (96x96), XXHDPI (144x144), XXXHDPI (192x192), TV Banner (320x180).
  - `assets/apple_icons/`: iOS 20pt, 29pt, 40pt, 60pt, 76pt, 83.5pt, 1024pt ve Xcode `Contents.json`.
- 🛠️ **Gelişmiş Windows Yönetim Paneli (`derle.bat`):**
  - **Canlı Derleme Takibi:** Her 5 saniyede bir otomatik yenilenen derleme ekranı.
  - **GitHub Hesap Yönetimi:** Oturum durumu kontrol etme, değiştirme (`gh auth login`/`logout`), tarayıcı ile yetkilendirme.
  - **Dinamik Adres & Mod Yönetimi:** Test (Yerel IP) ve Live (Canlı URL) arasında tek tıkla geçiş.
  - **Otomatik Repository Eşitleme:** Aktif GitHub hesabına göre repository sahibini otomatik güncelleme.

---

## 🛠️ Teknolojiler

| Teknoloji | Sürüm | Açıklama |
|-----------|-------|----------|
| **React Native** | 0.86.x | Cross-platform mobil framework |
| **Expo** | 57.x | Geliştirme ve native prebuild aracı |
| **TypeScript** | 6.x | Tip güvenli JavaScript |
| **Node.js** | 20.x | Çalışma zamanı ve derleme betikleri |
| **expo-device** | 57.x | Cihaz ve emülatör donanım tespiti |
| **expo-network** | 57.x | Ağ durumu ve yerel IP tespiti |
| **PHP (Backend)** | 8.x | Güvenlik doğrulama, rate limit ve HTML katmanı |

---

## ⚡ Hızlı Başlangıç

### Gereksinimler
- [Node.js](https://nodejs.org/) (v20+)
- [Git](https://git-scm.com/)
- [GitHub CLI](https://cli.github.com/) (`gh`)

### Kurulum ve Çalıştırma
```bash
# Bağımlılıkları yükle
npm install

# İkon paketlerini oluştur
powershell -ExecutionPolicy Bypass -File generate-icons.ps1

# Geliştirme sunucusunu başlat
npx expo start

# Web önizleme
npx expo start --web
```

### Windows Kullanıcıları İçin
Proje klasöründeki [derle.bat](file:///c:/Users/AlperenAKKAYA/Desktop/app.ios/derle.bat) dosyasına çift tıklayarak interaktif yönetim panelini açabilirsiniz.

---

## 📁 Klasör Yapısı

```
Prototype/
├── App.tsx                    # Ana WebView uygulama bileşeni ve güvenlik mantığı
├── index.ts                   # Uygulama giriş noktası
├── index.php                  # Güvenlikli backend arayüzü ve sürüm/cihaz doğrulama
│
├── assets/                    # Statik görsel kaynakları
│   ├── loading.gif            # Opak tam ekran yükleme animasyonu
│   ├── android_icons/         # Android density ikonları (ldpi, mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi, tv-banner)
│   └── apple_icons/           # iOS Xcode ikon seti ve Contents.json
│
├── generate-icons.ps1         # Android ve iOS ikonlarını otomatik oluşturan betik
├── copy-app-icons.js          # İkonları native build dizinlerine aktaran betik
├── update-app-info.js         # Ortam ve repository bilgilerini senkronize eden betik
├── derle.bat                  # İnteraktif canlı yönetim paneli
│
├── .github/workflows/         # CI/CD Bulut Otomasyonu
│   └── build.yml              # Android APK + iOS IPA otomatik derlemesi
│
├── app.json                   # Expo yapılandırması
├── package.json               # Node.js bağımlılıkları
└── README.md                  # Proje dokümantasyonu
```

---

## 🔄 CI/CD - Otomatik Bulut Derleme

Her `git push` işleminde veya `derle.bat` üzerinden tetiklendiğinde GitHub Actions otomatik olarak çalışır:

1. **Android APK Derleme:** (Ubuntu runner, Java 17, Gradle `assembleRelease`)
2. **iOS IPA Derleme:** (macOS runner, Xcode `xcodebuild` archive & export)

Derlenen cıktılar GitHub Actions Artifacts bölümünden veya `derle.bat` menü seçeneği **3** ile `ciktilar/` klasörüne indirilebilir.

```
ciktilar/
├── Prototype-Android-APK/
│   └── app-release.apk
└── Prototype-iOS-IPA/
    └── Prototype.ipa
```

---

## 🛠️ Şablondan Yeni Proje Oluşturma

Bu projeyi yeni bir uygulama için temel almak üzere:

1. **Depoyu klonlayın veya yeni repo oluşturun:**
   ```bash
   git clone https://github.com/user13ioemlak/Evdeiz_App2.git YeniProjeAdi
   ```

2. **Uygulama Bilgilerini Güncelleyin:**
   - `derle.bat` dosyasını çalıştırıp **7** seçeneği ile uygulama adını, sürümünü ve paket kimliğini değiştirin.
   - Ya da `node update-app-info.js --set "Yeni Ad" "1.0.0" "com.yeni.app" "YeniRepoAdi"` çalıştırın.

3. **İkonları Yeniden Üretin:**
   - `assets/icon.png` görselinizi değiştirip `generate-icons.ps1` betiğini çalıştırın.

4. **Derleyin:**
   - `derle.bat` üzerinden tek tıkla GitHub'a yükleyip APK & IPA derlemelerini başlatın.

---

## 📄 Lisans

MIT License
