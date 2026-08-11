import { Platform } from 'react-native';
import * as Device from 'expo-device';

export interface EmulatorDetectionResult {
  isPhysical: boolean;
  suspicionScore: number;
  reasons: string[];
}

export function detectEmulator(ip: string): EmulatorDetectionResult {
  let score = 0;
  const reasons: string[] = [];

  // 1. Expo Native Device Flag (Weight: 100)
  if (Device.isDevice === false) {
    score += 100;
    reasons.push('expo_is_device_false');
  }

  if (Platform.OS === 'android') {
    const deviceName = (Device.deviceName || '').toLowerCase();
    const modelName = (Device.modelName || '').toLowerCase();
    const brand = (Device.brand || '').toLowerCase();
    const combined = `${deviceName} ${modelName} ${brand}`;

    // 2. Extended Keyword Fingerprint Match (Weight: 60)
    const emulatorKeywords = [
      'bluestacks', 'bstk', 'nox', 'memu', 'genymotion',
      'koplayer', 'gameloop', 'mumu', 'sdk_google', 'generic_x86',
      'emulator', 'sdk_gphone', 'android sdk', 'goldfish',
      'ranchu', 'vbox', 'virtual', 'droid4x', 'ldplayer',
      'andy', 'windroye', 'phoenix', 'microvirt', 'vmos',
      'shengqi', 'titan',
    ];

    if (emulatorKeywords.some(kw => combined.includes(kw))) {
      score += 60;
      reasons.push('keyword_fingerprint_match');
    }

    // 3. Emulator NAT IP Range (Weight: 30)
    if (ip && (ip.startsWith('10.0.2.') || ip.startsWith('10.0.3.'))) {
      score += 30;
      reasons.push('emulator_ip_range');
    }

    // 4. CPU Architecture Check (Weight: 25)
    // Most physical Android phones use ARM architectures. Pure x86/x86_64 indicates VM/Emulator.
    const supportedCpu = Device.supportedCpuArchitectures || [];
    if (supportedCpu.length > 0 && supportedCpu.every(arch => arch.toLowerCase().includes('x86'))) {
      score += 25;
      reasons.push('x86_architecture');
    }

    // 5. Generic Model/Product Strings (Weight: 20)
    if (modelName.includes('generic') || modelName.includes('sdk') || brand.includes('generic')) {
      score += 20;
      reasons.push('generic_device_string');
    }

    // 6. Round Memory Size Check (Weight: 10)
    if (Device.totalMemory) {
      const memoryMb = Math.round(Device.totalMemory / (1024 * 1024));
      if (memoryMb > 0 && memoryMb % 1024 === 0) {
        score += 10;
        reasons.push('exact_round_memory');
      }
    }
  }

  // Cap score at 100
  const finalScore = Math.min(score, 100);
  const isPhysical = finalScore < 50;

  return {
    isPhysical,
    suspicionScore: finalScore,
    reasons,
  };
}
