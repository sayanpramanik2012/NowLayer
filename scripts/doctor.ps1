$ErrorActionPreference = 'Continue'

$projectRoot = Split-Path -Parent $PSScriptRoot
$checks = [System.Collections.Generic.List[object]]::new()

function Add-Check {
  param(
    [string]$Name,
    [bool]$Passed,
    [string]$Detail
  )
  $checks.Add([pscustomobject]@{
    Check = $Name
    Result = if ($Passed) { 'PASS' } else { 'ACTION NEEDED' }
    Detail = $Detail
  })
}

$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
Add-Check -Name 'Node.js' -Passed ($null -ne $nodeCommand) -Detail $(
  if ($null -ne $nodeCommand) { (& node.exe --version) } else { 'Install Node.js 18 or newer.' }
)

$npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
Add-Check -Name 'npm' -Passed ($null -ne $npmCommand) -Detail $(
  if ($null -ne $npmCommand) { (& npm.cmd --version) } else { 'npm.cmd was not found.' }
)

$runtimePath = Join-Path $projectRoot 'node_modules\electron\package.json'
$hasRuntime = Test-Path -LiteralPath $runtimePath
Add-Check -Name 'Electron runtime' -Passed $hasRuntime -Detail $(
  if ($hasRuntime) { 'Installed.' } else { 'Run npm.cmd install.' }
)

$builderPath = Join-Path $projectRoot 'node_modules\electron-builder\package.json'
$hasBuilder = Test-Path -LiteralPath $builderPath
Add-Check -Name 'Windows packager' -Passed $hasBuilder -Detail $(
  if ($hasBuilder) { 'Installed.' } else { 'Run npm.cmd install.' }
)

$checks | Format-Table -AutoSize

$requiredFailures = @($checks | Where-Object {
  $_.Check -in @('Node.js', 'npm', 'Electron runtime', 'Windows packager') -and
  $_.Result -ne 'PASS'
})
if ($requiredFailures.Count -gt 0) { exit 1 }
