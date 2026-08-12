import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  BackHandler,
  SafeAreaView,
  StatusBar,
  Platform,
  Image,
  Modal,
  Animated,
  Dimensions,
} from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
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
    var meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'viewport';
      document.getElementsByTagName('head')[0].appendChild(meta);
    }
    meta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    
    var lastTouchEnd = 0;
    document.addEventListener('touchend', function(event) {
      var now = (new Date()).getTime();
      if (now - lastTouchEnd <= 300) {
        event.preventDefault();
      }
      lastTouchEnd = now;
    }, false);

    document.addEventListener('gesturestart', function(e) {
      e.preventDefault();
    });
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

    // ─── İkon Kampanya Kontrolü ───
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

  // Handle hardware back button on Android
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const onBackPress = () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true; // Prevent app exit
      }
      return false; // Allow standard back (app exit/minimize)
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [canGoBack]);

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
            allowsInlineMediaPlayback={true}
            allowsBackForwardNavigationGestures={true}
            originWhitelist={['*']}
            mixedContentMode="always"
            pullToRefreshEnabled={true}
            scalesPageToFit={!IS_ZOOM_DISABLED}
            setBuiltInZoomControls={!IS_ZOOM_DISABLED}
            setDisplayZoomControls={!IS_ZOOM_DISABLED}
            textZoom={100}
            injectedJavaScript={IS_ZOOM_DISABLED ? DISABLE_ZOOM_SCRIPT : undefined}
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
            onError={() => {
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
                {!isNetworkConnected ? '🌐' : '📡'}
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

      {/* ── Özel Gün İkon Kampanya Modali ── */}
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
            {/* Bayrak/dekorasyon şeridi */}
            <View style={styles.modalBanner}>
              <Text style={styles.modalBannerEmoji}>🇹🇷</Text>
            </View>

            {/* İkon Önizleme */}
            {campaignResult?.previewImageUrl && (
              <View style={styles.modalIconPreview}>
                <Image
                  source={{ uri: campaignResult.previewImageUrl }}
                  style={styles.modalIconImage}
                  resizeMode="contain"
                />
              </View>
            )}

            {/* Kampanya Başlığı */}
            <Text style={styles.modalTitle}>
              {campaignResult?.campaign?.ozel_gun_adi || 'Özel Gün'}
            </Text>

            <Text style={styles.modalDescription}>
              Bu özel güne özel tasarlanan uygulama ikonumuzu kullanmak ister misiniz?{' '}
              Özel gün sona erdiğinde ikonunuz otomatik olarak varsayılan haline dönecektir.
            </Text>

            {/* Butonlar */}
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
              <Text style={styles.modalAcceptText}>🎉 İkonu Güncelle</Text>
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

  // ── İkon Kampanya Modal Stilleri ──
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
