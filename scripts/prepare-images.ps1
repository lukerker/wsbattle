# 把 cards/ 裡的大圖縮成網頁用的尺寸，放到 cards/_web/（不進版本庫，打包前端時會一起上傳）。
#   system first.png / system last.png → _web/first.jpg、_web/last.jpg（系統預設的先攻／後攻卡）
#   各系列資料夾裡的 *_VS.jpg       → _web/vs/<系列代碼>.jpg（進入對戰時的 VS 動畫）
# 用法（在專案根目錄）：powershell -ExecutionPolicy Bypass -File scripts/prepare-images.ps1
Add-Type -AssemblyName System.Drawing
$root = Join-Path $PSScriptRoot '..\cards'
$out = Join-Path $root '_web'
New-Item -ItemType Directory -Force (Join-Path $out 'vs') | Out-Null

# 檔名開頭 → 系列代碼（卡號的第一段）；沒列的就直接用檔名開頭
$code = @{ 'AVE' = 'BD'; 'GBC' = 'GCR'; 'LCR' = 'LRC' }

$jpeg = [Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
function Save-Resized([string]$src, [string]$dst, [int]$maxSide, [long]$quality) {
  $img = [Drawing.Image]::FromFile($src)
  $scale = [Math]::Min(1.0, $maxSide / [Math]::Max($img.Width, $img.Height))
  $w = [int]($img.Width * $scale); $h = [int]($img.Height * $scale)
  $bmp = New-Object Drawing.Bitmap $w, $h
  $g = [Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = 'HighQualityBicubic'; $g.SmoothingMode = 'HighQuality'; $g.PixelOffsetMode = 'HighQuality'
  $g.Clear([Drawing.Color]::Black)
  $g.DrawImage($img, 0, 0, $w, $h)
  $p = New-Object Drawing.Imaging.EncoderParameters 1
  $p.Param[0] = New-Object Drawing.Imaging.EncoderParameter ([Drawing.Imaging.Encoder]::Quality), $quality
  $bmp.Save($dst, $jpeg, $p)
  $g.Dispose(); $bmp.Dispose(); $img.Dispose()
  '{0} → {1}（{2}x{3}，{4:N0} KB）' -f (Split-Path $src -Leaf), (Split-Path $dst -Leaf), $w, $h, ((Get-Item $dst).Length / 1KB)
}

Save-Resized (Join-Path $root 'system first.png') (Join-Path $out 'first.jpg') 900 88
Save-Resized (Join-Path $root 'system last.png') (Join-Path $out 'last.jpg') 900 88
Get-ChildItem $root -Recurse -File -Filter '*_VS.*' | Where-Object { $_.FullName -notlike '*\_web\*' } | ForEach-Object {
  $prefix = ($_.BaseName -split '_')[0].ToUpper()
  $c = if ($code.ContainsKey($prefix)) { $code[$prefix] } else { $prefix }
  Save-Resized $_.FullName (Join-Path $out "vs\$c.jpg") 1400 85
}
