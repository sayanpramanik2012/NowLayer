$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$electronCache = Join-Path $projectRoot '.cache\electron'
$builderCache = Join-Path $projectRoot '.cache\electron-builder'
$builderCommand = Join-Path $projectRoot 'node_modules\.bin\electron-builder.cmd'

if (-not (Test-Path -LiteralPath $builderCommand)) {
  throw 'electron-builder is not installed. Run npm.cmd install first.'
}

[Environment]::SetEnvironmentVariable('ELECTRON_CACHE', $electronCache, 'Process')
[Environment]::SetEnvironmentVariable('ELECTRON_BUILDER_CACHE', $builderCache, 'Process')

New-Item -ItemType Directory -Force -Path $electronCache | Out-Null
New-Item -ItemType Directory -Force -Path $builderCache | Out-Null

Push-Location $projectRoot
try {
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  & $builderCommand --win nsis --x64 --publish never
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  $packagedHelper = Join-Path $projectRoot 'build\win-unpacked\resources\presentmon\PresentMon.exe'
  $packagedLicense = Join-Path $projectRoot 'build\win-unpacked\resources\presentmon\LICENSE.txt'
  $expectedHash = node -p "require('./scripts/prepare-presentmon').SHA256"
  if ((Get-FileHash -LiteralPath $packagedHelper -Algorithm SHA256).Hash.ToLower() -ne $expectedHash) {
    throw 'Packaged FPS helper failed integrity verification.'
  }
  if (-not (Test-Path -LiteralPath $packagedLicense)) { throw 'Bundled FPS license is missing.' }
  exit 0
}
finally {
  Pop-Location
}
