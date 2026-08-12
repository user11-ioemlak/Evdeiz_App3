@echo off
setlocal enabledelayedexpansion
title Prototype - Derleme ve Yonetim Paneli
color 0A

:MENU
cls
set REPO_NAME=
set CURR_ENV=
set CURR_BUILD_URL=
set GH_USER=
for /f "tokens=1,* delims==" %%A in ('node update-app-info.js --get-env') do (
    if "%%A"=="MEVCUT_ENV" set CURR_ENV=%%B
    if "%%A"=="MEVCUT_BUILD_URL" set CURR_BUILD_URL=%%B
    if "%%A"=="MEVCUT_ACTIVE_URL" if "!CURR_BUILD_URL!"=="" set CURR_BUILD_URL=%%B
)
for /f "tokens=1,* delims==" %%A in ('node update-app-info.js --get-repo') do (
    if "%%A"=="MEVCUT_REPO" set REPO_NAME=%%B
)
for /f "tokens=*" %%U in ('call gh api user --jq .login 2^>nul') do set GH_USER=%%U

if "!REPO_NAME!"=="" set REPO_NAME=user07-ioemlak/Prototype
if "!CURR_ENV!"=="" set CURR_ENV=live
if "!CURR_BUILD_URL!"=="" set CURR_BUILD_URL=https://ioemlak.com/
if "!GH_USER!"=="" set GH_USER=Oturum Acilmadi

echo ======================================================
echo         EVDE IZ - DERLEME VE YONETIM PANELI
echo ======================================================
echo  Aktif Mod    : !CURR_ENV! [!CURR_BUILD_URL!]
echo  GitHub Hesabi: !GH_USER!
echo ======================================================
echo.
echo   1. GitHub'a Yukle ve Bulut Derlemesini Baslat
echo   2. Derleme Durumunu Kontrol Et
echo   3. Derlenen APK / IPA Dosyalarini Indir
echo   4. GitHub Sayfasini Tarayicida Ac
echo   5. Yerel Gelistirme Sunucusunu Baslat
echo   6. Tek Platform Derle (Sadece Android / Sadece iOS)
echo   7. Uygulama Bilgilerini Guncelle (Isim, Surum, Package ID, Repo)
echo   8. Derleme Modunu ve Canli Site Adresini Degistir (Test / Live)
echo   9. GitHub Hesabini Degistir / Bagla (Oturum Ac / Kapat / Durum)
echo  10. Ozellestirmeler ve Gelismis Ayarlar (Secret Token, User-Agent, Zoom, Oryantasyon)
echo   0. Cikis
echo.
echo ======================================================
set /p SECIM=Yapmak istediginiz islemi secin [0-10]: 

if "%SECIM%"=="1" goto GIT_PUSH
if "%SECIM%"=="2" goto CHECK_BUILD
if "%SECIM%"=="3" goto DOWNLOAD
if "%SECIM%"=="4" goto OPEN_GITHUB
if "%SECIM%"=="5" goto DEV_SERVER
if "%SECIM%"=="6" goto SINGLE_BUILD
if "%SECIM%"=="7" goto UPDATE_CONFIG
if "%SECIM%"=="8" goto UPDATE_ENV
if "%SECIM%"=="9" goto GITHUB_AUTH
if "%SECIM%"=="10" goto CUSTOM_SETTINGS
if "%SECIM%"=="0" exit /b
goto MENU

:GIT_PUSH
cls
echo ======================================================
echo  1. GITHUB'A YUKLE VE DERLEME BASLAT
echo ======================================================
echo.
set CURR_ENV=
set CURR_BUILD_URL=
for /f "tokens=1,* delims==" %%A in ('node update-app-info.js --get-env') do (
    if "%%A"=="MEVCUT_ENV" set CURR_ENV=%%B
    if "%%A"=="MEVCUT_BUILD_URL" set CURR_BUILD_URL=%%B
)

echo Aktif Derleme Modu: !CURR_ENV! [!CURR_BUILD_URL!]
echo.
echo Derleme Modu Secin:
echo   1. Ayni Modla Devam Et (!CURR_ENV!: !CURR_BUILD_URL!)
echo   2. Test Moduna Gec (test - Yerel IP/Port)
echo   3. Canli Moda Gec (live)
echo.
set /p QUICK_ENV=Mod seciminiz [1-3, varsayilan 1]: 
if "%QUICK_ENV%"=="2" goto QUICK_TEST_PROMPT
if "%QUICK_ENV%"=="3" node update-app-info.js --set-env live https://ioemlak.com/
goto AFTER_QUICK_ENV

:QUICK_TEST_PROMPT
echo.
echo Test Modu - Yerel Sunucu IP ve Port Bilgileri:
set /p LOCAL_IP=Yerel Sunucu IP Adresi / Hostname [varsayilan: 192.168.1.35]: 
if "!LOCAL_IP!"=="" set LOCAL_IP=192.168.1.35
set /p LOCAL_PORT=Yerel Sunucu Portu [varsayilan: 80]: 
if "!LOCAL_PORT!"=="" set LOCAL_PORT=80
if "!LOCAL_PORT!"=="80" (
    set Q_URL=http://!LOCAL_IP!/
) else (
    set Q_URL=http://!LOCAL_IP!:!LOCAL_PORT!/
)
node update-app-info.js --set-env test !Q_URL!

:AFTER_QUICK_ENV

echo.
if not exist ".git" (
    echo [BILGI] Git reposu ilklendiriliyor...
    git init
    git branch -M main
    git remote add origin https://github.com/!REPO_NAME!.git
)

git config user.name >nul 2>&1
if %errorlevel% neq 0 (
    git config user.name "user07-ioemlak"
    git config user.email "user07-ioemlak@users.noreply.github.com"
)

set /p COMMIT_MSG=Commit aciklamasi (bos birakirsaniz 'Guncelleme' olur): 
if "%COMMIT_MSG%"=="" set COMMIT_MSG=Guncelleme

echo.
echo [1/3] Dosyalar hazirlaniyor...
git add .
echo [2/3] Commit olusturuluyor...
git commit -m "%COMMIT_MSG%"
echo [3/3] GitHub'a yukleniyor...
git push origin HEAD
if %errorlevel% neq 0 (
    echo.
    echo [HATA] GitHub'a gonderilemedi!
    pause
    goto MENU
)
echo.
echo [4/4] GitHub Actions derleme gorevi tetikleniyor...
call gh workflow run build.yml --repo !REPO_NAME! -f platform=all >nul 2>&1

echo.
echo [BASARILI] Kod GitHub'a yuklendi ve derleme baslatildi!
echo Android APK ve iOS IPA derlemesi otomatik olarak calisiyor.
echo.
echo Canli derleme sayfasi aciliyor...
start https://github.com/!REPO_NAME!/actions
echo.
pause
goto MENU

:CHECK_BUILD
cls
echo ======================================================
echo  2. DERLEME DURUMU (CANLI OTOMATIK YENILEME)
echo ======================================================
echo.
echo Son derleme islemleri:
echo ------------------------------------------------------
echo.
call gh run list --repo !REPO_NAME! --limit 5
echo.
echo ------------------------------------------------------
echo Son Yenileme: %TIME:~0,8%
echo.
echo   [Q] Ana Menuye Don
echo   [Hicbir sey yapmazsaniz 5 saniye icinde otomatik yenilenir]
echo.
choice /c QR /t 5 /d R /m "Seciminiz [Q: Menuye Don]:" >nul
if %errorlevel% equ 1 goto MENU
goto CHECK_BUILD

:DOWNLOAD
cls
echo ======================================================
echo  3. DERLENEN DOSYALARI INDIR
echo ======================================================
echo.
if not exist "ciktilar" mkdir "ciktilar"

echo Son derleme paketleri:
echo ------------------------------------------------------
call gh run list --repo !REPO_NAME! --limit 5
echo ------------------------------------------------------
echo.
echo   [Enter] : En son tamamlanan derlemenin dosyalarini indir (Varsayilan)
echo   [Run ID]: Yukarida listelenen spesifik bir Run ID girin (Ornek: 31369773204)
echo   [0]      : Ana Menuye Don
echo.
set RUN_ID=
set /p RUN_ID=Indirmek istediginiz Run ID veya [Enter]: 

if "%RUN_ID%"=="0" goto MENU

echo.
echo Eski dosyalar temizleniyor ve yenileri indiriliyor...
del /q /f "ciktilar\*.*" 2>nul
for /d %%D in ("ciktilar\*") do rmdir /s /q "%%D" 2>nul

if "%RUN_ID%"=="" (
    call gh run download --repo !REPO_NAME! --dir "ciktilar"
) else (
    call gh run download %RUN_ID% --repo !REPO_NAME! --dir "ciktilar"
)

if %errorlevel% equ 0 (
    echo.
    echo [BASARILI] APK ve IPA dosyalari 'ciktilar' klasorune indirildi!
    explorer "ciktilar"
) else (
    echo.
    echo [BILGI] Belirtilen derleme indirilemedi veya henuz tamamlanmis bir derleme bulunamadi.
    echo Lutfen Actions sayfasinda derlemenin bitmesini bekleyin.
)
echo.
pause
goto MENU

:OPEN_GITHUB
cls
echo GitHub sayfalari aciliyor...
start https://github.com/!REPO_NAME!
start https://github.com/!REPO_NAME!/actions
goto MENU

:DEV_SERVER
cls
echo ======================================================
echo  5. YEREL GELISTIRME SUNUCUSU
echo ======================================================
echo.
echo Expo gelistirme sunucusu baslatiliyor...
echo (Kapatmak icin Ctrl+C basin)
echo.
call npx expo start
pause
goto MENU

:SINGLE_BUILD
cls
echo ======================================================
echo  6. TEK PLATFORM DERLEME
echo ======================================================
echo.
echo   1. Sadece Android APK Derle
echo   2. Sadece iOS IPA Derle
echo   3. Her Ikisini Birden Derle
echo   0. Ana Menuye Don
echo.
echo ======================================================
set /p PLATFORM_SEC=Platform secin [0-3]: 

if "%PLATFORM_SEC%"=="1" set PLATFORM=android
if "%PLATFORM_SEC%"=="2" set PLATFORM=ios
if "%PLATFORM_SEC%"=="3" set PLATFORM=all
if "%PLATFORM_SEC%"=="0" goto MENU

if not defined PLATFORM (
    echo [HATA] Gecersiz secim!
    pause
    goto SINGLE_BUILD
)

echo.
echo [BILGI] Secilen platform: %PLATFORM%
echo.
echo Derleme baslatiliyor...
call gh workflow run build.yml --repo !REPO_NAME! -f platform=%PLATFORM%
if %errorlevel% neq 0 (
    echo.
    echo [HATA] Derleme baslatilamadi!
    echo GitHub CLI (gh) yuklu ve oturum acik oldugundan emin olun.
    set PLATFORM=
    pause
    goto MENU
)
echo.
echo [BASARILI] %PLATFORM% derlemesi baslatildi!
echo Derleme durumunu kontrol etmek icin 2 numarali secenegi kullanin.
echo.
echo Actions sayfasi aciliyor...
start https://github.com/!REPO_NAME!/actions
set PLATFORM=
echo.
pause
goto MENU

:UPDATE_CONFIG
cls
echo ======================================================
echo  7. UYGULAMA BILGILERINI GUNCELLE
echo ======================================================
echo.
set CURR_NAME=
set CURR_VER=
set CURR_BUNDLE=
set CURR_REPO=
set CURR_REPO_SLUG=

for /f "tokens=1,* delims==" %%A in ('node update-app-info.js --get') do (
    if "%%A"=="MEVCUT_NAME" set CURR_NAME=%%B
    if "%%A"=="MEVCUT_VERSION" set CURR_VER=%%B
    if "%%A"=="MEVCUT_BUNDLE_ID" set CURR_BUNDLE=%%B
    if "%%A"=="MEVCUT_REPO" set CURR_REPO=%%B
    if "%%A"=="MEVCUT_REPO_SLUG" set CURR_REPO_SLUG=%%B
)

if "!CURR_REPO_SLUG!"=="" set CURR_REPO_SLUG=Evdeiz_App2

echo Mevcut Bilgiler:
echo   Uygulama Adi     : !CURR_NAME!
echo   Surum            : !CURR_VER!
echo   Package/Bundle ID: !CURR_BUNDLE!
echo   Bagli GitHub User: !GH_USER!
echo   Repository Adi   : !CURR_REPO_SLUG!  (Tam Ad: !GH_USER!/!CURR_REPO_SLUG!)
echo.
echo (Degistirmek istemediginiz alanlarda ENTER'a basarak gecin)
echo.
set /p NEW_NAME=Yeni Uygulama Adi [!CURR_NAME!]: 
set /p NEW_VER=Yeni Surum [!CURR_VER!]: 
set /p NEW_BUNDLE=Yeni Package/Bundle ID [!CURR_BUNDLE!]: 
set /p NEW_REPO_SLUG=Yeni Repository Adi (!GH_USER!/...) [!CURR_REPO_SLUG!]: 

if "!NEW_NAME!"=="" set NEW_NAME=-
if "!NEW_VER!"=="" set NEW_VER=-
if "!NEW_BUNDLE!"=="" set NEW_BUNDLE=-
if "!NEW_REPO_SLUG!"=="" set NEW_REPO_SLUG=-

node update-app-info.js --set "!NEW_NAME!" "!NEW_VER!" "!NEW_BUNDLE!" "!NEW_REPO_SLUG!"

echo.
echo [BASARILI] Uygulama ve Repository bilgileri guncellendi!
echo.
pause
goto MENU

:UPDATE_ENV
cls
echo ======================================================
echo  8. DERLEME MODU VE ADRESINI GUNCELLE (buildEnv / buildUrl)
echo ======================================================
echo.
set CURR_ENV=
set CURR_BUILD_URL=

for /f "tokens=1,* delims==" %%A in ('node update-app-info.js --get-env') do (
    if "%%A"=="MEVCUT_ENV" set CURR_ENV=%%B
    if "%%A"=="MEVCUT_BUILD_URL" set CURR_BUILD_URL=%%B
)

echo Mevcut Ayarlar:
echo ------------------------------------------------------
echo   Aktif Derleme Modu (buildEnv) : !CURR_ENV!
echo   Hedef Baglanti URL (buildUrl) : !CURR_BUILD_URL!
echo ------------------------------------------------------
echo.
echo Yapmak istediginiz islem:
echo   1. Derleme Modunu Degistir (live / test)
echo   2. Hedef Baglanti URL (buildUrl) Degistir
echo   3. Her Ikisini de Degistir
echo   0. Ana Menuye Don
echo.
set /p ENV_OPTION=Seciminiz [0-3]: 

if "%ENV_OPTION%"=="0" goto MENU
if "%ENV_OPTION%"=="1" goto ENV_OPT1
if "%ENV_OPTION%"=="2" goto ENV_OPT2
if "%ENV_OPTION%"=="3" goto ENV_OPT3
goto MENU

:ENV_OPT1
set NEW_MODE=!CURR_ENV!
set NEW_URL=-
echo.
echo Mod Secimi:
echo   1. Canli Mod (live)
echo   2. Test Modu (test)
set /p M_CHOICE=Seciminiz [1-2]: 
if "!M_CHOICE!"=="1" goto SET_LIVE_SUB
if "!M_CHOICE!"=="2" goto SET_TEST_SUB
goto APPLY_ENV

:ENV_OPT2
set NEW_MODE=!CURR_ENV!
set NEW_URL=-
echo.
set /p NEW_URL=Yeni Hedef URL (buildUrl) [!CURR_BUILD_URL!]: 
goto APPLY_ENV

:ENV_OPT3
set NEW_MODE=!CURR_ENV!
set NEW_URL=-
echo.
echo Mod Secimi:
echo   1. Canli Mod (live)
echo   2. Test Modu (test)
set /p M_CHOICE=Seciminiz [1-2]: 
if "!M_CHOICE!"=="1" goto SET_LIVE_SUB
if "!M_CHOICE!"=="2" goto SET_TEST_SUB
goto APPLY_ENV

:SET_LIVE_SUB
set NEW_MODE=live
echo.
set /p CANLI_URL=Canli Sunucu URL (buildUrl) [varsayilan: https://ioemlak.com/]: 
if "!CANLI_URL!"=="" set CANLI_URL=https://ioemlak.com/
set NEW_URL=!CANLI_URL!
goto APPLY_ENV

:SET_TEST_SUB
set NEW_MODE=test
echo.
echo Test Modu - Yerel Sunucu IP ve Port Bilgileri:
set /p LOCAL_IP=Yerel Sunucu IP Adresi / Hostname [varsayilan: 192.168.1.35]: 
if "!LOCAL_IP!"=="" set LOCAL_IP=192.168.1.35
set /p LOCAL_PORT=Yerel Sunucu Portu [varsayilan: 80]: 
if "!LOCAL_PORT!"=="" set LOCAL_PORT=80
if "!LOCAL_PORT!"=="80" (
    set NEW_URL=http://!LOCAL_IP!/
) else (
    set NEW_URL=http://!LOCAL_IP!:!LOCAL_PORT!/
)
goto APPLY_ENV

:APPLY_ENV
if "!NEW_URL!"=="" set NEW_URL=-
node update-app-info.js --set-env "!NEW_MODE!" "!NEW_URL!"

echo.
echo [BASARILI] buildEnv ve buildUrl guncellendi!
echo.
pause
goto MENU

:GITHUB_AUTH
cls
echo ======================================================
echo  9. GITHUB HESABINI DEGISTIR VE BAGLA
echo ======================================================
echo.
echo Mevcut GitHub Oturum Durumu:
echo ------------------------------------------------------
call gh auth status
echo ------------------------------------------------------
echo.
echo   1. Yeni GitHub Hesabi ile Oturum Ac / Degistir (CLI)
echo   2. Web Tarayicisi Uzerinden GitHub Hesabi Bagla
echo   3. Mevcut GitHub Oturumunu Kapat (gh auth logout)
echo   0. Ana Menuye Don
echo.
echo ======================================================
set /p GH_OPT=Seciminiz [0-3]: 

if "%GH_OPT%"=="0" goto MENU

if "%GH_OPT%"=="1" (
    echo.
    echo GitHub CLI Oturum Acma / Degistirme Baslatiliyor...
    call gh auth login
    pause
    goto MENU
)

if "%GH_OPT%"=="2" (
    echo.
    echo Tarayici ile GitHub Girisi Baslatiliyor...
    call gh auth login --web
    pause
    goto MENU
)

if "%GH_OPT%"=="3" (
    echo.
    echo GitHub Oturumu Kapatiliyor...
    call gh auth logout
    pause
    goto MENU
)

goto MENU

:CUSTOM_SETTINGS
cls
echo ======================================================
echo  10. OZELLESTIRMELER VE GELISMIS AYARLAR
echo ======================================================
echo.
set CURR_TOKEN=
set CURR_UA_PRE=
set CURR_ZOOM=
set CURR_ORI=

for /f "tokens=1,* delims==" %%A in ('node update-app-info.js --get-custom') do (
    if "%%A"=="MEVCUT_SECRET_TOKEN" set CURR_TOKEN=%%B
    if "%%A"=="MEVCUT_UA_PREFIX" set CURR_UA_PRE=%%B
    if "%%A"=="MEVCUT_DISABLE_ZOOM" set CURR_ZOOM=%%B
    if "%%A"=="MEVCUT_ORIENTATION" set CURR_ORI=%%B
)

if "!CURR_TOKEN!"=="" set CURR_TOKEN=Evdeiz_Secure_App_Key_2026_x87f
if "!CURR_UA_PRE!"=="" set CURR_UA_PRE=EvdeizApp
if "!CURR_ZOOM!"=="" set CURR_ZOOM=true
if "!CURR_ORI!"=="" set CURR_ORI=portrait

set ZOOM_TXT=Aktif (Zoom Yapilamaz)
if "!CURR_ZOOM!"=="false" set ZOOM_TXT=Pasif (Zoom Yapilabilir)

echo Mevcut Ozellestirme Ayarlari:
echo ------------------------------------------------------
echo   1. App Secret Token  : !CURR_TOKEN!
echo   2. User-Agent On Eki : !CURR_UA_PRE!
echo   3. Zoom Engelleme    : !ZOOM_TXT!
echo   4. Ekran Oryantasyon : !CURR_ORI!
echo ------------------------------------------------------
echo.
echo Yapmak istediginiz islem:
echo   1. App Secret Token Degistir
echo   2. User-Agent On Eki Degistir
echo   3. Zoom Engelleme Durumunu Degistir (Ac / Kapat)
echo   4. Ekran Oryantasyonunu Degistir (portrait / landscape / default)
echo   5. Tum Ayarlari Degistir
echo   0. Ana Menuye Don
echo.
echo ======================================================
set /p CUST_OPT=Seciminiz [0-5]: 

if "%CUST_OPT%"=="0" goto MENU
if "%CUST_OPT%"=="1" goto CUST_OPT1
if "%CUST_OPT%"=="2" goto CUST_OPT2
if "%CUST_OPT%"=="3" goto CUST_OPT3
if "%CUST_OPT%"=="4" goto CUST_OPT4
if "%CUST_OPT%"=="5" goto CUST_OPT5
goto MENU

:CUST_OPT1
set N_TOKEN=-
set N_UA=-
set N_ZOOM=-
set N_ORI=-
echo.
set /p N_TOKEN=Yeni App Secret Token [!CURR_TOKEN!]: 
goto APPLY_CUST

:CUST_OPT2
set N_TOKEN=-
set N_UA=-
set N_ZOOM=-
set N_ORI=-
echo.
set /p N_UA=Yeni User-Agent On Eki [!CURR_UA_PRE!]: 
goto APPLY_CUST

:CUST_OPT3
set N_TOKEN=-
set N_UA=-
set N_ZOOM=-
set N_ORI=-
echo.
echo Zoom Engelleme Secimi:
echo   1. Zoom Engelle (Aktif - Zoom Yapilamaz)
echo   2. Zoom Izin Ver (Pasif - Zoom Yapilabilir)
set /p Z_CHOICE=Seciminiz [1-2]: 
if "!Z_CHOICE!"=="1" set N_ZOOM=true
if "!Z_CHOICE!"=="2" set N_ZOOM=false
goto APPLY_CUST

:CUST_OPT4
set N_TOKEN=-
set N_UA=-
set N_ZOOM=-
set N_ORI=-
echo.
echo Ekran Oryantasyonu Secimi:
echo   1. Dikey (portrait)
echo   2. Yatay (landscape)
echo   3. Otomatik (default)
set /p O_CHOICE=Seciminiz [1-3]: 
if "!O_CHOICE!"=="1" set N_ORI=portrait
if "!O_CHOICE!"=="2" set N_ORI=landscape
if "!O_CHOICE!"=="3" set N_ORI=default
goto APPLY_CUST

:CUST_OPT5
set N_TOKEN=-
set N_UA=-
set N_ZOOM=-
set N_ORI=-
echo.
set /p N_TOKEN=Yeni App Secret Token [!CURR_TOKEN!]: 
set /p N_UA=Yeni User-Agent On Eki [!CURR_UA_PRE!]: 
echo.
echo Zoom Engelleme Secimi [1: Engelle, 2: Izin Ver]:
set /p Z_CHOICE=Seciminiz [1-2]: 
if "!Z_CHOICE!"=="1" set N_ZOOM=true
if "!Z_CHOICE!"=="2" set N_ZOOM=false
echo.
echo Ekran Oryantasyonu [1: portrait, 2: landscape, 3: default]:
set /p O_CHOICE=Seciminiz [1-3]: 
if "!O_CHOICE!"=="1" set N_ORI=portrait
if "!O_CHOICE!"=="2" set N_ORI=landscape
if "!O_CHOICE!"=="3" set N_ORI=default
goto APPLY_CUST

:APPLY_CUST
if "!N_TOKEN!"=="" set N_TOKEN=-
if "!N_UA!"=="" set N_UA=-
if "!N_ZOOM!"=="" set N_ZOOM=-
if "!N_ORI!"=="" set N_ORI=-

node update-app-info.js --set-custom "!N_TOKEN!" "!N_UA!" "!N_ZOOM!" "!N_ORI!"

echo.
echo [BASARILI] Ozellestirme ayari guncellendi!
echo.
pause
goto MENU



