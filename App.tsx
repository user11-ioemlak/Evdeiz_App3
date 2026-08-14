import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  BackHandler,
  SafeAreaView,
  StatusBar,
  Platform,
  Image,
  Modal,
  Animated,
  Linking,
  Alert,
} from 'react-native';
import { WebView, WebViewNavigation, WebViewMessageEvent } from 'react-native-webview';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import * as Network from 'expo-network';
import * as Device from 'expo-device';
import { detectEmulator } from './utils/emulatorDetection';
import { detectVpn } from './utils/vpnDetection';
import {
  checkIconCampaign,
  applyIconCampaign,
  rejectIconCampaign,
  resetToDefaultIcon,
  CampaignCheckResult,
} from './utils/iconCampaign';
import appJson from './app.json';

const TARGET_URL = appJson.expo?.extra?.buildUrl || '';
const APP_NAME = appJson.expo?.name || 'Evdeiz';
const APP_VERSION = appJson.expo?.version || '1.0.0';
const APP_SECRET_TOKEN = appJson.expo?.extra?.appSecretToken || 'Evdeiz_Secure_App_Key_2026_x87f';
const USER_AGENT_PREFIX = appJson.expo?.extra?.customUserAgentPrefix || 'EvdeizApp';
const IS_ZOOM_DISABLED = appJson.expo?.extra?.disableZoom !== false;
const CUSTOM_USER_AGENT = `${USER_AGENT_PREFIX}/${APP_VERSION} (${Platform.OS}; ${Device.modelName || 'MobileNativeContainer'})`;

const DISABLE_ZOOM_SCRIPT = `
  (function() {
    try {
      var meta = document.querySelector('meta[name="viewport"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'viewport';
        document.getElementsByTagName('head')[0].appendChild(meta);
      }
      meta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
      
      var style = document.createElement('style');
      style.type = 'text/css';
      style.innerHTML = 'html, body { touch-action: pan-x pan-y; -webkit-text-size-adjust: 100%; } button, a, input, select, textarea, [role="button"] { touch-action: manipulation; }';
      document.head.appendChild(style);
    } catch(e) {}
  })();
  true;
`;

export default function App() {
  const webViewRef = useRef<WebView<{}>>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isNetworkConnected, setIsNetworkConnected] = useState<boolean>(true);
  const [isReady, setIsReady] = useState(false);

  // İkon Kampanya Durumu
  const [showIconModal, setShowIconModal] = useState(false);
  const [campaignResult, setCampaignResult] = useState<CampaignCheckResult | null>(null);
  const modalAnim = useRef(new Animated.Value(0)).current;

  const [deviceInfo, setDeviceInfo] = useState({
    ip: '',
    deviceName: Device.deviceName || '',
    modelName: Device.modelName || Platform.OS,
    osVersion: Device.osVersion || String(Platform.Version),
    brand: Device.brand || '',
    isPhysicalDevice: true,
    isVpnActive: false,
    suspicionScore: 0,
    reasons: [] as string[],
    vpnSuspicionScore: 0,
    vpnReasons: [] as string[],
  });

  const loadDeviceInfo = async () => {
    try {
      const [ip, netState] = await Promise.all([
        Network.getIpAddressAsync().catch(() => ''),
        Network.getNetworkStateAsync().catch(() => null),
      ]);

      const emulatorDetection = detectEmulator(ip || '');
      const vpnDetection = await detectVpn(ip || '');

      setDeviceInfo({
        ip: ip || '',
        deviceName: Device.deviceName || Platform.OS,
        modelName: Device.modelName || Platform.OS,
        osVersion: Device.osVersion || String(Platform.Version),
        brand: Device.brand || Platform.OS,
        isPhysicalDevice: emulatorDetection.isPhysical,
        isVpnActive: vpnDetection.isVpnActive,
        suspicionScore: emulatorDetection.suspicionScore,
        reasons: emulatorDetection.reasons,
        vpnSuspicionScore: vpnDetection.suspicionScore,
        vpnReasons: vpnDetection.reasons,
      });

      if (netState) {
        setIsNetworkConnected(!!(netState.isConnected && netState.isInternetReachable !== false));
      }
    } catch {
      setIsNetworkConnected(true);
    } finally {
      setIsReady(true);
    }

    // İkon Kampanya Kontrolü
    try {
      const result = await checkIconCampaign();
      if (result.shouldResetToDefault) {
        await resetToDefaultIcon();
      } else if (result.shouldPromptUser && result.campaign) {
        setCampaignResult(result);
        setShowIconModal(true);
        Animated.spring(modalAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 65,
          friction: 10,
        }).start();
      }
    } catch (e) {
      console.warn('[App] İkon kampanya kontrolü başarısız:', e);
    }
  };

  useEffect(() => {
    loadDeviceInfo();
  }, []);

  // Android Geri Butonu
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const onBackPress = () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [canGoBack]);

  // WebView'dan gelen PDF indirme / yazdırma mesajlarını işle
  const handleWebViewMessage = useCallback(async (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);

      if (message.type === 'download_pdf' && message.data) {
        // Base64 PDF verisini geçici dosyaya yaz ve paylaşım sheet'i aç
        const filename = message.filename || 'Rapor.pdf';
        const pdfFile = new File(Paths.cache, filename);

        // Base64 içeriği dosyaya yaz
        pdfFile.write(message.data, { encoding: 'base64' });

        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(pdfFile.uri, {
            mimeType: 'application/pdf',
            dialogTitle: 'PDF Raporu Kaydet / Paylaş',
            UTI: 'com.adobe.pdf',
          });
        } else {
          Alert.alert('Bilgi', 'PDF dosyası kaydedildi: ' + pdfFile.uri);
        }
        return;
      }

      if (message.type === 'print_report' && message.html) {
        // Native yazdırma diyaloğu (iOS AirPrint & Android PrintManager)
        await Print.printAsync({
          html: message.html,
        });
        return;
      }

      if (message.type === 'print_as_pdf' && message.html) {
        // HTML'den standart A4 formatında vektörel PDF oluştur ve paylaş
        const filename = message.filename || 'Rapor.pdf';
        const { uri } = await Print.printToFileAsync({
          html: message.html,
          width: 595,   // Standart A4 Point genişliği
          height: 842,  // Standart A4 Point yüksekliği
        });

        // Oluşturulan PDF'i istenen dosya adıyla taşı
        const generatedFile = new File(uri);
        const targetFile = new File(Paths.cache, filename);
        generatedFile.move(targetFile);

        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(targetFile.uri, {
            mimeType: 'application/pdf',
            dialogTitle: 'PDF Raporu Kaydet / Paylaş',
            UTI: 'com.adobe.pdf',
          });
        } else {
          Alert.alert('Bilgi', 'PDF dosyası oluşturuldu: ' + targetFile.uri);
        }
        return;
      }
    } catch (error) {
      console.warn('[App] WebView mesaj işleme hatası:', error);
      Alert.alert(
        'PDF Hatası',
        'PDF işlemi sırasında bir hata oluştu. Lütfen tekrar deneyin.'
      );
    }
  }, []);

  const handleShouldStartLoadWithRequest = (request: { url: string; isTopFrame?: boolean }) => {
    const { url } = request;
    if (!url) return false;

    // 1. İletişim Şemaları (tel:, mailto:, sms:, whatsapp:, facetime:)
    const isCallOrMessage = /^(tel:|mailto:|sms:|whatsapp:|facetime:)/i.test(url);
    if (isCallOrMessage) {
      Linking.openURL(url).catch(err => {
        console.warn('[App] İletişim URL açma hatası:', err);
      });
      return false;
    }

    // 2. Harita Şemaları (geo:, maps:, comgooglemaps:, waze:)
    const isMap = /^(geo:|maps:|comgooglemaps:|waze:)/i.test(url);
    if (isMap) {
      Linking.openURL(url).catch(err => {
        console.warn('[App] Harita URL açma hatası:', err);
      });
      return false;
    }

    // 3. Uygulama içi web sayfaları (TARGET_URL, /yakin/, rapor_pdf vb.) - ASLA DIŞARI ATMA
    const isInternalWeb = url.startsWith(TARGET_URL) || 
      url.includes('ioemlak.com') || 
      url.includes('localhost') || 
      url.includes('/yakin/') || 
      url.includes('/admin/') || 
      url.includes('rapor_pdf') || 
      url.includes('.php');

    if (isInternalWeb) {
      return true; // WebView içinde sorunsuz yükle
    }

    // 4. Intent ve Mağaza Şemaları (intent:, market:, itms-apps:)
    const isStoreOrIntent = /^(intent:|market:|itms-apps:|itms:)/i.test(url);
    if (isStoreOrIntent) {
      Linking.openURL(url).catch(err => {
        console.warn('[App] Intent/Mağaza açma hatası:', err);
      });
      return false;
    }

    // 5. Diğer Standart HTTP/HTTPS Web İstekleri
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return true;
    }

    // 6. Diğer bilinmeyen özel şemalar
    Linking.openURL(url).catch(() => {});
    return false;
  };

  const handleRetry = async () => {
    setIsLoading(true);
    setHasError(false);
    await loadDeviceInfo();
    if (webViewRef.current) {
      webViewRef.current.reload();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.container}>
        {!isReady ? (
          <View style={styles.loadingContainer}>
            <Image
              source={require('./assets/loading.gif')}
              style={styles.loadingGif}
              resizeMode="contain"
            />
            <Text style={styles.loadingText}>Başlatılıyor...</Text>
          </View>
        ) : !hasError ? (
          <WebView<{}>
            ref={webViewRef}
            source={{
              uri: TARGET_URL,
              headers: {
                'X-App-Secret-Key': APP_SECRET_TOKEN,
                'X-App-Version': APP_VERSION,
                'X-App-Platform': Platform.OS,
                'X-App-Local-IP': deviceInfo.ip,
                'X-App-Device-Name': deviceInfo.deviceName,
                'X-App-Device-Model': deviceInfo.modelName,
                'X-App-OS-Version': deviceInfo.osVersion,
                'X-App-Device-Brand': deviceInfo.brand,
                'X-App-Is-Physical-Device': deviceInfo.isPhysicalDevice ? 'true' : 'false',
                'X-App-Is-Vpn-Active': deviceInfo.isVpnActive ? 'true' : 'false',
                'X-App-Suspicion-Score': String(deviceInfo.suspicionScore),
                'X-App-Detection-Reasons': deviceInfo.reasons.join(','),
                'X-App-Vpn-Suspicion-Score': String(deviceInfo.vpnSuspicionScore),
                'X-App-Vpn-Detection-Reasons': deviceInfo.vpnReasons.join(','),
              },
            }}
            userAgent={CUSTOM_USER_AGENT}
            style={styles.webView}
            containerStyle={styles.webViewContainer}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            thirdPartyCookiesEnabled={true}
            sharedCookiesEnabled={true}
            cacheEnabled={true}
            incognito={false}
            cacheMode="LOAD_DEFAULT"
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            allowsBackForwardNavigationGestures={true}
            allowFileAccess={true}
            allowFileAccessFromFileURLs={true}
            allowUniversalAccessFromFileURLs={true}
            geolocationEnabled={true}
            setSupportMultipleWindows={false}
            javaScriptCanOpenWindowsAutomatically={true}
            onOpenWindow={(syntheticEvent) => {
              const { targetUrl } = syntheticEvent.nativeEvent;
              if (targetUrl) {
                // Eğer hedef url app içinde ise webview içinde kalmasını sağla
                if (targetUrl.startsWith(TARGET_URL) || targetUrl.includes('ioemlak.com') || targetUrl.startsWith('/') || !targetUrl.startsWith('http')) {
                  webViewRef.current?.injectJavaScript(`window.location.href = '${targetUrl}'; true;`);
                } else {
                  Linking.openURL(targetUrl).catch(() => {});
                }
              }
            }}
            onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
            originWhitelist={['*']}
            mixedContentMode="always"
            pullToRefreshEnabled={true}
            scalesPageToFit={!IS_ZOOM_DISABLED}
            setBuiltInZoomControls={!IS_ZOOM_DISABLED}
            setDisplayZoomControls={!IS_ZOOM_DISABLED}
            textZoom={100}
            injectedJavaScript={IS_ZOOM_DISABLED ? DISABLE_ZOOM_SCRIPT : undefined}
            onMessage={handleWebViewMessage}
            onNavigationStateChange={(navState: WebViewNavigation) => {
              setCanGoBack(navState.canGoBack);
            }}
            onLoadStart={() => {
              setIsLoading(true);
              setHasError(false);
            }}
            onLoadEnd={() => {
              setIsLoading(false);
            }}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              if (
                nativeEvent?.description?.includes('ERR_UNKNOWN_URL_SCHEME') ||
                nativeEvent?.description?.includes('net::ERR_ABORTED') ||
                nativeEvent?.code === -999
              ) {
                return;
              }
              setIsLoading(false);
              loadDeviceInfo().then(() => {
                setHasError(true);
              });
            }}
          />
        ) : (
          <View style={styles.errorContainer}>
            <View style={styles.errorCard}>
              <Text style={styles.errorIcon}>
                {!isNetworkConnected ? '📡' : '⚠️'}
              </Text>
              <Text style={styles.errorTitle}>
                {!isNetworkConnected ? 'Ağ Bağlantısı Yok' : 'Sunucuya Ulaşılamıyor'}
              </Text>
              <Text style={styles.errorUrl}>{APP_NAME}</Text>

              <Text style={styles.errorDescription}>
                {!isNetworkConnected
                  ? 'Cihazınız bir Wi‑Fi veya mobil veri ağına bağlı görünmüyor. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.'
                  : 'İnternet / ağ bağlantınız var ancak uygulama sunucusu ile iletişim kurulamadı. Lütfen sunucunun aktif ve aynı ağda erişilebilir olduğundan emin olun.'}
              </Text>

              <TouchableOpacity
                style={styles.retryButton}
                onPress={handleRetry}
                activeOpacity={0.8}>
                <Text style={styles.retryButtonText}>
                  {!isNetworkConnected
                    ? 'Ağ Bağlantısını Kontrol Et & Yeniden Dene'
                    : 'Sunucu Bağlantısını Yeniden Dene'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {isLoading && !hasError && (
          <View style={styles.loadingContainer}>
            <Image
              source={require('./assets/loading.gif')}
              style={styles.loadingGif}
              resizeMode="contain"
            />
            <Text style={styles.loadingText}>Yükleniyor...</Text>
          </View>
        )}
      </View>

      {/* Özel Gün İkon Kampanya Modali */}
      <Modal
        visible={showIconModal}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => {
          if (campaignResult?.campaign) {
            rejectIconCampaign(campaignResult.campaign);
          }
          setShowIconModal(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.modalCard,
              {
                transform: [
                  {
                    scale: modalAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1],
                    }),
                  },
                ],
                opacity: modalAnim,
              },
            ]}
          >
            <View style={styles.modalBanner}>
              <Text style={styles.modalBannerEmoji}>🎉</Text>
            </View>

            {campaignResult?.previewImageUrl && (
              <View style={styles.modalIconPreview}>
                <Image
                  source={{ uri: campaignResult.previewImageUrl }}
                  style={styles.modalIconImage}
                  resizeMode="contain"
                />
              </View>
            )}

            <Text style={styles.modalTitle}>
              {campaignResult?.campaign?.ozel_gun_adi || 'Özel Gün'}
            </Text>

            <Text style={styles.modalDescription}>
              Bu özel güne özel tasarlanan uygulama ikonumuzu kullanmak ister misiniz?{' '}
              Özel gün sona erdiğinde ikonunuz otomatik olarak varsayılan haline dönecektir.
            </Text>

            <TouchableOpacity
              style={styles.modalAcceptButton}
              activeOpacity={0.8}
              onPress={async () => {
                if (campaignResult?.campaign) {
                  await applyIconCampaign(campaignResult.campaign);
                }
                setShowIconModal(false);
              }}
            >
              <Text style={styles.modalAcceptText}>✨ İkonu Güncelle</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalRejectButton}
              activeOpacity={0.8}
              onPress={async () => {
                if (campaignResult?.campaign) {
                  await rejectIconCampaign(campaignResult.campaign);
                }
                setShowIconModal(false);
              }}
            >
              <Text style={styles.modalRejectText}>Hayır, Teşekkürler</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  webView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 15,
    color: '#64748B',
    fontWeight: '500',
  },
  loadingGif: {
    width: 120,
    height: 120,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F8FAFC',
  },
  errorCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  errorIcon: {
    fontSize: 54,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorUrl: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  errorDescription: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  modalBanner: {
    width: '100%',
    height: 48,
    backgroundColor: '#DC2626',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalBannerEmoji: {
    fontSize: 28,
  },
  modalIconPreview: {
    width: 96,
    height: 96,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modalIconImage: {
    width: '100%',
    height: '100%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  modalAcceptButton: {
    width: '100%',
    backgroundColor: '#DC2626',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  modalAcceptText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  modalRejectButton: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  modalRejectText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
});
