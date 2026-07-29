$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$outputPath = Join-Path $projectRoot 'src\assets\app-icon.png'
$bitmap = [System.Drawing.Bitmap]::new(512, 512, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)

try {
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.Color]::Transparent)

  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  try {
    $path.AddArc(24, 24, 112, 112, 180, 90)
    $path.AddArc(376, 24, 112, 112, 270, 90)
    $path.AddArc(376, 376, 112, 112, 0, 90)
    $path.AddArc(24, 376, 112, 112, 90, 90)
    $path.CloseFigure()

    $gradient = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
      [System.Drawing.Point]::new(70, 55),
      [System.Drawing.Point]::new(445, 460),
      [System.Drawing.Color]::FromArgb(255, 255, 79, 100),
      [System.Drawing.Color]::FromArgb(255, 105, 53, 215)
    )
    try {
      $graphics.FillPath($gradient, $path)
    }
    finally {
      $gradient.Dispose()
    }
  }
  finally {
    $path.Dispose()
  }

  $highlight = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    [System.Drawing.Rectangle]::new(42, 42, 428, 190),
    [System.Drawing.Color]::FromArgb(70, 255, 255, 255),
    [System.Drawing.Color]::FromArgb(0, 255, 255, 255),
    90
  )
  try {
    $graphics.FillEllipse($highlight, 48, 38, 416, 214)
  }
  finally {
    $highlight.Dispose()
  }

  $pen = [System.Drawing.Pen]::new([System.Drawing.Color]::White, 58)
  try {
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $graphics.DrawLines($pen, [System.Drawing.Point[]]@(
      [System.Drawing.Point]::new(150, 354),
      [System.Drawing.Point]::new(150, 158),
      [System.Drawing.Point]::new(362, 354),
      [System.Drawing.Point]::new(362, 158)
    ))
  }
  finally {
    $pen.Dispose()
  }

  $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
}
finally {
  $graphics.Dispose()
  $bitmap.Dispose()
}

Write-Output "Created $outputPath"
