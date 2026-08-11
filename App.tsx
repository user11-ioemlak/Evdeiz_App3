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
} from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import * as Network from 'expo-network';
import * as Device from 'expo-device';
import appJson from './app.json';

const TARGET_URL = appJson.expo?.extra?.activeUrl || appJson.expo?.extra?.liveUrl || appJson.expo?.extra?.testUrl;
const APP_NAME = appJson.expo?.name || 'Evdeiz';
const APP_VERSION = appJson.expo?.version || '1.0.0';
const APP_SECRET_TOKEN = 'Evdeiz_Secure_App_Key_2026_x87f';
const CUSTOM_USER_AGENT = `EvdeizApp/${APP_VERSION} (${Platform.OS}; ${Device.modelName || 'MobileNativeContainer'})`;

export default function App() {
  const webViewRef = useRef<WebView<{}>>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isNetworkConnected, setIsNetworkConnected] = useState<boolean>(true);
  const [isReady, setIsReady] = useState(false);

  const [deviceInfo, setDeviceInfo] = useState({
    ip: '',
    deviceName: Device.deviceName || '',
    modelName: Device.modelName || Platform.OS,
    osVersion: Device.osVersion || String(Platform.Version),
    brand: Device.brand || '',
    isPhysicalDevice: true,
  });

  const loadDeviceInfo = async () => {
    try {
      const [ip, netState] = await Promise.all([
        Network.getIpAddressAsync().catch(() => ''),
        Network.getNetworkStateAsync().catch(() => null),
      ]);

      setDeviceInfo({
        ip: ip || '',
        deviceName: Device.deviceName || Platform.OS,
        modelName: Device.modelName || Platform.OS,
        osVersion: Device.osVersion || String(Platform.Version),
        brand: Device.brand || Platform.OS,
        isPhysicalDevice: Device.isDevice,
      });

      if (netState) {
        setIsNetworkConnected(!!(netState.isConnected && netState.isInternetReachable !== false));
      }
    } catch {
      setIsNetworkConnected(true);
    } finally {
      setIsReady(true);
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
            <ActivityIndicator size="large" color="#3B82F6" />
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
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>Yükleniyor...</Text>
          </View>
        )}
      </View>
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
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#64748B',
    fontWeight: '500',
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
});
