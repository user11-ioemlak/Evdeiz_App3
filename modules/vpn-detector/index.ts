import { requireNativeModule } from 'expo-modules-core';

export interface VpnDetailsNative {
  hasTunnelInterface: boolean;
  tunnelInterfaces: string[];
  hasVpnTransport?: boolean;
  isProxyActive: boolean;
  reasons: string[];
}

let VpnDetectorModule: any = null;
try {
  VpnDetectorModule = requireNativeModule('VpnDetector');
} catch (e) {
  VpnDetectorModule = null;
}

export function getVpnDetailsNative(): VpnDetailsNative {
  if (VpnDetectorModule && typeof VpnDetectorModule.getVpnDetails === 'function') {
    try {
      const res = VpnDetectorModule.getVpnDetails();
      if (res && typeof res === 'object') {
        return {
          hasTunnelInterface: !!res.hasTunnelInterface,
          tunnelInterfaces: Array.isArray(res.tunnelInterfaces) ? res.tunnelInterfaces : [],
          hasVpnTransport: !!res.hasVpnTransport,
          isProxyActive: !!res.isProxyActive,
          reasons: Array.isArray(res.reasons) ? res.reasons : [],
        };
      }
    } catch (err) {
      // Fallback on exception
    }
  }
  return {
    hasTunnelInterface: false,
    tunnelInterfaces: [],
    hasVpnTransport: false,
    isProxyActive: false,
    reasons: [],
  };
}
