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
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
