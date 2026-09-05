<p align="center">
  <img src="src/assets/app-icon.png" width="128" height="128" alt="NowLayer icon">
</p>

<h1 align="center">NowLayer</h1>

<p align="center"><strong>Your media. Your screen. Your rules.</strong></p>

<p align="center">
  <a href="https://sayanpramanik2012.github.io/NowLayer/">Website</a>
  ·
  <a href="https://github.com/sayanpramanik2012/NowLayer/releases/latest">Download for Windows</a>
  ·
  <a href="https://github.com/sayanpramanik2012/NowLayer/issues">Report an issue</a>
</p>

NowLayer keeps music and video within view while you play. It places a compact, customizable media layer above borderless-windowed games and desktop apps—without requiring a browser extension, game integration, or another gaming platform running in the background.

## Stay in the moment

Checking a song title should not require an Alt+Tab. Neither should keeping a video nearby. NowLayer turns your active Windows media session or a selected video window into a clean overlay that stays exactly where you put it.

- **Live now-playing information** — See the track, artist, artwork, playback state, and a timeline that moves with your media.
- **Video PiP for the windows you already use** — Mirror YouTube, a browser window, or another compatible video player into a resizable 16:9 view.
- **Game-safe click-through mode** — Lock NowLayer and mouse input passes directly to the game or app underneath it.
- **Control when you want it** — Unlock the overlay for playback controls, positioning, and customization, then lock it again in one keystroke.
- **Fits your setup** — Snap it to any edge or corner, drag it freely, resize Video PiP, and tune media, video, clock, and timer opacity independently.
- **Time your way** — Choose a digital or analog clock, 12- or 24-hour time, optional seconds, a visible countdown, or a daily alarm.
- **Alerts your way** — Silent timers shake the overlay; audible timers and alarms can use the built-in tone or your own audio file.
- **Ready when you are** — Optionally launch NowLayer with Windows so it is waiting in the system tray.
- **Private by design** — Media information, captured video, and preferences stay on your Windows PC.
- **Completely standalone** — No Overwolf client, account, browser extension, or game-specific plugin is required.

## Start playing

1. Download the newest **NowLayer Setup** file from [Releases](https://github.com/sayanpramanik2012/NowLayer/releases/latest).
2. Install and open NowLayer.
3. Start music in Spotify, YouTube Music, a browser, VLC, or another Windows media player.
4. Keep the overlay locked while playing, or open **Video PiP** to select a video window.

NowLayer remains available from the Windows system tray when its Control Center is closed.

## Shortcuts

| Action | Shortcut |
| --- | --- |
| Show or hide NowLayer | `Ctrl` + `Shift` + `M` |
| Lock or unlock interaction | `Ctrl` + `Shift` + `L` |
| Dismiss an active timer or alarm | `Ctrl` + `Shift` + `A` |

All three shortcuts are customizable from **Settings**. Click a shortcut and press the combination you want; NowLayer records it and checks availability before saving.

## Compatibility

NowLayer is designed for Windows 10 and Windows 11. Borderless-windowed and windowed games provide the most reliable experience. True exclusive-fullscreen games can prevent ordinary desktop overlays from being displayed, and protected DRM video may intentionally appear black when captured.

Media information and controls depend on the source application publishing a Windows media session. The source video window must remain open and should not be minimized.

## Help shape NowLayer

Found a game, player, or display setup that needs attention? Open a [GitHub issue](https://github.com/sayanpramanik2012/NowLayer/issues) with the NowLayer diagnostic report and the steps that reproduce the problem.

For local testing and release procedures, see [TESTING.md](TESTING.md) and [docs/RELEASING.md](docs/RELEASING.md).

Copyright © Sayan Pramanik. All rights reserved.

## Performance overlay

NowLayer also includes a separate FPS, CPU, GPU, temperature, RAM, and VRAM widget.
Enable it in **Performance** in Control Center. CPU and RAM work immediately; game
FPS capture is bundled and follows the foreground app. Hardware temperatures require supported
sensor providers. See [setup and data-source details](docs/PERFORMANCE.md).

## New in 1.1.0

- Home centralizes media, performance, Video PiP, clock, countdown, and alarm switches, with direct customization links.
- Performance defaults to a 34-pixel-tall strip that resizes around selected readings, with compact/detailed layouts and Graphite/Midnight/Minimal HUD themes.
- PresentMon Console is bundled and integrity-checked during builds; users do not install or locate it. Windows capture permissions still apply.
- Real Windows media thumbnails are displayed when supplied; missing artwork no longer reserves a placeholder.
- The website includes an interactive layout/theme preview and updated setup guidance.

Media and Video PiP share one overlay. Turning media on stops PiP; stopping PiP restores media if enabled. Home clock/countdown switches can enable a separate time widget. Hiding a countdown does not cancel it, and hiding overlays does not disable alarms.

## New in 1.1.1

- Fixed overlapping Home switches and removed the native diagnostics tooltip that could cover a game.
- Every performance reading is optional; the 34-pixel strip shortens to fit selected metrics and uses a quiet `n/a` for unavailable data.
- Efficient mode samples every two seconds, launches FPS capture only for the foreground game's process ID, and skips unused sensor providers.
- Video PiP offers 15, 24, and 30 FPS modes and stops its capture stream when overlays are hidden.
- Overlays stay out of the Control Center; disabled/hidden windows and their media helper release memory, the timer scheduler wakes once per second, and Help reports NowLayer's live CPU and working-set memory.

## New in 1.1.2

- Fixed the Performance metric checkboxes so their switch styling cannot overlap the labels.
- The slim strip gives each selected reading enough space to stay readable instead of running values together.
- **Fix FPS access** performs the one-time Windows permission setup from Control Center after an administrator prompt; users only need to sign out and back in before retrying FPS.
