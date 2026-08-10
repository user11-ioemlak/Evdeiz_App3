@echo off
setlocal enabledelayedexpansion
title Prototype - Derleme ve Yonetim Paneli
color 0A

:MENU
cls
set REPO_NAME=
for /f "tokens=1,* delims==" %%A in ('node update-app-info.js --get-repo') do (
    if "%%A"=="MEVCUT_REPO" set REPO_NAME=%%B
)
if "!REPO_NAME!"=="" set REPO_NAME=user07-ioemlak/Prototype

echo ======================================================
echo         PROTOTYPE - DERLEME VE YONETIM PANELI
echo ======================================================
echo.
echo   1. GitHub'a Yukle ve Bulut Derlemesini Baslat
echo   2. Derleme Durumunu Kontrol Et
echo   3. Derlenen APK / IPA Dosyalarini Indir
echo   4. GitHub Sayfasini Tarayicida Ac
echo   5. Yerel Gelistirme Sunucusunu Baslat
echo   6. Tek Platform Derle (Sadece Android / Sadece iOS)
echo   7. Uygulama Bilgilerini Guncelle (Isim, Surum, Package ID, GitHub Repo)
echo   0. Cikis
echo.
echo ======================================================
set /p SECIM=Yapmak istediginiz islemi secin [0-7]: 

if "%SECIM%"=="1" goto GIT_PUSH
if "%SECIM%"=="2" goto CHECK_BUILD
if "%SECIM%"=="3" goto DOWNLOAD
if "%SECIM%"=="4" goto OPEN_GITHUB
if "%SECIM%"=="5" goto DEV_SERVER
if "%SECIM%"=="6" goto SINGLE_BUILD
if "%SECIM%"=="7" goto UPDATE_CONFIG
if "%SECIM%"=="0" exit /b
goto MENU

:GIT_PUSH
cls
echo ======================================================
echo  1. GITHUB'A YUKLE VE DERLEME BASLAT
echo ======================================================
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
echo [BASARILI] Kod GitHub'a yuklendi!
echo Android APK ve iOS IPA derlemesi otomatik baslatildi.
echo.
echo Canli derleme sayfasi aciliyor...
start https://github.com/!REPO_NAME!/actions
echo.
pause
goto MENU

:CHECK_BUILD
cls
echo ======================================================
echo  2. DERLEME DURUMU
echo ======================================================
echo.
echo Son derleme islemleri:
echo.
call gh run list --repo !REPO_NAME! --limit 5
echo.
pause
goto MENU

:DOWNLOAD
cls
echo ======================================================
echo  3. DERLENEN DOSYALARI INDIR
echo ======================================================
echo.
if not exist "ciktilar" mkdir "ciktilar"
echo Dosyalar GitHub'dan indiriliyor...
call gh run download --repo !REPO_NAME! --dir "ciktilar"
if %errorlevel% equ 0 (
    echo.
    echo [BASARILI] APK ve IPA dosyalari 'ciktilar' klasorune indirildi!
    explorer "ciktilar"
) else (
    echo.
    echo [BILGI] Henuz tamamlanmis bir derleme bulunamadi.
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

for /f "tokens=1,* delims==" %%A in ('node update-app-info.js --get') do (
    if "%%A"=="MEVCUT_NAME" set CURR_NAME=%%B
    if "%%A"=="MEVCUT_VERSION" set CURR_VER=%%B
    if "%%A"=="MEVCUT_BUNDLE_ID" set CURR_BUNDLE=%%B
    if "%%A"=="MEVCUT_REPO" set CURR_REPO=%%B
)

echo Mevcut Bilgiler:
echo   Uygulama Adi     : !CURR_NAME!
echo   Surum            : !CURR_VER!
echo   Package/Bundle ID: !CURR_BUNDLE!
echo   GitHub Repository: !CURR_REPO!
echo.
echo (Degistirmek istemediginiz alanlarda ENTER'a basarak gecin)
echo.
set /p NEW_NAME=Yeni Uygulama Adi [!CURR_NAME!]: 
set /p NEW_VER=Yeni Surum [!CURR_VER!]: 
set /p NEW_BUNDLE=Yeni Package/Bundle ID [!CURR_BUNDLE!]: 
set /p NEW_REPO=Yeni GitHub Repository [!CURR_REPO!]: 

if "!NEW_NAME!"=="" set NEW_NAME=-
if "!NEW_VER!"=="" set NEW_VER=-
if "!NEW_BUNDLE!"=="" set NEW_BUNDLE=-
if "!NEW_REPO!"=="" set NEW_REPO=-

node update-app-info.js --set "!NEW_NAME!" "!NEW_VER!" "!NEW_BUNDLE!" "!NEW_REPO!"

echo.
echo [BASARILI] Uygulama ve Repository bilgileri guncellendi!
echo.
pause
goto MENU



