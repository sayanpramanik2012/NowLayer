param(
  [switch]$Once,
  [ValidateRange(250, 10000)]
  [int]$PollIntervalMs = 750
)

$ErrorActionPreference = 'Stop'
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

Add-Type -AssemblyName System.Runtime.WindowsRuntime

[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime] | Out-Null
[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null

$script:AsTaskMethod = [System.WindowsRuntimeSystemExtensions].GetMethods() |
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

  $closedMethod = $script:AsTaskMethod.MakeGenericMethod($ResultType)
  $task = $closedMethod.Invoke($null, @($Operation))
  return $task.GetAwaiter().GetResult()
}

function Get-ThumbnailDataUri {
  param($Thumbnail)

  if ($null -eq $Thumbnail) {
    return ''
  }

  $randomAccessStream = $null
  $inputStream = $null
  $reader = $null
  try {
    $randomAccessStream = Wait-WinRtOperation `
      -Operation $Thumbnail.OpenReadAsync() `
      -ResultType ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
    if ($randomAccessStream.Size -gt 2097152) {
      return ''
    }
    if ($randomAccessStream.Size -le 0) {
      return ''
    }
    $inputStream = $randomAccessStream.GetInputStreamAt(0)
    $reader = [Windows.Storage.Streams.DataReader]::new($inputStream)
    $loaded = Wait-WinRtOperation `
      -Operation $reader.LoadAsync([uint32]$randomAccessStream.Size) `
      -ResultType ([uint32])
    if ($loaded -le 0) {
      return ''
    }
    $bytes = [byte[]]::new([int]$loaded)
    $reader.ReadBytes($bytes)
    $mimeType = if ([string]::IsNullOrWhiteSpace($randomAccessStream.ContentType)) {
      'image/jpeg'
    } else {
      $randomAccessStream.ContentType
    }
    $base64 = [Convert]::ToBase64String($bytes)
    return "data:$mimeType;base64,$base64"
  } catch {
    return ''
  } finally {
    if ($null -ne $reader) { $reader.Dispose() }
    if ($null -ne $inputStream) { $inputStream.Dispose() }
    if ($null -ne $randomAccessStream) { $randomAccessStream.Dispose() }
  }
}

function New-EmptyMediaState {
  param([string]$ErrorMessage = '')

  return [ordered]@{
    available = $false
    title = ''
    artist = ''
    albumTitle = ''
    source = ''
    status = 'Closed'
    position = 0
    duration = 0
    sampledAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    artwork = ''
    controls = [ordered]@{
      previous = $false
      playPause = $false
      next = $false
    }
    error = $ErrorMessage
  }
}

function Write-MediaState {
  param($State)
  $State | ConvertTo-Json -Depth 4 -Compress | Write-Output
}

$manager = $null
$cachedArtworkKey = ''
$cachedArtwork = ''
$lastArtworkAttempt = 0L

do {
  try {
    if ($null -eq $manager) {
      $manager = Wait-WinRtOperation `
        -Operation ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) `
        -ResultType ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
    }

    $session = $manager.GetCurrentSession()
    if ($null -eq $session) {
      $cachedArtworkKey = ''
      $cachedArtwork = ''
      $lastArtworkAttempt = 0L
      Write-MediaState (New-EmptyMediaState)
    } else {
      $properties = Wait-WinRtOperation `
        -Operation $session.TryGetMediaPropertiesAsync() `
        -ResultType ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
      $playback = $session.GetPlaybackInfo()
      $timeline = $session.GetTimelineProperties()
      $controls = $playback.Controls
      $artworkKey = '{0}|{1}|{2}|{3}' -f `
        $session.SourceAppUserModelId, $properties.Title, $properties.Artist, $properties.AlbumTitle

      if ($artworkKey -ne $cachedArtworkKey) {
        $cachedArtworkKey = $artworkKey
        $cachedArtwork = ''
        $lastArtworkAttempt = 0L
      }

      $nowTick = [Environment]::TickCount64
      if ([string]::IsNullOrWhiteSpace($cachedArtwork) -and
          ($nowTick - $lastArtworkAttempt) -ge 2000) {
        $lastArtworkAttempt = $nowTick
        $cachedArtwork = Get-ThumbnailDataUri -Thumbnail $properties.Thumbnail
      }

      $duration = [Math]::Max(0, ($timeline.EndTime - $timeline.StartTime).TotalSeconds)
      $position = [Math]::Max(0, ($timeline.Position - $timeline.StartTime).TotalSeconds)
      if ([string]$playback.PlaybackStatus -eq 'Playing') {
        $timelineAge = ([DateTimeOffset]::UtcNow - $timeline.LastUpdatedTime).TotalSeconds
        if ($timelineAge -gt 0 -and $timelineAge -lt 86400) {
          $position += $timelineAge
        }
      }
      if ($duration -gt 0) {
        $position = [Math]::Min($duration, $position)
      }

      Write-MediaState ([ordered]@{
        available = $true
        title = [string]$properties.Title
        artist = [string]$properties.Artist
        albumTitle = [string]$properties.AlbumTitle
        source = [string]$session.SourceAppUserModelId
        status = [string]$playback.PlaybackStatus
        position = [Math]::Round($position, 3)
        duration = [Math]::Round($duration, 3)
        sampledAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        artwork = $cachedArtwork
        controls = [ordered]@{
          previous = [bool]$controls.IsPreviousEnabled
          playPause = [bool]$controls.IsPlayPauseToggleEnabled
          next = [bool]$controls.IsNextEnabled
        }
        error = ''
      })
    }
  } catch {
    $manager = $null
    Write-MediaState (New-EmptyMediaState -ErrorMessage $_.Exception.GetBaseException().Message)
  }

  if (-not $Once) {
    Start-Sleep -Milliseconds $PollIntervalMs
  }
} while (-not $Once)
