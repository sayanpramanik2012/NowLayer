param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('play-pause', 'next', 'previous')]
  [string]$Action
)

$ErrorActionPreference = 'Stop'
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

Add-Type -AssemblyName System.Runtime.WindowsRuntime
[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime] | Out-Null

$asTaskMethod = [System.WindowsRuntimeSystemExtensions].GetMethods() |
  Where-Object {
    $_.Name -eq 'AsTask' -and
    $_.IsGenericMethod -and
    $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
  } |
  Select-Object -First 1

function Wait-WinRtOperation {
  param(
    [Parameter(Mandatory = $true)]$Operation,
    [Parameter(Mandatory = $true)][Type]$ResultType
  )

  $closedMethod = $asTaskMethod.MakeGenericMethod($ResultType)
  $task = $closedMethod.Invoke($null, @($Operation))
  return $task.GetAwaiter().GetResult()
}

try {
  $manager = Wait-WinRtOperation `
    -Operation ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) `
    -ResultType ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
  $session = $manager.GetCurrentSession()
  if ($null -eq $session) {
    throw 'No active Windows media session was found.'
  }

  $operation = switch ($Action) {
    'play-pause' { $session.TryTogglePlayPauseAsync() }
    'next' { $session.TrySkipNextAsync() }
    'previous' { $session.TrySkipPreviousAsync() }
  }
  $success = Wait-WinRtOperation -Operation $operation -ResultType ([bool])
  [ordered]@{ success = [bool]$success; action = $Action } |
    ConvertTo-Json -Compress |
    Write-Output
  if (-not $success) { exit 2 }
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
}
