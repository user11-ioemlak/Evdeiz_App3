# Prototype - Cross-Platform Sablon Projesi

Node.js tabanli, tek kod tabanindan hem **Android** hem **iOS** uygulama ureten yeniden kullanilabilir proje sablonu.

## Teknolojiler

| Teknoloji | Surum | Aciklama |
|-----------|-------|----------|
| React Native | 0.86.x | Cross-platform mobil framework |
| Expo | 57.x | Gelistirme ve derleme araci |
| TypeScript | 6.x | Tip guvenli JavaScript |
| Node.js | 20.x | Calisma zamani |

## Hizli Baslangi

### Gereksinimler
- [Node.js](https://nodejs.org/) (v20+)
- [Git](https://git-scm.com/)
- [GitHub CLI](https://cli.github.com/) (`gh`)

### Kurulum
```bash
# Bagimliliklari yukle
npm install

# Gelistirme sunucusunu baslat
npx expo start

# Web onizleme
npx expo start --web
```

### Windows Kullanicilari Icin
Proje klasorundeki `derle.bat` dosyasina cift tiklayarak interaktif yonetim panelini acabilirsiniz.

## Klasor Yapisi

```
Prototype/
├── App.tsx                    # Ana uygulama bileseni (Merhaba Dunya)
├── index.ts                   # Uygulama giris noktasi
│
├── src/                       # Kaynak kod
│   ├── constants/             # Sabitler (renkler, boyutlar vb.)
│   │   └── Colors.ts
│   └── utils/                 # Yardimci fonksiyonlar
│       └── platform.ts
│
├── assets/                    # Statik dosyalar (ikon, splash vb.)
│
├── .github/workflows/         # CI/CD
│   └── build.yml              # Android APK + iOS IPA derlemesi
│
├── app.json                   # Expo yapilandirmasi
├── package.json               # Node.js bagimliliklari
├── tsconfig.json              # TypeScript yapilandirmasi
├── derle.bat                  # Windows yonetim paneli
└── README.md                  # Bu dosya
```

## CI/CD - Otomatik Derleme

Her `git push` isleminde GitHub Actions otomatik olarak:

1. **Android APK** derler (Ubuntu runner, Gradle)
2. **iOS IPA** derler (macOS runner, Xcode)

Derlenen dosyalar GitHub Actions Artifacts bolumunden indirilebilir.

### Manuel Tetikleme
GitHub Actions sayfasindan "Run workflow" butonuyla da derleme baslatilabilir.

### Derleme Ciktilari
```
ciktilar/
├── Prototype-Android-APK/
│   └── app-release.apk
└── Prototype-iOS-IPA/
    └── Prototype.ipa
```

## Sablondan Yeni Proje Olusturma

Bu projeyi yeni bir uygulama icin temel almak icin:

1. **Depoyu kopyalayin:**
   ```bash
   gh repo create YeniProjeAdi --private --clone
   # veya
   git clone https://github.com/user07-ioemlak/Prototype.git YeniProjeAdi
   ```

2. **Proje adini degistirin:**
   - `app.json` icindeki `name`, `slug`, `bundleIdentifier`, `package` degerlerini guncelleyin
   - `package.json` icindeki `name` degerini guncelleyin

3. **Uygulamayi gelistirin:**
   - `App.tsx` dosyasini duzenleyin
   - `src/` klasorune yeni bilesenler ekleyin

4. **Derleyin:**
   - `derle.bat` uzerinden veya `git push` ile otomatik

## Lisans

MIT
