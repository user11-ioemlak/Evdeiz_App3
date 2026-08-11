<?php
declare(strict_types=1);

// ============================================
// EVDEİZ SAĞLIK - GÜVENLİ MOBİL ERİŞİM KATMANI
// (Sertleştirilmiş sürüm)
// ============================================

// ---------- ORTAM DEĞİŞKENLERİ ----------
$possibleEnvPaths = [
    __DIR__ . '/.env',
    dirname(__DIR__) . '/.env',
    dirname(__DIR__) . '/config/.env',
];

foreach ($possibleEnvPaths as $envPath) {
    if (is_file($envPath)) {
        $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            $trimmed = trim($line);
            if ($trimmed === '' || str_starts_with($trimmed, '#')) {
                continue;
            }
            if (str_contains($trimmed, '=')) {
                [$k, $v] = array_pad(explode('=', $trimmed, 2), 2, '');
                putenv(trim($k) . '=' . trim($v));
                $_ENV[trim($k)] = trim($v);
            }
        }
    }
}

function envWithFallback(string $key, string $default): string
{
    $val = getenv($key);
    if ($val !== false && $val !== '') {
        return $val;
    }
    return $_ENV[$key] ?? $_SERVER[$key] ?? $default;
}

// ---------- UYGULAMA AYARLARI ----------
$appSecretKey   = envWithFallback('EVDEIZ_APP_SECRET_KEY', 'Evdeiz_Secure_App_Key_2026_x87f');
$minimumVersion = '1.0.0';
$exactVersion   = '1.0.0';
$forceHttps     = false; // Yerel testlerde engellemeyi önlemek için varsayılan false

// ---------- GÜVENLİK HEADERLARI ----------
header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
header('Content-Security-Policy: default-src \'self\'; style-src \'unsafe-inline\'');
header('Content-Type: text/html; charset=utf-8');

// ---------- HTTPS ZORUNLULUĞU ----------
// Reverse proxy arkasındaysa X-Forwarded-Proto'ya da bak.
$isHttps = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'
    || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');

if ($forceHttps && !$isHttps) {
    header('Location: https://' . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'], true, 301);
    exit;
}
if ($forceHttps && $isHttps) {
    // HSTS: tarayıcıyı/istemciyi bir daha HTTP denemesin diye zorla
    header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
}

// ---------- MOBİL UYGULAMA BİLGİLERİ ----------
$requestSecret      = trim($_SERVER['HTTP_X_APP_SECRET_KEY'] ?? '');
$appVersion         = trim($_SERVER['HTTP_X_APP_VERSION'] ?? '');
$appPlatform        = strtolower(trim($_SERVER['HTTP_X_APP_PLATFORM'] ?? ''));
$appLocalIp         = trim($_SERVER['HTTP_X_APP_LOCAL_IP'] ?? '');
$appDeviceName      = trim($_SERVER['HTTP_X_APP_DEVICE_NAME'] ?? '');
$appDeviceModel     = trim($_SERVER['HTTP_X_APP_DEVICE_MODEL'] ?? '');
$appOsVersion       = trim($_SERVER['HTTP_X_APP_OS_VERSION'] ?? '');
$appDeviceBrand     = trim($_SERVER['HTTP_X_APP_DEVICE_BRAND'] ?? '');
$isPhysicalDevice   = trim($_SERVER['HTTP_X_APP_IS_PHYSICAL_DEVICE'] ?? '');
$isVpnActive        = strtolower(trim($_SERVER['HTTP_X_APP_IS_VPN_ACTIVE'] ?? '')) === 'true';
$userAgent          = $_SERVER['HTTP_USER_AGENT'] ?? '';
$remoteIp           = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';

// ---------- GÜVENLİ DİZİNLER (web root dışı önerilir) ----------
// Not: Bu dizinleri idealde web root'un dışına taşı (örn. /home/user/storage/...).
// Mümkün değilse en azından .htaccess ile erişimi kapat (aşağıda dosyaları var).
$rateDir = __DIR__ . '/cache/rate-limit';
$logDir  = __DIR__ . '/logs';

foreach ([$rateDir, $logDir] as $dir) {
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
}

// ---------- ATOMİK RATE LIMIT (flock ile race condition önlenir) ----------
function checkRateLimit(string $rateDir, string $remoteIp, int $limit, int $window): bool
{
    $rateFile = $rateDir . '/' . hash('sha256', $remoteIp) . '.json';
    $fp = fopen($rateFile, 'c+');
    if ($fp === false) {
        return true; // dosya açılamazsa istek engellenmesin, sadece logla
    }

    flock($fp, LOCK_EX); // aynı dosyaya eşzamanlı erişimi kilitle

    $now  = time();
    $raw  = stream_get_contents($fp);
    $data = json_decode($raw ?: '', true);

    if (!is_array($data) || ($now - ($data['start'] ?? 0)) > $window) {
        $data = ['count' => 0, 'start' => $now];
    }

    $data['count']++;

    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($data));
    fflush($fp);

    flock($fp, LOCK_UN);
    fclose($fp);

    return $data['count'] <= $limit;
}

if (!checkRateLimit($rateDir, $remoteIp, 100, 60)) {
    http_response_code(429);
    header('Retry-After: 60');
    exit('Çok fazla istek gönderildi. Lütfen daha sonra tekrar deneyin.');
}

// ---------- PLATFORM KONTROLÜ ----------
$validPlatform = in_array($appPlatform, ['android', 'ios'], true) || $appPlatform === '';

// ---------- USER-AGENT KONTROLÜ ----------
$validUserAgent = stripos($userAgent, 'EvdeizApp') !== false;

// ---------- SECRET KEY KONTROLÜ ----------
$validSecret = hash_equals($appSecretKey, $requestSecret);

// ---------- ANA DOĞRULAMA ----------
$isAppRequest = $validSecret && $validPlatform && $validUserAgent;

// ---------- LOG FONKSİYONU (injection'a karşı sanitize edilmiş) ----------
function sanitizeForLog(string $value): string
{
    // Satır sonu / kontrol karakterlerini temizle -> sahte log satırı enjeksiyonunu engeller
    $clean = preg_replace('/[\r\n\t\x00-\x1F]+/', ' ', $value) ?? '';
    return mb_substr(trim($clean), 0, 200); // aşırı uzun header ile log şişirmeyi de engelle
}

function securityLog(string $logDir, string $message): void
{
    file_put_contents(
        $logDir . '/security.log',
        '[' . date('Y-m-d H:i:s') . '] ' . $message . PHP_EOL,
        FILE_APPEND | LOCK_EX
    );
}

// ---------- YETKİSİZ ERİŞİM ----------
if (!$isAppRequest) {
    http_response_code(403);

    securityLog($logDir, sprintf(
        '403 | IP=%s | UA=%s | PLATFORM=%s | VERSION=%s',
        sanitizeForLog($remoteIp),
        sanitizeForLog($userAgent),
        sanitizeForLog($appPlatform),
        sanitizeForLog($appVersion)
    ));

    echo <<<HTML
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>403 Yetkisiz Erişim</title>
    <style>
        body {
            margin:0;
            font-family:Inter,system-ui,sans-serif;
            background:#0f172a;
            color:#e2e8f0;
            display:flex;
            align-items:center;
            justify-content:center;
            min-height:100vh;
            padding:24px;
        }
        .card {
            width:100%;
            max-width:520px;
            background:#111827;
            border:1px solid rgba(148,163,184,.12);
            border-radius:24px;
            padding:32px;
            text-align:center;
            box-shadow:0 24px 80px rgba(15,23,42,.22);
        }
        h1 { color:#f87171; margin-bottom:12px; }
        p { color:#cbd5e1; line-height:1.7; }
    </style>
</head>
<body>
    <div class="card">
        <h1>⛔ Erişim Engellendi</h1>
        <p>Bu sayfa yalnızca yetkili Evdeiz Sağlık mobil uygulaması tarafından erişilebilir.</p>
    </div>
</body>
</html>
HTML;
    exit;
}

// ============================================
// GELİŞMİŞ SÜRÜM KONTROLÜ
// ============================================

$errorType = null;

if ($appVersion === '' || version_compare($appVersion, $minimumVersion, '<')) {
    $errorType = 'outdated';
} elseif ($appVersion !== $exactVersion) {
    $errorType = 'mismatch';
}

if ($errorType !== null) {
    http_response_code(426);

    $safeCurrent = htmlspecialchars($appVersion ?: 'Bilinmiyor', ENT_QUOTES, 'UTF-8');
    $safeMin     = htmlspecialchars($minimumVersion, ENT_QUOTES, 'UTF-8');
    $safeExact   = htmlspecialchars($exactVersion, ENT_QUOTES, 'UTF-8');

    if ($errorType === 'outdated') {
        $heading = '📱 Güncelleme Gerekli';
        $message = 'Kullandığınız uygulama sürümü artık desteklenmiyor. Lütfen uygulamayı güncelleyin.';
        $color   = '#fbbf24';
    } else {
        $heading = '⚠️ Sürüm Uyuşmazlığı';
        $message = 'Uygulama sürümü sunucunun desteklediği sürüm ile eşleşmiyor.';
        $color   = '#f87171';
    }

    echo <<<HTML
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Sürüm Kontrolü</title>
    <style>
        body {
            margin:0;
            font-family:Inter,system-ui,sans-serif;
            background:#0f172a;
            color:#e2e8f0;
            display:flex;
            align-items:center;
            justify-content:center;
            min-height:100vh;
            padding:24px;
        }
        .card {
            width:100%;
            max-width:560px;
            background:#111827;
            border:1px solid rgba(148,163,184,.12);
            border-radius:24px;
            padding:32px;
            box-shadow:0 24px 80px rgba(15,23,42,.22);
        }
        h1 { color:{$color}; text-align:center; }
        p { line-height:1.7; color:#cbd5e1; text-align:center; }
        .box {
            margin-top:20px;
            padding:16px;
            background:#0b1220;
            border-radius:14px;
            border:1px solid rgba(148,163,184,.16);
        }
        .row {
            display:flex;
            justify-content:space-between;
            padding:8px 0;
            border-bottom:1px solid rgba(148,163,184,.08);
        }
        .row:last-child { border-bottom:none; }
    </style>
</head>
<body>
    <div class="card">
        <h1>{$heading}</h1>
        <p>{$message}</p>
        <div class="box">
            <div class="row"><span>Cihazdaki sürüm</span><strong>{$safeCurrent}</strong></div>
            <div class="row"><span>Minimum desteklenen</span><strong>{$safeMin}</strong></div>
            <div class="row"><span>Sunucunun kabul ettiği</span><strong>{$safeExact}</strong></div>
        </div>
    </div>
</body>
</html>
HTML;
    exit;
}

// ============================================
// BAŞARILI BAĞLANTI LOGU
// ============================================
securityLog($logDir, sprintf(
    'OK | IP=%s | LOCAL=%s | PLATFORM=%s | VERSION=%s | VPN=%s',
    sanitizeForLog($remoteIp),
    sanitizeForLog($appLocalIp ?: 'YOK'),
    sanitizeForLog($appPlatform),
    sanitizeForLog($appVersion),
    $isVpnActive ? 'EVET' : 'HAYIR'
));

// ============================================
// UYGULAMA İÇERİĞİ
// ============================================
?>

<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Evdeiz Sağlık</title>
    <style>
        :root {
            --bg:#f8fafc;
            --surface:#ffffff;
            --text:#0f172a;
            --muted:#64748b;
            --primary:#2563eb;
            --primary-soft:#eff6ff;
            --border:#e2e8f0;
        }
        * { box-sizing:border-box; }
        body {
            margin:0;
            font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
            background:linear-gradient(180deg,#eef2ff 0%,#f8fafc 100%);
            color:var(--text);
        }
        .page { max-width:980px; margin:0 auto; padding:20px; }
        .hero {
            background:var(--surface);
            border:1px solid var(--border);
            border-radius:32px;
            padding:28px;
            box-shadow:0 24px 70px rgba(15,23,42,.08);
        }
        .brand { display:flex; align-items:center; gap:14px; }
        .brand-badge {
            width:48px; height:48px; border-radius:18px;
            background:linear-gradient(135deg,#2563eb,#8b5cf6);
            display:grid; place-items:center; color:#fff;
            font-weight:700; font-size:1.25rem;
        }
        .brand-title { margin:0; font-size:1.1rem; font-weight:700; }
        .hero-title {
            margin:22px 0 10px;
            font-size:clamp(2rem,4vw,2.8rem);
            line-height:1.05;
        }
        .hero-text { margin:0; color:var(--muted); line-height:1.75; font-size:1rem; }
        .buttons { display:flex; flex-wrap:wrap; gap:12px; margin-top:24px; }
        .btn {
            padding:14px 20px; border-radius:16px; border:0;
            font-size:1rem; font-weight:600; cursor:pointer;
            transition:transform .2s ease, box-shadow .2s ease;
        }
        .btn-primary { background:var(--primary); color:#fff; }
        .btn-secondary { background:var(--primary-soft); color:var(--primary); }
        .btn:hover { transform:translateY(-1px); box-shadow:0 12px 25px rgba(37,99,235,.18); }
        .main-grid { display:grid; gap:18px; margin-top:24px; }
        .card {
            background:var(--surface);
            border:1px solid var(--border);
            border-radius:28px;
            padding:22px;
            box-shadow:0 16px 48px rgba(15,23,42,.06);
        }
        .card h2 { margin:0 0 12px; font-size:1.2rem; color:#111827; }
        .card p { margin:0; color:var(--muted); line-height:1.7; }
        .footer {
            margin:36px auto 0;
            padding:0 20px;
            color:var(--muted);
            font-size:.95rem;
            text-align:center;
        }
        .device-status-card {
            margin-top: 24px;
            padding: 18px 22px;
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-radius: 24px;
        }
        .status-header {
            display: flex;
            align-items: center;
            margin-bottom: 14px;
        }
        .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: #16a34a;
            color: #ffffff;
            font-size: 0.88rem;
            font-weight: 600;
            padding: 5px 14px;
            border-radius: 20px;
        }
        .device-info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 12px;
            font-size: 0.92rem;
        }
        .info-item {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        .info-item span {
            color: #4b5563;
            font-size: 0.82rem;
        }
        .info-item strong {
            color: #14532d;
        }
        @media (min-width:720px) {
            .main-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
            .buttons { flex-wrap:nowrap; }
        }
    </style>
</head>
<body>
    <div class="page">
        <section class="hero">
            <div class="brand">
                <div class="brand-badge">E</div>
                <div>
                    <p class="brand-title">Evdeiz Sağlık</p>
                    <p class="hero-text">Mobil uygulama uyumlu web arayüzü</p>
                </div>
            </div>

            <h1 class="hero-title">Yalnızca yetkili mobil uygulama için özel erişim</h1>
            <p class="hero-text">Güvenli token doğrulaması ve sürüm kontrolü ile Evdeiz mobil uygulaması üzerinden erişim sağlanır. Kullanıcı deneyimini mobil dostu ve akıcı bir tasarım ile güçlendirdik.</p>

            <div class="device-status-card">
                <div class="status-header">
                    <span class="status-badge">✓ Giriş Doğrulamasından Geçti</span>
                </div>
                <div class="device-info-grid">
                    <div class="info-item">
                        <span>Cihaz Adı</span>
                        <strong><?= htmlspecialchars($appDeviceName ?: ($appPlatform ? strtoupper($appPlatform) . ' Cihazı' : 'Bilinmiyor'), ENT_QUOTES, 'UTF-8') ?></strong>
                    </div>
                    <div class="info-item">
                        <span>Cihaz Modeli / Marka</span>
                        <strong><?= htmlspecialchars(trim(($appDeviceBrand ? $appDeviceBrand . ' ' : '') . ($appDeviceModel ?: 'Bilinmiyor')), ENT_QUOTES, 'UTF-8') ?></strong>
                    </div>
                    <div class="info-item">
                        <span>Cihaz Türü</span>
                        <strong>
                            <?php if ($isPhysicalDevice === 'true'): ?>
                                <span style="color:#15803d;">📱 Gerçek (Fiziksel) Cihaz</span>
                            <?php elseif ($isPhysicalDevice === 'false'): ?>
                                <span style="color:#b91c1c;">🖥️ Sanal Cihaz (Emülatör)</span>
                            <?php else: ?>
                                <span>Bilinmiyor</span>
                            <?php endif; ?>
                        </strong>
                    </div>
                    <div class="info-item">
                        <span>İşletim Sistemi Sürümü</span>
                        <strong><?= htmlspecialchars(trim((strtoupper($appPlatform) ?: 'OS') . ' ' . ($appOsVersion ?: '')), ENT_QUOTES, 'UTF-8') ?></strong>
                    </div>
                    <div class="info-item">
                        <span>Uygulama Sürümü</span>
                        <strong>v<?= htmlspecialchars($appVersion ?: '1.0.0', ENT_QUOTES, 'UTF-8') ?></strong>
                    </div>
                    <div class="info-item">
                        <span>Yerel Ağ IP Adresi</span>
                        <strong><?= htmlspecialchars($appLocalIp ?: 'Alınamadı', ENT_QUOTES, 'UTF-8') ?></strong>
                    </div>
                    <div class="info-item">
                        <span>Bağlantı (Dış) IP</span>
                        <strong><?= htmlspecialchars($remoteIp, ENT_QUOTES, 'UTF-8') ?></strong>
                    </div>
                    <div class="info-item">
                        <span>VPN Bağlantı Durumu</span>
                        <strong>
                            <?php if ($isVpnActive): ?>
                                <span style="color:#dc2626; font-weight:700;">🔒 VPN Aktif</span>
                            <?php else: ?>
                                <span style="color:#15803d;">✅ Doğrudan Bağlantı (VPN Yok)</span>
                            <?php endif; ?>
                        </strong>
                    </div>
                </div>
            </div>

            <div class="buttons">
                <button class="btn btn-primary">Uygulamayı Aç</button>
                <button class="btn btn-secondary">Destek</button>
            </div>
        </section>

        <section class="main-grid">
            <div class="card">
                <h2>Hızlı hizmet takibi</h2>
                <p>Randevu, hasta kaydı ve hizmet bilgilerini tek ekranda takip edin. Mobil uygulama ile anlık bildirimler alın.</p>
            </div>
            <div class="card">
                <h2>Kişiye özel sağlık yönetimi</h2>
                <p>Evde bakım süreçlerinizi kolaylaştırın. Hasta bilgilerini, ilaç takibini ve ziyaret planlarını güvenle yönetin.</p>
            </div>
            <div class="card">
                <h2>Güvenli erişim</h2>
                <p>Mobil uygulama yalnızca yetkili isteklerde <code>X-APP-SECRET-KEY</code>, <code>X-APP-VERSION</code> ve doğru User-Agent bilgisi ile erişilebilir.</p>
            </div>
            <div class="card">
                <h2>7/24 destek</h2>
                <p>Her zaman yardım almak için destek ekibiyle iletişim kurun. Evdeiz ekibi ihtiyaç anında yanınızda.</p>
            </div>
        </section>

        <footer class="footer">
            <p>© 2026 Evdeiz Sağlık. Tüm hakları saklıdır.</p>
            <p>Designed & Developed by <a href="https://alperenakkaya.dev/" target="_blank" rel="noopener noreferrer">Alperen AKKAYA</a></p>
        </footer>
    </div>
</body>
</html>