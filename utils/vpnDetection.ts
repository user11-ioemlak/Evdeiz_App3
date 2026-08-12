import * as Network from 'expo-network';
import { getVpnDetailsNative, VpnDetailsNative } from '../modules/vpn-detector';

export interface VpnDetectionResult {
  isVpnActive: boolean;
  suspicionScore: number;
  reasons: string[];
  nativeDetails: VpnDetailsNative;
}

export async function detectVpn(ip: string): Promise<VpnDetectionResult> {
  let score = 0;
  const reasons: string[] = [];

  // 1. Get native signals from local native module
  const nativeDetails = getVpnDetailsNative();

  // Primary Signal: Native Network Interface Scan (utun/tun/ppp/ipsec/tap) -> Weight: 70
  if (nativeDetails.hasTunnelInterface) {
    score += 70;
    const ifaceNameStr = nativeDetails.tunnelInterfaces.length > 0
      ? nativeDetails.tunnelInterfaces.join('_')
      : 'active';
    reasons.push(`interface_tunnel_${ifaceNameStr}`);
  }

  // Native Transport VPN / Scoped VPN (Android ConnectivityManager / iOS Scoped) -> Weight: 20
  if (nativeDetails.hasVpnTransport) {
    score += 20;
    reasons.push('native_transport_vpn');
  }

  // Native System Proxy check -> Weight: 20
  if (nativeDetails.isProxyActive) {
    score += 20;
    reasons.push('system_proxy_detected');
  }

  // Include native raw reasons if any
  if (nativeDetails.reasons && nativeDetails.reasons.length > 0) {
    for (const r of nativeDetails.reasons) {
      if (!reasons.includes(r)) {
        reasons.push(r);
      }
    }
  }

  // 2. expo-network check -> Weight: 30
  try {
    const netState = await Network.getNetworkStateAsync().catch(() => null);
    if (netState) {
      const isExpoVpn =
        netState.type === Network.NetworkStateType.VPN ||
        String(netState.type).toUpperCase() === 'VPN';

      if (isExpoVpn) {
        score += 30;
        reasons.push('expo_network_vpn_type');
      }
    }
  } catch (e) {
    // Ignore error
  }

  // 3. Local IP anomaly check -> Weight: 5
  if (!ip || ip === '0.0.0.0' || ip === '127.0.0.1') {
    score += 5;
    reasons.push('anomalous_local_ip');
  }

  const finalScore = Math.min(score, 100);
  const isVpnActive = finalScore >= 40;

  return {
    isVpnActive,
    suspicionScore: finalScore,
    reasons,
    nativeDetails,
  };
}
