Set-StrictMode -Version Latest

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.IO.Compression.FileSystem

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path (Join-Path $ScriptDir "..")).Path
$OutDir = Join-Path $ProjectRoot "presentation"
$SlideDir = Join-Path $OutDir "slides"
$AssetsDir = Join-Path $OutDir "assets"
$BuildDir = Join-Path $ProjectRoot (".codex-temp\pptx-build-" + (Get-Date -Format "yyyyMMdd-HHmmss"))

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
New-Item -ItemType Directory -Force -Path $SlideDir | Out-Null
New-Item -ItemType Directory -Force -Path $AssetsDir | Out-Null
New-Item -ItemType Directory -Force -Path $BuildDir | Out-Null

$QrCertificatePath = Join-Path $AssetsDir "qr-certificate.png"
$QrPresencePath = Join-Path $AssetsDir "qr-presence.png"

$W = 1920
$H = 1080
$SlideW = 12192000
$SlideH = 6858000

function U([string]$s) {
  return [regex]::Replace($s, "\\u([0-9A-Fa-f]{4})", {
    param($m)
    return [string][char]([Convert]::ToInt32($m.Groups[1].Value, 16))
  })
}

function Color-Hex([string]$hex, [int]$alpha = 255) {
  $h = $hex.TrimStart("#")
  return [System.Drawing.Color]::FromArgb(
    $alpha,
    [Convert]::ToInt32($h.Substring(0, 2), 16),
    [Convert]::ToInt32($h.Substring(2, 2), 16),
    [Convert]::ToInt32($h.Substring(4, 2), 16)
  )
}

$Navy = Color-Hex "#0F2570"
$Navy2 = Color-Hex "#142F8F"
$Brand = Color-Hex "#1F47C9"
$Brand2 = Color-Hex "#3780DD"
$Amber = Color-Hex "#EF9504"
$Amber2 = Color-Hex "#FFB226"
$Ink = Color-Hex "#111C30"
$Muted = Color-Hex "#64748F"
$Line = Color-Hex "#DBE3F3"
$Paper = Color-Hex "#FFFFFF"
$Bg = Color-Hex "#F3F6FC"
$SoftBlue = Color-Hex "#E8EDFB"
$SoftAmber = Color-Hex "#FFF4E0"
$Green = Color-Hex "#2E7D55"

function Ensure-QrAsset([string]$path, [string]$url) {
  if (Test-Path $path) { return }
  $wc = $null
  try {
    $wc = New-Object System.Net.WebClient
    $wc.DownloadFile($url, $path)
    $wc.Dispose()
  } catch {
    if ($wc) { $wc.Dispose() }
  }
}

Ensure-QrAsset $QrCertificatePath "https://api.qrserver.com/v1/create-qr-code/?size=720x720&data=https%3A%2F%2Fmaishoras.app%2Fverificar%2FMH-649ECE45&color=1F47C9&bgcolor=FFFFFF&qzone=2&format=png"
Ensure-QrAsset $QrPresencePath "https://api.qrserver.com/v1/create-qr-code/?size=720x720&data=https%3A%2F%2Fmaishoras.app%2Fcheckin%2FDYNAMIC-QR&color=EF9504&bgcolor=FFFFFF&qzone=2&format=png"

function Font-New([float]$size, [string]$style = "Regular") {
  $fs = [System.Drawing.FontStyle]::Regular
  if ($style -eq "Bold") { $fs = [System.Drawing.FontStyle]::Bold }
  if ($style -eq "Italic") { $fs = [System.Drawing.FontStyle]::Italic }
  return New-Object System.Drawing.Font("Segoe UI", $size, $fs, [System.Drawing.GraphicsUnit]::Pixel)
}

function Brush([System.Drawing.Color]$c) {
  return New-Object System.Drawing.SolidBrush($c)
}

function Pen-New([System.Drawing.Color]$c, [float]$w = 2) {
  $p = New-Object System.Drawing.Pen($c, $w)
  $p.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $p.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $p.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  return $p
}

function RoundPath([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $r = [Math]::Max(0, [Math]::Min($r, [Math]::Min($w, $h) / 2))
  if ($r -le 0) {
    $path.AddRectangle((New-Object System.Drawing.RectangleF($x, $y, $w, $h)))
    return $path
  }
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  return $path
}

function Fill-RoundRect($g, [System.Drawing.Brush]$brush, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $path = RoundPath $x $y $w $h $r
  $g.FillPath($brush, $path)
  $path.Dispose()
}

function Stroke-RoundRect($g, [System.Drawing.Pen]$pen, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $path = RoundPath $x $y $w $h $r
  $g.DrawPath($pen, $path)
  $path.Dispose()
}

function Draw-ShadowCard($g, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r, [System.Drawing.Color]$fill, [System.Drawing.Color]$border) {
  Fill-RoundRect $g (Brush (Color-Hex "#0F2570" 18)) ($x + 0) ($y + 16) $w $h $r
  Fill-RoundRect $g (Brush (Color-Hex "#0F2570" 10)) ($x + 0) ($y + 28) $w $h $r
  Fill-RoundRect $g (Brush $fill) $x $y $w $h $r
  Stroke-RoundRect $g (Pen-New $border 2) $x $y $w $h $r
}

function Draw-Text($g, [string]$text, [System.Drawing.Font]$font, [System.Drawing.Color]$color, [float]$x, [float]$y) {
  $b = Brush $color
  $g.DrawString((U $text), $font, $b, $x, $y)
  $b.Dispose()
}

function Draw-CenteredText($g, [string]$text, [System.Drawing.Font]$font, [System.Drawing.Color]$color, [float]$x, [float]$y, [float]$w) {
  $rendered = U $text
  $sz = $g.MeasureString($rendered, $font)
  Draw-Text $g $text $font $color ($x + (($w - $sz.Width) / 2)) $y
}

function Split-Lines($g, [string]$text, [System.Drawing.Font]$font, [float]$maxWidth) {
  $words = (U $text) -split " "
  $lines = New-Object System.Collections.Generic.List[string]
  $line = ""
  foreach ($word in $words) {
    $candidate = if ($line.Length -eq 0) { $word } else { "$line $word" }
    if ($g.MeasureString($candidate, $font).Width -le $maxWidth) {
      $line = $candidate
    } else {
      if ($line.Length -gt 0) { $lines.Add($line) }
      $line = $word
    }
  }
  if ($line.Length -gt 0) { $lines.Add($line) }
  return $lines
}

function Draw-Wrap($g, [string]$text, [System.Drawing.Font]$font, [System.Drawing.Color]$color, [float]$x, [float]$y, [float]$maxWidth, [float]$lineHeight, [int]$maxLines = 99) {
  $b = Brush $color
  $lines = @(Split-Lines $g $text $font $maxWidth)
  $count = [Math]::Min($maxLines, $lines.Count)
  for ($i = 0; $i -lt $count; $i++) {
    $g.DrawString($lines[$i], $font, $b, $x, $y + ($i * $lineHeight))
  }
  $b.Dispose()
  return $count * $lineHeight
}

function Draw-Pill($g, [float]$x, [float]$y, [float]$w, [float]$h, [string]$text, [System.Drawing.Color]$fill, [System.Drawing.Color]$color) {
  Fill-RoundRect $g (Brush $fill) $x $y $w $h ($h / 2)
  $font = Font-New 24 "Bold"
  $sz = $g.MeasureString((U $text), $font)
  Draw-Text $g $text $font $color ($x + (($w - $sz.Width) / 2)) ($y + (($h - $sz.Height) / 2) - 1)
  $font.Dispose()
}

function Draw-Logo($g, [float]$x, [float]$y, [float]$scale = 1, [bool]$light = $false) {
  $s = $scale
  $iconW = 70 * $s
  Fill-RoundRect $g (Brush $Brand2) $x $y $iconW $iconW (16 * $s)
  $clockPen = Pen-New ([System.Drawing.Color]::White) (4.2 * $s)
  $clockCx = $x + 35 * $s
  $clockCy = $y + 35 * $s
  $clockR = 18.5 * $s
  $g.DrawEllipse($clockPen, $clockCx - $clockR, $clockCy - $clockR, $clockR * 2, $clockR * 2)
  $g.DrawLine($clockPen, $clockCx, $clockCy, $clockCx, $clockCy - 12.5 * $s)
  $g.DrawLine($clockPen, $clockCx, $clockCy, $clockCx + 13.5 * $s, $clockCy)
  $clockPen.Dispose()
  Fill-RoundRect $g (Brush $Amber) ($x + 52 * $s) ($y + 3 * $s) (24 * $s) (24 * $s) (12 * $s)
  $plusPen = Pen-New ([System.Drawing.Color]::White) (3.4 * $s)
  $plusCx = $x + 64 * $s
  $plusCy = $y + 15 * $s
  $g.DrawLine($plusPen, $plusCx, $plusCy - 6 * $s, $plusCx, $plusCy + 6 * $s)
  $g.DrawLine($plusPen, $plusCx - 6 * $s, $plusCy, $plusCx + 6 * $s, $plusCy)
  $plusPen.Dispose()

  $font = Font-New (36 * $s) "Bold"
  $tag = Font-New (13 * $s) "Regular"
  $wordX = $x + 88 * $s
  $mainColor = if ($light) { [System.Drawing.Color]::White } else { $Ink }
  $hoursColor = $Brand2
  $tagColor = $Muted
  if ($light) {
    $hoursColor = $Amber2
    $tagColor = Color-Hex "#D8E2FF"
  }
  Draw-Text $g "Mais" $font $mainColor $wordX ($y + 6 * $s)
  $mw = $g.MeasureString("Mais", $font).Width
  Draw-Text $g "Horas" $font $hoursColor ($wordX + $mw - 2 * $s) ($y + 6 * $s)
  Draw-Text $g "Horas que transformam" $tag $tagColor ($wordX + 2 * $s) ($y + 47 * $s)
  $font.Dispose()
  $tag.Dispose()
}

function Draw-Icon($g, [string]$type, [float]$x, [float]$y, [float]$size, [System.Drawing.Color]$color) {
  $pen = Pen-New $color ([Math]::Max(3, $size / 14))
  $b = Brush $color
  switch ($type) {
    "clock" {
      $g.DrawEllipse($pen, $x + $size * .16, $y + $size * .16, $size * .68, $size * .68)
      $g.DrawLine($pen, $x + $size * .5, $y + $size * .5, $x + $size * .5, $y + $size * .31)
      $g.DrawLine($pen, $x + $size * .5, $y + $size * .5, $x + $size * .65, $y + $size * .5)
    }
    "qr" {
      Draw-QrGlyph $g $x $y $size $color
    }
    "cert" {
      Stroke-RoundRect $g $pen ($x + $size * .22) ($y + $size * .12) ($size * .54) ($size * .72) ($size * .06)
      $g.DrawLine($pen, $x + $size * .32, $y + $size * .32, $x + $size * .66, $y + $size * .32)
      $g.DrawLine($pen, $x + $size * .32, $y + $size * .45, $x + $size * .62, $y + $size * .45)
      $g.FillEllipse($b, $x + $size * .44, $y + $size * .57, $size * .18, $size * .18)
    }
    "users" {
      $g.DrawEllipse($pen, $x + $size * .18, $y + $size * .18, $size * .24, $size * .24)
      $g.DrawEllipse($pen, $x + $size * .56, $y + $size * .18, $size * .24, $size * .24)
      $g.DrawArc($pen, $x + $size * .10, $y + $size * .48, $size * .42, $size * .34, 200, 140)
      $g.DrawArc($pen, $x + $size * .48, $y + $size * .48, $size * .42, $size * .34, 200, 140)
    }
    "calendar" {
      Stroke-RoundRect $g $pen ($x + $size * .16) ($y + $size * .20) ($size * .68) ($size * .62) ($size * .08)
      $g.DrawLine($pen, $x + $size * .16, $y + $size * .38, $x + $size * .84, $y + $size * .38)
      $g.DrawLine($pen, $x + $size * .32, $y + $size * .12, $x + $size * .32, $y + $size * .26)
      $g.DrawLine($pen, $x + $size * .68, $y + $size * .12, $x + $size * .68, $y + $size * .26)
    }
    "shield" {
      $pts = @(
        (New-Object System.Drawing.PointF ($x + $size * .5), ($y + $size * .12)),
        (New-Object System.Drawing.PointF ($x + $size * .78), ($y + $size * .24)),
        (New-Object System.Drawing.PointF ($x + $size * .72), ($y + $size * .64)),
        (New-Object System.Drawing.PointF ($x + $size * .5), ($y + $size * .84)),
        (New-Object System.Drawing.PointF ($x + $size * .28), ($y + $size * .64)),
        (New-Object System.Drawing.PointF ($x + $size * .22), ($y + $size * .24))
      )
      $g.DrawPolygon($pen, $pts)
      $g.DrawLines($pen, @(
        (New-Object System.Drawing.PointF ($x + $size * .38), ($y + $size * .50)),
        (New-Object System.Drawing.PointF ($x + $size * .47), ($y + $size * .59)),
        (New-Object System.Drawing.PointF ($x + $size * .65), ($y + $size * .40))
      ))
    }
    "search" {
      $g.DrawEllipse($pen, $x + $size * .20, $y + $size * .20, $size * .46, $size * .46)
      $g.DrawLine($pen, $x + $size * .60, $y + $size * .60, $x + $size * .80, $y + $size * .80)
    }
    "building" {
      Stroke-RoundRect $g $pen ($x + $size * .20) ($y + $size * .18) ($size * .60) ($size * .66) ($size * .05)
      for ($r = 0; $r -lt 3; $r++) {
        for ($c = 0; $c -lt 2; $c++) {
          Fill-RoundRect $g $b ($x + $size * (.32 + .22 * $c)) ($y + $size * (.30 + .16 * $r)) ($size * .08) ($size * .07) ($size * .015)
        }
      }
    }
    "code" {
      $g.DrawLines($pen, @(
        (New-Object System.Drawing.PointF ($x + $size * .42), ($y + $size * .28)),
        (New-Object System.Drawing.PointF ($x + $size * .26), ($y + $size * .50)),
        (New-Object System.Drawing.PointF ($x + $size * .42), ($y + $size * .72))
      ))
      $g.DrawLines($pen, @(
        (New-Object System.Drawing.PointF ($x + $size * .58), ($y + $size * .28)),
        (New-Object System.Drawing.PointF ($x + $size * .74), ($y + $size * .50)),
        (New-Object System.Drawing.PointF ($x + $size * .58), ($y + $size * .72))
      ))
    }
    default {
      $g.FillEllipse($b, $x + $size * .25, $y + $size * .25, $size * .5, $size * .5)
    }
  }
  $pen.Dispose()
  $b.Dispose()
}

function Draw-IconBadge($g, [string]$icon, [float]$x, [float]$y, [float]$size, [System.Drawing.Color]$fill, [System.Drawing.Color]$color) {
  Fill-RoundRect $g (Brush $fill) $x $y $size $size ($size * .22)
  Draw-Icon $g $icon ($x + $size * .16) ($y + $size * .16) ($size * .68) $color
}

function Draw-QrGlyph($g, [float]$x, [float]$y, [float]$size, [System.Drawing.Color]$color) {
  $cell = $size / 9.0
  $b = Brush $color
  $p = Pen-New $color ([Math]::Max(2, $size / 18))
  function FinderGlyph([int]$cx, [int]$cy) {
    Stroke-RoundRect $g $p ($x + $cx * $cell) ($y + $cy * $cell) ($cell * 2.2) ($cell * 2.2) ($cell * .25)
    Fill-RoundRect $g $b ($x + ($cx + .72) * $cell) ($y + ($cy + .72) * $cell) ($cell * .74) ($cell * .74) ($cell * .12)
  }
  FinderGlyph 0 0
  FinderGlyph 6 0
  FinderGlyph 0 6
  $mods = @(
    @(3,0), @(4,0), @(4,1), @(3,2), @(5,3), @(7,3),
    @(3,4), @(4,4), @(6,4), @(8,4), @(2,5), @(5,5),
    @(4,6), @(5,7), @(7,7), @(8,8)
  )
  foreach ($m in $mods) {
    Fill-RoundRect $g $b ($x + $m[0] * $cell) ($y + $m[1] * $cell) ($cell * .72) ($cell * .72) ($cell * .08)
  }
  $p.Dispose()
  $b.Dispose()
}

function Draw-QrImage($g, [string]$path, [float]$x, [float]$y, [float]$size, [System.Drawing.Color]$fallbackColor) {
  if (Test-Path $path) {
    $img = [System.Drawing.Image]::FromFile($path)
    $oldInterpolation = $g.InterpolationMode
    $oldSmoothing = $g.SmoothingMode
    $oldPixel = $g.PixelOffsetMode
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
    $g.DrawImage($img, $x, $y, $size, $size)
    $g.InterpolationMode = $oldInterpolation
    $g.SmoothingMode = $oldSmoothing
    $g.PixelOffsetMode = $oldPixel
    $img.Dispose()
  } else {
    Draw-QR $g $x $y $size $fallbackColor $Paper
  }
}

function Draw-QR($g, [float]$x, [float]$y, [float]$size, [System.Drawing.Color]$fg, [System.Drawing.Color]$bg) {
  if ($bg.A -gt 0) { Fill-RoundRect $g (Brush $bg) $x $y $size $size 12 }
  $cell = $size / 21.0
  $b = Brush $fg
  function Finder([int]$cx, [int]$cy) {
    $g.FillRectangle($b, $x + $cx * $cell, $y + $cy * $cell, $cell * 7, $cell * 7)
    $wb = Brush ([System.Drawing.Color]::White)
    $g.FillRectangle($wb, $x + ($cx + 1) * $cell, $y + ($cy + 1) * $cell, $cell * 5, $cell * 5)
    $g.FillRectangle($b, $x + ($cx + 2) * $cell, $y + ($cy + 2) * $cell, $cell * 3, $cell * 3)
    $wb.Dispose()
  }
  Finder 1 1
  Finder 13 1
  Finder 1 13
  for ($r = 0; $r -lt 21; $r++) {
    for ($c = 0; $c -lt 21; $c++) {
      $inFinder = (($r -ge 1 -and $r -le 7 -and $c -ge 1 -and $c -le 7) -or ($r -ge 1 -and $r -le 7 -and $c -ge 13 -and $c -le 19) -or ($r -ge 13 -and $r -le 19 -and $c -ge 1 -and $c -le 7))
      if (-not $inFinder -and ((($r * 7 + $c * 11 + $r * $c) % 5 -eq 0) -or (($r + $c) % 13 -eq 0))) {
        $g.FillRectangle($b, $x + $c * $cell, $y + $r * $cell, $cell * .86, $cell * .86)
      }
    }
  }
  $b.Dispose()
}

function Draw-ImageCover($g, [System.Drawing.Image]$img, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $scale = [Math]::Max($w / $img.Width, $h / $img.Height)
  $sw = $w / $scale
  $sh = $h / $scale
  $sx = ($img.Width - $sw) / 2
  $sy = ($img.Height - $sh) / 2
  $dest = New-Object System.Drawing.RectangleF($x, $y, $w, $h)
  $src = New-Object System.Drawing.RectangleF($sx, $sy, $sw, $sh)
  $state = $g.Save()
  $clip = RoundPath $x $y $w $h $r
  $g.SetClip($clip)
  $g.DrawImage($img, $dest, $src, [System.Drawing.GraphicsUnit]::Pixel)
  $g.Restore($state)
  $clip.Dispose()
}

function New-Slide([bool]$dark = $false) {
  $bmp = New-Object System.Drawing.Bitmap($W, $H, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  if ($dark) {
    $lg = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
      (New-Object System.Drawing.Rectangle(0, 0, $W, $H)),
      $Navy,
      $Brand,
      22
    )
    $g.FillRectangle($lg, 0, 0, $W, $H)
    $lg.Dispose()
  } else {
    $g.Clear($Bg)
    $lg = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
      (New-Object System.Drawing.Rectangle(0, 0, $W, 360)),
      (Color-Hex "#EAF0FF"),
      $Bg,
      90
    )
    $g.FillRectangle($lg, 0, 0, $W, 360)
    $lg.Dispose()
  }
  return @{ Bitmap = $bmp; Graphics = $g }
}

function Save-Slide($slide, [int]$n) {
  $png = Join-Path $SlideDir ("slide-{0:D2}.png" -f $n)
  $jpg = Join-Path $SlideDir ("slide-{0:D2}.jpg" -f $n)
  $slide.Bitmap.Save($png, [System.Drawing.Imaging.ImageFormat]::Png)
  $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
  $ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 94L)
  $slide.Bitmap.Save($jpg, $codec, $ep)
  $ep.Dispose()
  $slide.Graphics.Dispose()
  $slide.Bitmap.Dispose()
  return $jpg
}

function Draw-Header($g, [string]$kicker, [string]$title, [int]$n) {
  Draw-Logo $g 90 54 .72 $false
  $small = Font-New 22 "Bold"
  $num = Font-New 24 "Bold"
  Draw-Text $g ("{0:D2}" -f $n) $num $Muted 1785 68
  Draw-Pill $g 90 160 260 44 $kicker $SoftBlue $Brand
  $titleFont = Font-New 54 "Bold"
  Draw-Wrap $g $title $titleFont $Ink 90 220 1230 66 2 | Out-Null
  $small.Dispose()
  $num.Dispose()
  $titleFont.Dispose()
}

function Draw-Bullet($g, [float]$x, [float]$y, [string]$text, [System.Drawing.Color]$accent) {
  Fill-RoundRect $g (Brush $accent) $x ($y + 7) 14 14 7
  $font = Font-New 26 "Regular"
  Draw-Wrap $g $text $font $Ink ($x + 30) $y 560 34 2 | Out-Null
  $font.Dispose()
}

function Draw-MiniBrowser($g, [float]$x, [float]$y, [float]$w, [float]$h, [string]$title) {
  Draw-ShadowCard $g $x $y $w $h 28 $Paper $Line
  Fill-RoundRect $g (Brush (Color-Hex "#F8FAFF")) $x $y $w 70 28
  $dotBrushes = @((Brush (Color-Hex "#FF6B6B")), (Brush (Color-Hex "#FFD166")), (Brush (Color-Hex "#43D28B")))
  for ($i = 0; $i -lt 3; $i++) {
    $g.FillEllipse($dotBrushes[$i], $x + 30 + $i * 28, $y + 28, 14, 14)
    $dotBrushes[$i].Dispose()
  }
  $font = Font-New 20 "Bold"
  Draw-Text $g $title $font $Muted ($x + 132) ($y + 23)
  $font.Dispose()
  $p = Pen-New $Line 2
  $g.DrawLine($p, $x, $y + 70, $x + $w, $y + 70)
  $p.Dispose()
}

function Draw-StatMini($g, [float]$x, [float]$y, [float]$w, [string]$label, [string]$value, [System.Drawing.Color]$accent, [string]$icon) {
  Draw-ShadowCard $g $x $y $w 118 18 $Paper $Line
  Draw-IconBadge $g $icon ($x + $w - 78) ($y + 25) 50 (Color-Hex "#E8EDFB") $accent
  $lf = Font-New 16 "Bold"
  $vf = Font-New 38 "Bold"
  Draw-Text $g $label $lf $Muted ($x + 24) ($y + 22)
  Draw-Text $g $value $vf $accent ($x + 24) ($y + 50)
  $lf.Dispose()
  $vf.Dispose()
}

function Draw-ActivityRow($g, [float]$x, [float]$y, [float]$w, [string]$title, [string]$meta, [string]$badge, [System.Drawing.Color]$accent) {
  Fill-RoundRect $g (Brush (Color-Hex "#FFFFFF")) $x $y $w 78 16
  Stroke-RoundRect $g (Pen-New $Line 1.6) $x $y $w 78 16
  $tf = Font-New 22 "Bold"
  $mf = Font-New 18 "Regular"
  Draw-Text $g $title $tf $Ink ($x + 24) ($y + 13)
  Draw-Text $g $meta $mf $Muted ($x + 24) ($y + 43)
  Draw-Pill $g ($x + $w - 178) ($y + 22) 138 34 $badge (Color-Hex "#E8EDFB") $accent
  $tf.Dispose()
  $mf.Dispose()
}

function Draw-ActivityRowCompact($g, [float]$x, [float]$y, [float]$w, [string]$title, [string]$meta, [string]$badge, [System.Drawing.Color]$accent) {
  Fill-RoundRect $g (Brush (Color-Hex "#FFFFFF")) $x $y $w 66 14
  Stroke-RoundRect $g (Pen-New $Line 1.5) $x $y $w 66 14
  $tf = Font-New 20 "Bold"
  $mf = Font-New 16 "Regular"
  Draw-Text $g $title $tf $Ink ($x + 22) ($y + 10)
  Draw-Text $g $meta $mf $Muted ($x + 22) ($y + 37)
  Draw-Pill $g ($x + $w - 152) ($y + 17) 116 30 $badge (Color-Hex "#E8EDFB") $accent
  $tf.Dispose()
  $mf.Dispose()
}

function Draw-StudentMockup($g, [float]$x, [float]$y, [float]$w, [float]$h) {
  Draw-MiniBrowser $g $x $y $w $h "Painel do estudante"
  Fill-RoundRect $g (Brush (Color-Hex "#F8FAFF")) ($x + 0) ($y + 70) 210 ($h - 70) 0
  $navF = Font-New 19 "Bold"
  Draw-Logo $g ($x + 28) ($y + 102) .52 $false
  $items = @(
    @("Buscar vagas", "search", $true),
    @("Minhas inscri\u00e7\u00f5es", "calendar", $false),
    @("Certificados", "cert", $false),
    @("Perfil", "users", $false)
  )
  for ($i = 0; $i -lt $items.Count; $i++) {
    $iy = $y + 220 + $i * 68
    $itemActive = [bool]$items[$i][2]
    $fill = Color-Hex "#F8FAFF"
    $itemColor = $Muted
    if ($itemActive) {
      $fill = $SoftBlue
      $itemColor = $Brand
    }
    Fill-RoundRect $g (Brush $fill) ($x + 24) $iy 162 46 23
    Draw-Icon $g $items[$i][1] ($x + 38) ($iy + 12) 22 $itemColor
    Draw-Text $g $items[$i][0] $navF $itemColor ($x + 68) ($iy + 10)
  }
  $navF.Dispose()
  $cx = $x + 250
  $cy = $y + 112
  $h1 = Font-New 34 "Bold"
  $body = Font-New 20 "Regular"
  Draw-Text $g "Ol\u00e1, estudante" $h1 $Ink $cx $cy
  Draw-Text $g "Acompanhe suas horas, inscri\u00e7\u00f5es e certificados." $body $Muted $cx ($cy + 48)
  Draw-StatMini $g $cx ($cy + 96) 245 "HORAS VALIDADAS" "12h" $Brand "clock"
  Draw-StatMini $g ($cx + 275) ($cy + 96) 245 "CERTIFICADOS" "3" $Navy2 "cert"
  Draw-StatMini $g ($cx + 550) ($cy + 96) 245 "PENDENCIAS" "1" $Amber "calendar"
  $sectionFont = Font-New 22 "Bold"
  Draw-Text $g "Atividades recentes" $sectionFont $Ink $cx ($cy + 245)
  Draw-ActivityRowCompact $g $cx ($cy + 285) 795 "Doa\u00e7\u00e3o de alimentos" "12/06 - Casa Florian - 4h" "Aberta" $Green
  Draw-ActivityRowCompact $g $cx ($cy + 359) 795 "Mutir\u00e3o de limpeza" "15/06 - Praia de Iracema - 3h" "Inscrito" $Brand
  Draw-ActivityRowCompact $g $cx ($cy + 433) 795 "Oficina solid\u00e1ria" "20/06 - UniC Fortaleza - 2h" "QR Code" $Amber
  $h1.Dispose()
  $body.Dispose()
  $sectionFont.Dispose()
}

function Draw-OrgMockup($g, [float]$x, [float]$y, [float]$w, [float]$h) {
  Draw-MiniBrowser $g $x $y $w $h "Painel da organiza\u00e7\u00e3o"
  $cx = $x + 52
  $cy = $y + 116
  $h1 = Font-New 34 "Bold"
  $body = Font-New 20 "Regular"
  Draw-Text $g "Ol\u00e1, organiza\u00e7\u00e3o!" $h1 $Ink $cx $cy
  Draw-Text $g "Publique atividades, acompanhe inscri\u00e7\u00f5es e valide presen\u00e7as." $body $Muted $cx ($cy + 48)
  Draw-Pill $g ($x + $w - 260) ($cy + 8) 190 48 "Nova atividade" $Amber $Paper
  Draw-StatMini $g $cx ($cy + 96) 255 "ATIVIDADES" "8" $Navy2 "calendar"
  Draw-StatMini $g ($cx + 285) ($cy + 96) 255 "ATIVAS" "5" $Brand "building"
  Draw-StatMini $g ($cx + 570) ($cy + 96) 255 "FINALIZADAS" "3" $Green "shield"
  $formX = $cx
  $formY = $cy + 250
  Draw-ShadowCard $g $formX $formY 405 220 22 (Color-Hex "#FFFFFF") $Line
  $tf = Font-New 23 "Bold"
  $sf = Font-New 16 "Bold"
  Draw-Text $g "Publicar oportunidade" $tf $Ink ($formX + 26) ($formY + 20)
  foreach ($i in 0..2) {
    Fill-RoundRect $g (Brush (Color-Hex "#F3F6FC")) ($formX + 26) ($formY + 58 + $i * 44) 353 34 10
  }
  Draw-Text $g "T\u00edtulo da atividade" $sf $Muted ($formX + 44) ($formY + 65)
  Draw-Text $g "Data, local e carga hor\u00e1ria" $sf $Muted ($formX + 44) ($formY + 109)
  Draw-Text $g "Limite de participantes" $sf $Muted ($formX + 44) ($formY + 153)
  Draw-Pill $g ($formX + 228) ($formY + 180) 150 34 "Publicar" $Brand $Paper

  $listX = $formX + 445
  $sectionFont = Font-New 22 "Bold"
  Draw-Text $g "Atividades em andamento" $sectionFont $Ink $listX ($formY + 2)
  Draw-ActivityRowCompact $g $listX ($formY + 40) 470 "Campanha solid\u00e1ria" "18 inscritos - 4h" "Validar" $Amber
  Draw-ActivityRowCompact $g $listX ($formY + 104) 470 "Apoio a idosos" "9 inscritos - 3h" "Ativa" $Brand
  Draw-ActivityRowCompact $g $listX ($formY + 168) 470 "Arrecada\u00e7\u00e3o" "Certificados prontos" "Emitir" $Green
  $h1.Dispose()
  $body.Dispose()
  $tf.Dispose()
  $sf.Dispose()
  $sectionFont.Dispose()
}

function Draw-CertificateMockup($g, [float]$x, [float]$y, [float]$w, [float]$h) {
  Draw-ShadowCard $g $x $y $w $h 28 $Paper $Line
  $title = Font-New 42 "Bold"
  $body = Font-New 24 "Regular"
  Draw-Logo $g ($x + 56) ($y + 46) .55 $false
  Draw-Text $g "Certificado de Participa\u00e7\u00e3o" $title $Navy2 ($x + 56) ($y + 158)
  Draw-Wrap $g "Certificamos que Maria Aluna participou da atividade Doa\u00e7\u00e3o de Alimentos, realizada pela Casa Florian, com carga hor\u00e1ria de 4 horas." $body $Ink ($x + 56) ($y + 232) ($w - 360) 36 4 | Out-Null
  Draw-Pill $g ($x + 56) ($y + $h - 118) 260 50 "4 horas validadas" $SoftBlue $Brand
  Draw-Pill $g ($x + 340) ($y + $h - 118) 330 50 "C\u00f3digo: MH-649ECE45" $SoftAmber $Amber
  Draw-QrImage $g $QrCertificatePath ($x + $w - 262) ($y + $h - 282) 205 $Brand
  $small = Font-New 18 "Bold"
  Draw-Text $g "Verifica\u00e7\u00e3o p\u00fablica por QR Code" $small $Muted ($x + $w - 318) ($y + $h - 80)
  $title.Dispose()
  $body.Dispose()
  $small.Dispose()
}

function Slide1 {
  $s = New-Slide $true
  $g = $s.Graphics
  $photoPath = Join-Path $ProjectRoot "frontend\public\hero-voluntariado.jpg"
  if (Test-Path $photoPath) {
    $img = [System.Drawing.Image]::FromFile($photoPath)
    Draw-ImageCover $g $img 1110 94 690 708 34
    Fill-RoundRect $g (Brush (Color-Hex "#0F2570" 82)) 1110 94 690 708 34
    $img.Dispose()
  }
  Draw-Logo $g 86 72 .92 $true
  Draw-Pill $g 90 220 650 52 "Projeto de Extens\u00e3o III | Apresenta\u00e7\u00e3o para a comunidade" (Color-Hex "#FFFFFF" 28) ([System.Drawing.Color]::White)
  $title = Font-New 116 "Bold"
  $sub = Font-New 42 "Regular"
  Draw-Text $g "Mais Horas" $title ([System.Drawing.Color]::White) 86 318
  Draw-Wrap $g "Sistema de Gest\u00e3o de Voluntariado Universit\u00e1rio" $sub (Color-Hex "#D8E2FF") 96 455 760 52 2 | Out-Null
  $tag = Font-New 30 "Bold"
  Draw-Text $g "Horas de extens\u00e3o com menos burocracia e mais impacto social." $tag $Amber2 96 575
  Draw-ShadowCard $g 1100 710 710 230 28 (Color-Hex "#FFFFFF") (Color-Hex "#D8E2FF")
  Draw-IconBadge $g "shield" 1145 752 76 $SoftBlue $Brand
  $cf = Font-New 30 "Bold"
  $bf = Font-New 22 "Regular"
  Draw-Text $g "Certificado verific\u00e1vel" $cf $Ink 1245 750
  Draw-Wrap $g "A presen\u00e7a confirmada pela ONG gera um documento com c\u00f3digo \u00fanico e verifica\u00e7\u00e3o p\u00fablica." $bf $Muted 1245 794 370 31 3 | Out-Null
  Draw-QrImage $g $QrCertificatePath 1650 748 118 $Brand
  $team = Font-New 22 "Bold"
  Draw-Text $g "Equipe: Pedro Batista (l\u00edder), Ismael Brand\u00e3o e Ant\u00f4nio Yarlen" $team (Color-Hex "#D8E2FF") 96 950
  $title.Dispose()
  $sub.Dispose()
  $tag.Dispose()
  $cf.Dispose()
  $bf.Dispose()
  $team.Dispose()
  return Save-Slide $s 1
}

function Slide2 {
  $s = New-Slide
  $g = $s.Graphics
  Draw-Header $g "T\u00edtulo e introdu\u00e7\u00e3o" "Mais Horas para a comunidade" 2
  $lead = Font-New 30 "Regular"
  Draw-Wrap $g "O Mais Horas nasce para conectar estudantes universit\u00e1rios e ONGs em um fluxo simples: encontrar oportunidades, participar das a\u00e7\u00f5es sociais e comprovar horas com mais confian\u00e7a para a comunidade acad\u00eamica." $lead $Muted 90 350 1280 42 3 | Out-Null
  $cards = @(
    @("search", "Oportunidades dispersas", "Vagas aparecem em grupos, cartazes e contatos informais."),
    @("calendar", "Comprova\u00e7\u00e3o manual", "Assinaturas, listas de presen\u00e7a e PDFs edit\u00e1veis aumentam a burocracia."),
    @("building", "ONGs sem ferramenta", "Organiza\u00e7\u00f5es gerenciam volunt\u00e1rios com planilhas e controles improvisados."),
    @("shield", "Baixa confiabilidade", "A faculdade precisa conferir se a hora realmente foi cumprida e validada.")
  )
  for ($i = 0; $i -lt 4; $i++) {
    $x = 90 + $i * 455
    Draw-ShadowCard $g $x 500 390 350 24 $Paper $Line
    $badgeFill = $SoftAmber
    $badgeColor = $Amber
    if ($i % 2 -eq 0) {
      $badgeFill = $SoftBlue
      $badgeColor = $Brand
    }
    Draw-IconBadge $g $cards[$i][0] ($x + 34) 534 72 $badgeFill $badgeColor
    $tf = Font-New 29 "Bold"
    $bf = Font-New 21 "Regular"
    Draw-Wrap $g $cards[$i][1] $tf $Ink ($x + 34) 632 315 36 2 | Out-Null
    Draw-Wrap $g $cards[$i][2] $bf $Muted ($x + 34) 715 315 29 4 | Out-Null
    $tf.Dispose()
    $bf.Dispose()
  }
  Draw-Pill $g 90 920 1000 50 "Introdu\u00e7\u00e3o: uma ponte confi\u00e1vel entre alunos, ONGs e universidade" $Navy2 $Paper
  $lead.Dispose()
  return Save-Slide $s 2
}

function Slide3 {
  $s = New-Slide
  $g = $s.Graphics
  Draw-Header $g "Comunidade" "Quem \u00e9 beneficiado pela solu\u00e7\u00e3o" 3
  $groups = @(
    @("users", "Estudantes", "Encontram oportunidades reais, acompanham inscri\u00e7\u00f5es e recebem certificados sem papelada.", $Brand),
    @("building", "ONGs", "Divulgam a\u00e7\u00f5es, gerenciam volunt\u00e1rios e validam presen\u00e7a em um fluxo organizado.", $Navy2),
    @("shield", "Faculdade e comunidade", "Ganham rastreabilidade, comprova\u00e7\u00f5es verific\u00e1veis e mais participa\u00e7\u00e3o social.", $Amber)
  )
  for ($i = 0; $i -lt 3; $i++) {
    $x = 110 + $i * 600
    Draw-ShadowCard $g $x 340 500 430 28 $Paper $Line
    $badgeFill = $SoftBlue
    if ($i -eq 2) { $badgeFill = $SoftAmber }
    Draw-IconBadge $g $groups[$i][0] ($x + 44) 390 92 $badgeFill $groups[$i][3]
    $tf = Font-New 36 "Bold"
    $bf = Font-New 25 "Regular"
    Draw-Text $g $groups[$i][1] $tf $Ink ($x + 44) 520
    Draw-Wrap $g $groups[$i][2] $bf $Muted ($x + 44) 590 395 36 4 | Out-Null
    $tf.Dispose()
    $bf.Dispose()
  }
  $linePen = Pen-New $Brand 5
  $g.DrawLine($linePen, 370, 845, 1540, 845)
  $linePen.Dispose()
  Draw-Pill $g 260 820 280 62 "Acesso" $SoftBlue $Brand
  Draw-Pill $g 760 820 340 62 "Organiza\u00e7\u00e3o" $SoftAmber $Amber
  Draw-Pill $g 1310 820 300 62 "Confian\u00e7a" $SoftBlue $Brand
  return Save-Slide $s 3
}

function Slide4 {
  $s = New-Slide
  $g = $s.Graphics
  Draw-Header $g "Comunidade" "P\u00fablico-alvo e necessidades atendidas" 4
  Draw-ShadowCard $g 100 355 760 560 30 $Paper $Line
  $tf = Font-New 36 "Bold"
  $bf = Font-New 25 "Regular"
  Draw-Text $g "Perfil atendido" $tf $Ink 150 405
  Draw-Bullet $g 150 495 "Alunos universit\u00e1rios que precisam cumprir horas de extens\u00e3o." $Brand
  Draw-Bullet $g 150 605 "ONGs e institui\u00e7\u00f5es sociais que precisam divulgar a\u00e7\u00f5es e organizar volunt\u00e1rios." $Amber
  Draw-Bullet $g 150 715 "Coordena\u00e7\u00e3o acad\u00eamica que precisa conferir comprovantes de forma segura e r\u00e1pida." $Green
  Draw-ShadowCard $g 990 355 760 560 30 $Navy2 (Color-Hex "#D8E2FF")
  Draw-Text $g "Como o Mais Horas atende" $tf ([System.Drawing.Color]::White) 1040 405
  $items = @(
    @("Centraliza oportunidades de voluntariado em um s\u00f3 lugar.", "search"),
    @("Transforma presen\u00e7a e certificados em um fluxo digital.", "qr"),
    @("Cria evid\u00eancias verific\u00e1veis para a faculdade e para a comunidade.", "shield")
  )
  for ($i = 0; $i -lt 3; $i++) {
    $iy = 505 + $i * 125
    Draw-IconBadge $g $items[$i][1] 1040 $iy 72 (Color-Hex "#FFFFFF" 22) $Amber2
    Draw-Wrap $g $items[$i][0] $bf (Color-Hex "#EAF0FF") 1130 ($iy + 8) 560 34 2 | Out-Null
  }
  $tf.Dispose()
  $bf.Dispose()
  return Save-Slide $s 4
}

function Slide5 {
  $s = New-Slide
  $g = $s.Graphics
  Draw-Header $g "Objetivos" "O que o projeto se prop\u00f5e a entregar" 5
  Draw-ShadowCard $g 90 345 1760 205 30 $Navy2 (Color-Hex "#D8E2FF")
  $label = Font-New 24 "Bold"
  $obj = Font-New 42 "Bold"
  Draw-Text $g "OBJETIVO GERAL" $label (Color-Hex "#D8E2FF") 140 385
  Draw-Wrap $g "Desenvolver uma plataforma web que facilite o acesso a atividades de extens\u00e3o, conectando alunos e ONGs e reduzindo a burocracia." $obj ([System.Drawing.Color]::White) 140 430 1610 52 2 | Out-Null
  $items = @(
    @("search", "Mapear dores", "Pesquisa com alunos e ONGs"),
    @("code", "Criar plataforma", "Cadastro, login e inscri\u00e7\u00e3o"),
    @("users", "Desenhar interfaces", "Fluxos para aluno e ONG"),
    @("qr", "Validar presen\u00e7a", "QR Code no evento"),
    @("cert", "Emitir certificados", "C\u00f3digo verific\u00e1vel"),
    @("shield", "Realizar piloto", "Teste em ambiente universit\u00e1rio")
  )
  for ($i = 0; $i -lt 6; $i++) {
    $row = [Math]::Floor($i / 3)
    $col = $i % 3
    $x = 90 + $col * 600
    $y = 620 + $row * 170
    Draw-ShadowCard $g $x $y 520 130 22 $Paper $Line
    $badgeFill = $SoftAmber
    $badgeColor = $Amber
    if ($i % 2 -eq 0) {
      $badgeFill = $SoftBlue
      $badgeColor = $Brand
    }
    Draw-IconBadge $g $items[$i][0] ($x + 24) ($y + 24) 78 $badgeFill $badgeColor
    $tf = Font-New 28 "Bold"
    $bf = Font-New 21 "Regular"
    Draw-Text $g $items[$i][1] $tf $Ink ($x + 120) ($y + 27)
    Draw-Wrap $g $items[$i][2] $bf $Muted ($x + 120) ($y + 68) 360 28 2 | Out-Null
    $tf.Dispose()
    $bf.Dispose()
  }
  $label.Dispose()
  $obj.Dispose()
  return Save-Slide $s 5
}

function Slide6 {
  $s = New-Slide
  $g = $s.Graphics
  Draw-Header $g "Plano de projeto" "Metodologia, ferramentas e recursos" 6
  $phases = @(
    @("Imers\u00e3o", "Pesquisa sobre dores de alunos e ONGs.", "search", $Brand),
    @("Prova de conceito", "Valida\u00e7\u00e3o da stack e arquitetura.", "code", $Navy2),
    @("Desenvolvimento", "Ciclos curtos de entrega e ajustes.", "calendar", $Amber),
    @("Piloto", "Teste com usu\u00e1rios reais e coleta de melhorias.", "users", $Green)
  )
  for ($i = 0; $i -lt 4; $i++) {
    $x = 90 + $i * 440
    Draw-ShadowCard $g $x 345 380 310 24 $Paper $Line
    $badgeFill = $SoftBlue
    if ($i -eq 2) { $badgeFill = $SoftAmber }
    Draw-IconBadge $g $phases[$i][2] ($x + 34) 385 78 $badgeFill $phases[$i][3]
    $tf = Font-New 30 "Bold"
    $bf = Font-New 23 "Regular"
    Draw-Text $g $phases[$i][0] $tf $Ink ($x + 34) 500
    Draw-Wrap $g $phases[$i][1] $bf $Muted ($x + 34) 555 300 32 3 | Out-Null
    $tf.Dispose()
    $bf.Dispose()
  }
  $groups = @(
    @("Humanos", "Equipe de ADS, professor orientador, alunos e ONGs parceiras."),
    @("Tecnol\u00f3gicos", "React, Node.js, Express, PostgreSQL, QR Code, GitHub e Live Share."),
    @("Materiais", "Ambiente web, computadores, celulares para leitura de QR e espa\u00e7o do piloto.")
  )
  for ($i = 0; $i -lt 3; $i++) {
    $x = 90 + $i * 600
    Draw-ShadowCard $g $x 730 520 175 22 $Navy2 (Color-Hex "#D8E2FF")
    $tf = Font-New 29 "Bold"
    $bf = Font-New 22 "Regular"
    Draw-Text $g $groups[$i][0] $tf ([System.Drawing.Color]::White) ($x + 32) 758
    Draw-Wrap $g $groups[$i][1] $bf (Color-Hex "#D8E2FF") ($x + 32) 805 455 31 3 | Out-Null
    $tf.Dispose()
    $bf.Dispose()
  }
  return Save-Slide $s 6
}

function Slide7 {
  $s = New-Slide
  $g = $s.Graphics
  Draw-Header $g "Cronograma" "Execu\u00e7\u00e3o de fevereiro a junho" 7
  Draw-ShadowCard $g 110 340 1700 570 30 $Paper $Line
  $months = @("Fev", "Mar", "Abr", "Mai", "Jun")
  $mx0 = 790
  $mw = 145
  $hf = Font-New 24 "Bold"
  for ($i = 0; $i -lt $months.Count; $i++) {
    $monthFill = $SoftBlue
    $monthColor = $Brand
    if ($i -eq 4) {
      $monthFill = $SoftAmber
      $monthColor = $Amber
    }
    Fill-RoundRect $g (Brush $monthFill) ($mx0 + $i * $mw) 390 110 46 18
    Draw-Text $g $months[$i] $hf $monthColor ($mx0 + $i * $mw + 30) 398
  }
  $rows = @(
    @("Pesquisa de campo e mapeamento das dores", 0, 0, $Brand),
    @("Defini\u00e7\u00e3o da stack e arquitetura", 1, 1, $Navy2),
    @("Modelagem e prototipa\u00e7\u00e3o das interfaces", 2, 2, $Brand),
    @("Cadastro, inscri\u00e7\u00e3o e pain\u00e9is", 2, 3, $Amber),
    @("QR Code e certificados verific\u00e1veis", 3, 4, $Green),
    @("Piloto universit\u00e1rio e avalia\u00e7\u00e3o", 4, 4, $Navy2)
  )
  $rf = Font-New 24 "Regular"
  for ($i = 0; $i -lt $rows.Count; $i++) {
    $y = 485 + $i * 72
    Draw-Text $g $rows[$i][0] $rf $Ink 165 ($y - 3)
    $start = [int]$rows[$i][1]
    $end = [int]$rows[$i][2]
    $barX = $mx0 + $start * $mw + 8
    $barW = (($end - $start + 1) * $mw) - 36
    Fill-RoundRect $g (Brush (Color-Hex "#EAF0FF")) $mx0 ($y - 8) 700 42 21
    Fill-RoundRect $g (Brush $rows[$i][3]) $barX ($y - 8) $barW 42 21
  }
  Draw-Pill $g 1020 835 490 54 "Entrega final: MVP funcional + apresenta\u00e7\u00e3o" $SoftAmber $Amber
  $hf.Dispose()
  $rf.Dispose()
  return Save-Slide $s 7
}

function Slide8 {
  $s = New-Slide
  $g = $s.Graphics
  Draw-Header $g "Solu\u00e7\u00e3o" "Da vaga ao certificado, em quatro passos" 8
  $steps = @(
    @("1", "A ONG publica", "Define data, local, carga hor\u00e1ria e vagas.", "building", $Navy2),
    @("2", "O aluno encontra", "Busca oportunidades e se inscreve com um clique.", "search", $Brand),
    @("3", "Presen\u00e7a validada", "No evento, o QR Code confirma a participa\u00e7\u00e3o.", "qr", $Amber),
    @("4", "Certificado pronto", "O sistema emite comprovante verific\u00e1vel.", "cert", $Green)
  )
  $linePen = Pen-New $Line 8
  $g.DrawLine($linePen, 250, 565, 1680, 565)
  $linePen.Dispose()
  for ($i = 0; $i -lt 4; $i++) {
    $x = 120 + $i * 455
    Draw-ShadowCard $g $x 385 365 380 26 $Paper $Line
    Fill-RoundRect $g (Brush $steps[$i][4]) ($x + 30) 420 70 70 35
    $nf = Font-New 32 "Bold"
    Draw-Text $g $steps[$i][0] $nf $Paper ($x + 52) 431
    $badgeFill = $SoftBlue
    if ($i -eq 2) { $badgeFill = $SoftAmber }
    Draw-IconBadge $g $steps[$i][3] ($x + 238) 420 72 $badgeFill $steps[$i][4]
    $tf = Font-New 31 "Bold"
    $bf = Font-New 23 "Regular"
    Draw-Wrap $g $steps[$i][1] $tf $Ink ($x + 30) 540 300 38 2 | Out-Null
    Draw-Wrap $g $steps[$i][2] $bf $Muted ($x + 30) 632 300 32 3 | Out-Null
    $nf.Dispose()
    $tf.Dispose()
    $bf.Dispose()
  }
  Draw-Pill $g 555 835 810 58 "Resultado: menos retrabalho, mais controle e comprova\u00e7\u00e3o confi\u00e1vel" $Navy2 $Paper
  return Save-Slide $s 8
}

function Slide9 {
  $s = New-Slide
  $g = $s.Graphics
  Draw-Header $g "Exemplo de tela" "Experi\u00eancia do estudante" 9
  Draw-StudentMockup $g 100 335 1350 620
  $cardX = 1510
  $cardY = 405
  $cardW = 330
  $cardH = 430
  Draw-ShadowCard $g $cardX $cardY $cardW $cardH 28 $Navy2 (Color-Hex "#D8E2FF")
  $tf = Font-New 28 "Bold"
  $bf = Font-New 18 "Regular"
  $valueFont = Font-New 46 "Bold"
  $labelFont = Font-New 20 "Bold"
  Draw-CenteredText $g "Resumo do aluno" $tf ([System.Drawing.Color]::White) $cardX ($cardY + 42) $cardW
  Draw-IconBadge $g "clock" ($cardX + (($cardW - 82) / 2)) ($cardY + 118) 82 (Color-Hex "#FFFFFF" 22) $Amber2
  Draw-CenteredText $g "12h" $valueFont $Amber2 $cardX ($cardY + 218) $cardW
  Draw-CenteredText $g "horas validadas" $labelFont (Color-Hex "#D8E2FF") $cardX ($cardY + 272) $cardW
  Fill-RoundRect $g (Brush (Color-Hex "#FFFFFF" 18)) ($cardX + 42) ($cardY + 332) 118 42 21
  Fill-RoundRect $g (Brush (Color-Hex "#FFFFFF" 18)) ($cardX + 172) ($cardY + 332) 118 42 21
  Draw-CenteredText $g "3 certificados" $bf ([System.Drawing.Color]::White) ($cardX + 42) ($cardY + 341) 118
  Draw-CenteredText $g "1 pend\u00eancia" $bf ([System.Drawing.Color]::White) ($cardX + 172) ($cardY + 341) 118
  $valueFont.Dispose()
  $labelFont.Dispose()
  $tf.Dispose()
  $bf.Dispose()
  return Save-Slide $s 9
}

function Slide10 {
  $s = New-Slide
  $g = $s.Graphics
  Draw-Header $g "Exemplo de tela" "Experi\u00eancia da ONG" 10
  Draw-OrgMockup $g 100 335 1350 620
  $cardX = 1510
  $cardY = 405
  $cardW = 330
  $cardH = 430
  Draw-ShadowCard $g $cardX $cardY $cardW $cardH 28 $Paper $Line
  $tf = Font-New 28 "Bold"
  $bf = Font-New 18 "Regular"
  $valueFont = Font-New 42 "Bold"
  $labelFont = Font-New 19 "Bold"
  Draw-CenteredText $g "Resumo da ONG" $tf $Ink $cardX ($cardY + 42) $cardW
  Draw-IconBadge $g "building" ($cardX + (($cardW - 82) / 2)) ($cardY + 116) 82 $SoftBlue $Brand
  Draw-CenteredText $g "8" $valueFont $Brand $cardX ($cardY + 214) $cardW
  Draw-CenteredText $g "atividades publicadas" $labelFont $Muted $cardX ($cardY + 266) $cardW
  Fill-RoundRect $g (Brush $SoftBlue) ($cardX + 42) ($cardY + 332) 118 42 21
  Fill-RoundRect $g (Brush $SoftAmber) ($cardX + 172) ($cardY + 332) 118 42 21
  Draw-CenteredText $g "5 ativas" $bf $Brand ($cardX + 42) ($cardY + 341) 118
  Draw-CenteredText $g "validar" $bf $Amber ($cardX + 172) ($cardY + 341) 118
  $valueFont.Dispose()
  $labelFont.Dispose()
  $tf.Dispose()
  $bf.Dispose()
  return Save-Slide $s 10
}

function Slide11 {
  $s = New-Slide
  $g = $s.Graphics
  Draw-Header $g "Confian\u00e7a" "Certificado com QR Code e verifica\u00e7\u00e3o p\u00fablica" 11
  Draw-CertificateMockup $g 120 335 1080 600
  Draw-ShadowCard $g 1280 365 560 540 28 $Paper $Line
  Draw-IconBadge $g "shield" 1330 415 92 $SoftBlue $Brand
  $tf = Font-New 34 "Bold"
  $bf = Font-New 24 "Regular"
  Draw-Wrap $g "O desafio \u00e9 provar que a hora \u00e9 verdadeira" $tf $Ink 1330 540 455 44 3 | Out-Null
  Draw-Bullet $g 1330 675 "Presen\u00e7a validada pela ONG respons\u00e1vel." $Brand
  Draw-Bullet $g 1330 755 "C\u00f3digo \u00fanico em cada certificado." $Amber
  Draw-Bullet $g 1330 835 "Consulta p\u00fablica para coordena\u00e7\u00e3o e comunidade." $Green
  $tf.Dispose()
  $bf.Dispose()
  return Save-Slide $s 11
}

function Slide12 {
  $s = New-Slide
  $g = $s.Graphics
  Draw-Header $g "Impacto esperado" "Transforma\u00e7\u00e3o social e operacional" 12
  $metrics = @(
    @("0", "papelada", "Menos listas f\u00edsicas, assinaturas e planilhas soltas.", "cert", $Brand),
    @("1", "lugar central", "Oportunidades de voluntariado reunidas para o estudante.", "search", $Amber),
    @("QR", "presen\u00e7a", "Valida\u00e7\u00e3o digital reduz fraudes e retrabalho.", "qr", $Green),
    @("MVP", "funcional", "Produto pronto para piloto em ambiente universit\u00e1rio.", "code", $Navy2)
  )
  for ($i = 0; $i -lt 4; $i++) {
    $x = 90 + $i * 455
    Draw-ShadowCard $g $x 350 390 370 26 $Paper $Line
    $badgeFill = $SoftBlue
    if ($i -eq 1) { $badgeFill = $SoftAmber }
    Draw-IconBadge $g $metrics[$i][3] ($x + 34) 388 72 $badgeFill $metrics[$i][4]
    $vf = Font-New 72 "Bold"
    $lf = Font-New 28 "Bold"
    $bf = Font-New 23 "Regular"
    Draw-Text $g $metrics[$i][0] $vf $metrics[$i][4] ($x + 34) 500
    Draw-Text $g $metrics[$i][1] $lf $Ink ($x + 34) 592
    Draw-Wrap $g $metrics[$i][2] $bf $Muted ($x + 34) 645 315 32 3 | Out-Null
    $vf.Dispose()
    $lf.Dispose()
    $bf.Dispose()
  }
  Draw-ShadowCard $g 250 800 1420 115 24 $Navy2 (Color-Hex "#D8E2FF")
  $quote = Font-New 34 "Bold"
  Draw-Wrap $g "O projeto amplia o acesso ao voluntariado e torna a comprova\u00e7\u00e3o de horas mais simples, r\u00e1pida e confi\u00e1vel para todos os envolvidos." $quote ([System.Drawing.Color]::White) 310 828 1300 44 2 | Out-Null
  $quote.Dispose()
  return Save-Slide $s 12
}

function Slide13 {
  $s = New-Slide
  $g = $s.Graphics
  Draw-Header $g "Resultados" "Entregas esperadas e perspectivas futuras" 13
  Draw-ShadowCard $g 110 340 760 590 30 $Paper $Line
  $tf = Font-New 38 "Bold"
  $bf = Font-New 26 "Regular"
  Draw-Text $g "Produto esperado" $tf $Ink 160 390
  Draw-Wrap $g "Um MVP funcional do Mais Horas, conectando estudantes e ONGs com cadastro, inscri\u00e7\u00e3o em atividades, valida\u00e7\u00e3o de presen\u00e7a e certificados verific\u00e1veis." $bf $Muted 160 475 650 38 5 | Out-Null
  Draw-IconBadge $g "cert" 160 725 90 $SoftBlue $Brand
  Draw-Wrap $g "Ao final, a equipe espera demonstrar o fluxo completo: vaga publicada, aluno inscrito, presen\u00e7a validada e certificado emitido." $bf $Ink 280 725 520 38 4 | Out-Null
  Draw-ShadowCard $g 960 340 750 590 30 $Navy2 (Color-Hex "#D8E2FF")
  Draw-Text $g "Pr\u00f3ximos passos" $tf ([System.Drawing.Color]::White) 1010 390
  $next = @(
    @("Piloto com alunos e ONGs reais", "users"),
    @("QR din\u00e2mico para reduzir fraudes", "qr"),
    @("Expans\u00e3o para outras institui\u00e7\u00f5es", "building"),
    @("Vers\u00e3o mobile e recomenda\u00e7\u00f5es por perfil", "code")
  )
  for ($i = 0; $i -lt 4; $i++) {
    $iy = 485 + $i * 105
    Draw-IconBadge $g $next[$i][1] 1010 $iy 64 (Color-Hex "#FFFFFF" 22) $Amber2
    Draw-Wrap $g $next[$i][0] $bf (Color-Hex "#EAF0FF") 1090 ($iy + 9) 560 34 2 | Out-Null
  }
  $tf.Dispose()
  $bf.Dispose()
  return Save-Slide $s 13
}

function Slide14 {
  $s = New-Slide $true
  $g = $s.Graphics
  Draw-Logo $g 86 72 .92 $true
  $big = Font-New 96 "Bold"
  $mid = Font-New 42 "Bold"
  $body = Font-New 28 "Regular"
  Draw-Text $g "Obrigado!" $big ([System.Drawing.Color]::White) 92 270
  Draw-Wrap $g "Mais Horas: horas de extens\u00e3o que viram impacto real." $mid $Amber2 100 390 820 56 2 | Out-Null
  Draw-Wrap $g "Uma plataforma para aproximar estudantes, ONGs e universidade com acesso, organiza\u00e7\u00e3o e confian\u00e7a." $body (Color-Hex "#D8E2FF") 100 535 820 42 3 | Out-Null
  Draw-ShadowCard $g 1080 200 600 680 34 $Paper (Color-Hex "#D8E2FF")
  Draw-QrImage $g $QrCertificatePath 1248 245 280 $Brand
  $tf = Font-New 34 "Bold"
  $sf = Font-New 24 "Regular"
  Draw-Text $g "Fluxo final" $tf $Ink 1160 550
  Draw-Bullet $g 1160 630 "Publicar vaga" $Brand
  Draw-Bullet $g 1160 700 "Validar presen\u00e7a" $Amber
  Draw-Bullet $g 1160 770 "Emitir certificado" $Green
  Draw-Text $g "Pedro Batista | Ismael Brand\u00e3o | Ant\u00f4nio Yarlen" $sf (Color-Hex "#D8E2FF") 100 940
  $big.Dispose()
  $mid.Dispose()
  $body.Dispose()
  $tf.Dispose()
  $sf.Dispose()
  return Save-Slide $s 14
}

function Write-Utf8([string]$path, [string]$content) {
  [System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
}

function Create-Pptx([string[]]$jpgs, [string]$pptxPath) {
  $dirs = @(
    "_rels",
    "docProps",
    "ppt",
    "ppt\_rels",
    "ppt\slides",
    "ppt\slides\_rels",
    "ppt\media",
    "ppt\slideMasters",
    "ppt\slideMasters\_rels",
    "ppt\slideLayouts",
    "ppt\slideLayouts\_rels",
    "ppt\theme"
  )
  foreach ($d in $dirs) { New-Item -ItemType Directory -Force -Path (Join-Path $BuildDir $d) | Out-Null }

  $slideOverrides = ""
  for ($i = 1; $i -le $jpgs.Count; $i++) {
    $slideOverrides += "  <Override PartName=""/ppt/slides/slide$i.xml"" ContentType=""application/vnd.openxmlformats-officedocument.presentationml.slide+xml""/>`n"
  }
  $contentTypes = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="jpg" ContentType="image/jpeg"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
$slideOverrides</Types>
"@
  Write-Utf8 (Join-Path $BuildDir "[Content_Types].xml") $contentTypes

  Write-Utf8 (Join-Path $BuildDir "_rels\.rels") @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>
"@

  Write-Utf8 (Join-Path $BuildDir "docProps\app.xml") @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Codex</Application>
  <PresentationFormat>Wide</PresentationFormat>
  <Slides>$($jpgs.Count)</Slides>
  <Company>Mais Horas</Company>
</Properties>
"@

  Write-Utf8 (Join-Path $BuildDir "docProps\core.xml") @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Mais Horas - Apresentacao</dc:title>
  <dc:creator>Codex</dc:creator>
  <cp:lastModifiedBy>Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">2026-06-05T00:00:00Z</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">2026-06-05T00:00:00Z</dcterms:modified>
</cp:coreProperties>
"@

  $sldIds = ""
  $presRels = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
"@
  for ($i = 1; $i -le $jpgs.Count; $i++) {
    $rid = $i + 1
    $sid = 255 + $i
    $sldIds += "    <p:sldId id=""$sid"" r:id=""rId$rid""/>`n"
    $presRels += "  <Relationship Id=""rId$rid"" Type=""http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide"" Target=""slides/slide$i.xml""/>`n"
  }
  $presRels += "</Relationships>"
  Write-Utf8 (Join-Path $BuildDir "ppt\_rels\presentation.xml.rels") $presRels

  Write-Utf8 (Join-Path $BuildDir "ppt\presentation.xml") @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst>
    <p:sldMasterId id="2147483648" r:id="rId1"/>
  </p:sldMasterIdLst>
  <p:sldIdLst>
$sldIds  </p:sldIdLst>
  <p:sldSz cx="$SlideW" cy="$SlideH" type="wide"/>
  <p:notesSz cx="6858000" cy="9144000"/>
  <p:defaultTextStyle><a:defPPr><a:defRPr lang="pt-BR"/></a:defPPr></p:defaultTextStyle>
</p:presentation>
"@

  Write-Utf8 (Join-Path $BuildDir "ppt\slideMasters\slideMaster1.xml") @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="$SlideW" cy="$SlideH"/><a:chOff x="0" y="0"/><a:chExt cx="$SlideW" cy="$SlideH"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
  <p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles>
</p:sldMaster>
"@

  Write-Utf8 (Join-Path $BuildDir "ppt\slideMasters\_rels\slideMaster1.xml.rels") @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>
"@

  Write-Utf8 (Join-Path $BuildDir "ppt\slideLayouts\slideLayout1.xml") @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">
  <p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="$SlideW" cy="$SlideH"/><a:chOff x="0" y="0"/><a:chExt cx="$SlideW" cy="$SlideH"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>
"@

  Write-Utf8 (Join-Path $BuildDir "ppt\slideLayouts\_rels\slideLayout1.xml.rels") @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>
"@

  Write-Utf8 (Join-Path $BuildDir "ppt\theme\theme1.xml") @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Mais Horas">
  <a:themeElements>
    <a:clrScheme name="Mais Horas"><a:dk1><a:srgbClr val="111C30"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="0F2570"/></a:dk2><a:lt2><a:srgbClr val="F3F6FC"/></a:lt2><a:accent1><a:srgbClr val="1F47C9"/></a:accent1><a:accent2><a:srgbClr val="EF9504"/></a:accent2><a:accent3><a:srgbClr val="2E7D55"/></a:accent3><a:accent4><a:srgbClr val="3780DD"/></a:accent4><a:accent5><a:srgbClr val="64748F"/></a:accent5><a:accent6><a:srgbClr val="DBE3F3"/></a:accent6><a:hlink><a:srgbClr val="1F47C9"/></a:hlink><a:folHlink><a:srgbClr val="0F2570"/></a:folHlink></a:clrScheme>
    <a:fontScheme name="Segoe UI"><a:majorFont><a:latin typeface="Segoe UI"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Segoe UI"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>
    <a:fmtScheme name="Office"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme>
  </a:themeElements>
  <a:objectDefaults/>
  <a:extraClrSchemeLst/>
</a:theme>
"@

  for ($i = 1; $i -le $jpgs.Count; $i++) {
    Copy-Item -LiteralPath $jpgs[$i - 1] -Destination (Join-Path $BuildDir "ppt\media\slide$i.jpg") -Force
    Write-Utf8 (Join-Path $BuildDir "ppt\slides\slide$i.xml") @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="$SlideW" cy="$SlideH"/><a:chOff x="0" y="0"/><a:chExt cx="$SlideW" cy="$SlideH"/></a:xfrm></p:grpSpPr>
      <p:pic>
        <p:nvPicPr><p:cNvPr id="2" name="slide$i.jpg"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>
        <p:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
        <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="$SlideW" cy="$SlideH"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
      </p:pic>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>
"@
    Write-Utf8 (Join-Path $BuildDir "ppt\slides\_rels\slide$i.xml.rels") @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/slide$i.jpg"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>
"@
  }

  if (Test-Path $pptxPath) { Remove-Item -LiteralPath $pptxPath -Force }
  [System.IO.Compression.ZipFile]::CreateFromDirectory($BuildDir, $pptxPath)
}

function Create-Html([int]$count, [string]$path) {
  $slides = ""
  for ($i = 1; $i -le $count; $i++) {
    $slides += "      <section class=""slide""><img src=""slides/slide-$("{0:D2}" -f $i).png"" alt=""Slide $i""></section>`n"
  }
  $html = @"
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mais Horas - Apresentacao</title>
  <style>
    html, body { margin: 0; min-height: 100%; background: #111c30; font-family: Segoe UI, Arial, sans-serif; }
    main { width: 100vw; min-height: 100vh; display: grid; place-items: center; overflow: hidden; }
    .slide { display: none; width: min(100vw, calc(100vh * 16 / 9)); aspect-ratio: 16 / 9; }
    .slide.active { display: block; }
    .slide img { width: 100%; height: 100%; display: block; object-fit: contain; }
    .counter { position: fixed; right: 18px; bottom: 14px; color: #d8e2ff; background: rgba(15,37,112,.65); padding: 8px 12px; border-radius: 999px; font-size: 14px; }
    @media print { body { background: white; } main { display:block; } .slide { display:block; width:100vw; page-break-after: always; } .counter { display:none; } }
  </style>
</head>
<body>
  <main>
$slides  </main>
  <div class="counter" id="counter"></div>
  <script>
    const slides = [...document.querySelectorAll('.slide')];
    let i = 0;
    const render = () => {
      slides.forEach((s, idx) => s.classList.toggle('active', idx === i));
      document.getElementById('counter').textContent = (i + 1) + ' / ' + slides.length;
    };
    addEventListener('keydown', (e) => {
      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) i = Math.min(slides.length - 1, i + 1);
      if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) i = Math.max(0, i - 1);
      render();
    });
    render();
  </script>
</body>
</html>
"@
  Write-Utf8 $path $html
}

$jpgs = @()
$jpgs += Slide1
$jpgs += Slide2
$jpgs += Slide3
$jpgs += Slide4
$jpgs += Slide5
$jpgs += Slide6
$jpgs += Slide7
$jpgs += Slide8
$jpgs += Slide9
$jpgs += Slide10
$jpgs += Slide11
$jpgs += Slide12
$jpgs += Slide13
$jpgs += Slide14

$pptx = Join-Path $OutDir "Mais_Horas_Apresentacao_Projeto_Extensao.pptx"
Create-Pptx $jpgs $pptx
Create-Html $jpgs.Count (Join-Path $OutDir "Mais_Horas_Apresentacao.html")

Write-Output "Slides generated: $($jpgs.Count)"
Write-Output "PPTX: $pptx"
Write-Output "HTML: $(Join-Path $OutDir "Mais_Horas_Apresentacao.html")"
