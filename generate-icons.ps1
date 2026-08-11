Add-Type -AssemblyName System.Drawing

$baseDir = Get-Location
$srcFile = Join-Path $baseDir "assets\icon.png"
if (-not (Test-Path $srcFile)) {
    Write-Host "ERROR: source icon.png not found"
    exit 1
}

$srcImage = [System.Drawing.Image]::FromFile($srcFile)

# Android Icons Target List
$androidTargets = @(
    @{ Path = "assets/android_icons/mipmap-ldpi"; Name = "ic_launcher.png"; Width = 36; Height = 36 },
    @{ Path = "assets/android_icons/mipmap-ldpi"; Name = "ic_launcher_round.png"; Width = 36; Height = 36 },
    @{ Path = "assets/android_icons/mipmap-mdpi"; Name = "ic_launcher.png"; Width = 48; Height = 48 },
    @{ Path = "assets/android_icons/mipmap-mdpi"; Name = "ic_launcher_round.png"; Width = 48; Height = 48 },
    @{ Path = "assets/android_icons/mipmap-hdpi"; Name = "ic_launcher.png"; Width = 72; Height = 72 },
    @{ Path = "assets/android_icons/mipmap-hdpi"; Name = "ic_launcher_round.png"; Width = 72; Height = 72 },
    @{ Path = "assets/android_icons/mipmap-xhdpi"; Name = "ic_launcher.png"; Width = 96; Height = 96 },
    @{ Path = "assets/android_icons/mipmap-xhdpi"; Name = "ic_launcher_round.png"; Width = 96; Height = 96 },
    @{ Path = "assets/android_icons/mipmap-xxhdpi"; Name = "ic_launcher.png"; Width = 144; Height = 144 },
    @{ Path = "assets/android_icons/mipmap-xxhdpi"; Name = "ic_launcher_round.png"; Width = 144; Height = 144 },
    @{ Path = "assets/android_icons/mipmap-xxxhdpi"; Name = "ic_launcher.png"; Width = 192; Height = 192 },
    @{ Path = "assets/android_icons/mipmap-xxxhdpi"; Name = "ic_launcher_round.png"; Width = 192; Height = 192 },
    @{ Path = "assets/android_icons/tv-banner"; Name = "tv_banner.png"; Width = 320; Height = 180 },

    @{ Path = "android/app/src/main/res/mipmap-ldpi"; Name = "ic_launcher.png"; Width = 36; Height = 36 },
    @{ Path = "android/app/src/main/res/mipmap-ldpi"; Name = "ic_launcher_round.png"; Width = 36; Height = 36 },
    @{ Path = "android/app/src/main/res/mipmap-mdpi"; Name = "ic_launcher.png"; Width = 48; Height = 48 },
    @{ Path = "android/app/src/main/res/mipmap-mdpi"; Name = "ic_launcher_round.png"; Width = 48; Height = 48 },
    @{ Path = "android/app/src/main/res/mipmap-hdpi"; Name = "ic_launcher.png"; Width = 72; Height = 72 },
    @{ Path = "android/app/src/main/res/mipmap-hdpi"; Name = "ic_launcher_round.png"; Width = 72; Height = 72 },
    @{ Path = "android/app/src/main/res/mipmap-xhdpi"; Name = "ic_launcher.png"; Width = 96; Height = 96 },
    @{ Path = "android/app/src/main/res/mipmap-xhdpi"; Name = "ic_launcher_round.png"; Width = 96; Height = 96 },
    @{ Path = "android/app/src/main/res/mipmap-xxhdpi"; Name = "ic_launcher.png"; Width = 144; Height = 144 },
    @{ Path = "android/app/src/main/res/mipmap-xxhdpi"; Name = "ic_launcher_round.png"; Width = 144; Height = 144 },
    @{ Path = "android/app/src/main/res/mipmap-xxxhdpi"; Name = "ic_launcher.png"; Width = 192; Height = 192 },
    @{ Path = "android/app/src/main/res/mipmap-xxxhdpi"; Name = "ic_launcher_round.png"; Width = 192; Height = 192 },
    @{ Path = "android/app/src/main/res/drawable"; Name = "tv_banner.png"; Width = 320; Height = 180 }
)

# Apple iOS Icons Target List
$appleTargets = @(
    @{ Path = "assets/apple_icons"; Name = "AppIcon-20x20@2x.png"; Width = 40; Height = 40 },
    @{ Path = "assets/apple_icons"; Name = "AppIcon-20x20@3x.png"; Width = 60; Height = 60 },
    @{ Path = "assets/apple_icons"; Name = "AppIcon-29x29@2x.png"; Width = 58; Height = 58 },
    @{ Path = "assets/apple_icons"; Name = "AppIcon-29x29@3x.png"; Width = 87; Height = 87 },
    @{ Path = "assets/apple_icons"; Name = "AppIcon-40x40@2x.png"; Width = 80; Height = 80 },
    @{ Path = "assets/apple_icons"; Name = "AppIcon-40x40@3x.png"; Width = 120; Height = 120 },
    @{ Path = "assets/apple_icons"; Name = "AppIcon-60x60@2x.png"; Width = 120; Height = 120 },
    @{ Path = "assets/apple_icons"; Name = "AppIcon-60x60@3x.png"; Width = 180; Height = 180 },
    @{ Path = "assets/apple_icons"; Name = "AppIcon-76x76@1x.png"; Width = 76; Height = 76 },
    @{ Path = "assets/apple_icons"; Name = "AppIcon-76x76@2x.png"; Width = 152; Height = 152 },
    @{ Path = "assets/apple_icons"; Name = "AppIcon-83.5x83.5@2x.png"; Width = 167; Height = 167 },
    @{ Path = "assets/apple_icons"; Name = "AppIcon-1024x1024.png"; Width = 1024; Height = 1024 }
)

$allTargets = $androidTargets + $appleTargets

foreach ($t in $allTargets) {
    $dirPath = Join-Path $baseDir $t.Path
    if (-not (Test-Path $dirPath)) {
        New-Item -ItemType Directory -Path $dirPath -Force | Out-Null
    }
    $filePath = Join-Path $dirPath $t.Name

    $destBmp = New-Object System.Drawing.Bitmap($t.Width, $t.Height)
    $g = [System.Drawing.Graphics]::FromImage($destBmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($srcImage, 0, 0, $t.Width, $t.Height)

    $destBmp.Save($filePath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $destBmp.Dispose()
    Write-Host "Created: $($t.Path)/$($t.Name) ($($t.Width)x$($t.Height))"
}

$srcImage.Dispose()

# Create Contents.json for Xcode AppIcon set in assets/apple_icons
$contentsJson = @'
{
  "images": [
    { "size": "20x20", "idiom": "iphone", "filename": "AppIcon-20x20@2x.png", "scale": "2x" },
    { "size": "20x20", "idiom": "iphone", "filename": "AppIcon-20x20@3x.png", "scale": "3x" },
    { "size": "29x29", "idiom": "iphone", "filename": "AppIcon-29x29@2x.png", "scale": "2x" },
    { "size": "29x29", "idiom": "iphone", "filename": "AppIcon-29x29@3x.png", "scale": "3x" },
    { "size": "40x40", "idiom": "iphone", "filename": "AppIcon-40x40@2x.png", "scale": "2x" },
    { "size": "40x40", "idiom": "iphone", "filename": "AppIcon-40x40@3x.png", "scale": "3x" },
    { "size": "60x60", "idiom": "iphone", "filename": "AppIcon-60x60@2x.png", "scale": "2x" },
    { "size": "60x60", "idiom": "iphone", "filename": "AppIcon-60x60@3x.png", "scale": "3x" },
    { "size": "76x76", "idiom": "ipad", "filename": "AppIcon-76x76@1x.png", "scale": "1x" },
    { "size": "76x76", "idiom": "ipad", "filename": "AppIcon-76x76@2x.png", "scale": "2x" },
    { "size": "83.5x83.5", "idiom": "ipad", "filename": "AppIcon-83.5x83.5@2x.png", "scale": "2x" },
    { "size": "1024x1024", "idiom": "ios-marketing", "filename": "AppIcon-1024x1024.png", "scale": "1x" }
  ],
  "info": {
    "version": 1,
    "author": "expo"
  }
}
'@

$appleJsonPath = Join-Path $baseDir "assets/apple_icons/Contents.json"
Set-Content -Path $appleJsonPath -Value $contentsJson -Encoding UTF8

Write-Host "SUCCESS: android_icons and apple_icons suites generated!"
