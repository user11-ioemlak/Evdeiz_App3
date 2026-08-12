# generate-mobile-icons.ps1

Add-Type -AssemblyName System.Drawing

$sourceIcon = Join-Path $PSScriptRoot "icon.png"

if (-not (Test-Path $sourceIcon)) {
    Write-Host "HATA: icon.png bulunamadı!" -ForegroundColor Red
    exit 1
}

$androidTargets = @(
    @{ Path = "ANDROID"; Name = "mipmap-ldpi.png";    Width = 36;  Height = 36 },
    @{ Path = "ANDROID"; Name = "mipmap-mdpi.png";    Width = 48;  Height = 48 },
    @{ Path = "ANDROID"; Name = "mipmap-hdpi.png";    Width = 72;  Height = 72 },
    @{ Path = "ANDROID"; Name = "mipmap-xhdpi.png";   Width = 96;  Height = 96 },
    @{ Path = "ANDROID"; Name = "mipmap-xxhdpi.png";  Width = 144; Height = 144 },
    @{ Path = "ANDROID"; Name = "mipmap-xxxhdpi.png"; Width = 192; Height = 192 },
    @{ Path = "ANDROID"; Name = "tv_banner.png";       Width = 320; Height = 180 }
)

$iosTargets = @(
    @{ Name = "AppIcon-20x20@2x.png";      Size = 40 },
    @{ Name = "AppIcon-20x20@3x.png";      Size = 60 },
    @{ Name = "AppIcon-29x29@2x.png";      Size = 58 },
    @{ Name = "AppIcon-29x29@3x.png";      Size = 87 },
    @{ Name = "AppIcon-40x40@2x.png";      Size = 80 },
    @{ Name = "AppIcon-40x40@3x.png";      Size = 120 },
    @{ Name = "AppIcon-60x60@2x.png";      Size = 120 },
    @{ Name = "AppIcon-60x60@3x.png";      Size = 180 },
    @{ Name = "AppIcon-76x76@1x.png";      Size = 76 },
    @{ Name = "AppIcon-76x76@2x.png";      Size = 152 },
    @{ Name = "AppIcon-83.5x83.5@2x.png"; Size = 167 },
    @{ Name = "AppIcon-1024x1024.png";    Size = 1024 }
)

function Save-Png {
    param(
        [string]$Source,
        [string]$Destination,
        [int]$Width,
        [int]$Height
    )

    $dir = Split-Path $Destination -Parent
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }

    $src = [System.Drawing.Image]::FromFile($Source)
    $bmp = New-Object System.Drawing.Bitmap $Width, $Height

    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    $g.DrawImage($src, 0, 0, $Width, $Height)

    $bmp.Save($Destination, [System.Drawing.Imaging.ImageFormat]::Png)

    $g.Dispose()
    $bmp.Dispose()
    $src.Dispose()

    Write-Host "Kaydedildi: $Destination" -ForegroundColor Green
}

Write-Host "ANDROID ikonları oluşturuluyor..." -ForegroundColor Cyan

foreach ($t in $androidTargets) {
    $dest = Join-Path $PSScriptRoot (Join-Path $t.Path $t.Name)
    Save-Png -Source $sourceIcon -Destination $dest -Width $t.Width -Height $t.Height
}

Write-Host "IOS ikonları oluşturuluyor..." -ForegroundColor Cyan

$iosBase = Join-Path $PSScriptRoot "IOS"

foreach ($t in $iosTargets) {
    $dest = Join-Path $iosBase $t.Name
    Save-Png -Source $sourceIcon -Destination $dest -Width $t.Size -Height $t.Size
}

Write-Host "
Tüm ikonlar başarıyla oluşturuldu." -ForegroundColor Yellow