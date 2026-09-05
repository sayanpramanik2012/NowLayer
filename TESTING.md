# Running and testing NowLayer

NowLayer is a standalone Windows Electron application. It does not require Overwolf, a development key, or a gaming-platform client.

## Local setup

Use Windows 10 or 11 and Node.js 20 or newer. Open PowerShell in the NowLayer folder and run:

```powershell
npm.cmd install
npm.cmd run build
npm.cmd run dev
```

Alternatively, double-click `START-NOWLAYER.cmd`. Closing the Control Center keeps NowLayer in the system tray; use **Quit NowLayer** from the tray menu to stop it completely.

Run `npm.cmd run doctor` for a quick local environment report.

## Media-overlay acceptance test

1. Start a song in Spotify, YouTube Music, Chrome, Edge, Firefox, VLC, or another application that exposes Windows media controls.
2. Confirm that title, artist, source, playback state, progress, duration, and artwork appear when the source supplies them.
3. Let the media play for at least 15 seconds. Confirm that the elapsed time and progress bar remain synchronized.
4. Seek, pause, and resume in the source application. Confirm that NowLayer resynchronizes.
5. With NowLayer **LOCKED**, click through it and confirm the game or application underneath receives the input.
6. Press the configured **Lock / unlock interaction** shortcut. Confirm the overlay becomes interactive and its supported media buttons work.
7. Drag the unlocked overlay, lock it again, then press the configured **Show / hide** shortcut twice to test hide and restore.
8. Test at least two snap positions, compact mode, and several media-opacity levels.
9. In **Settings**, click each shortcut recorder and press a new combination. Confirm it saves, works outside NowLayer, rejects duplicates, and Escape cancels recording.
10. Close and reopen the Control Center from the system tray.

## Video-PiP acceptance test

1. Open an ordinary YouTube video in a dedicated Chrome or Edge window and begin playback.
2. Open **Video PiP**, choose **Refresh windows**, and select that browser window.
3. Confirm that the overlay changes to the selected 16:9 size while audio continues only from the source window.
4. Confirm that the music timeline is hidden and only the optional floating play/pause control appears.
5. Test every PiP-button corner and the setting that hides the button.
6. Unlock PiP, drag an edge to resize it, and confirm it remains 16:9. Lock it and confirm resizing is disabled and input passes through.
7. Change Video PiP opacity and confirm it does not alter the media, clock, or timer overlay.
8. Select **Stop PiP** and confirm the media card returns.
9. Close the selected source window and confirm NowLayer reports that capture has ended.

Protected streaming services may show a black frame by design. Keep the source window open and non-minimized.

## Clock and timer acceptance test

1. Enable the separate clock widget and move it. Restart NowLayer and confirm its position is remembered.
2. Test digital 12-hour and 24-hour formats with seconds both enabled and disabled.
3. Select analog mode and confirm the hour and minute hands move correctly; enable seconds and confirm the second hand appears.
4. Test clock-only, timer-only, and clock-plus-timer layouts.
5. Set visibly different clock and timer opacity levels and confirm each surface changes independently.

## Game and display acceptance test

Test with games in **borderless-windowed** mode. A standalone desktop overlay cannot promise visibility above every true exclusive-fullscreen renderer.

1. Verify music mode and Video PiP above at least three games using different graphics APIs where available.
2. Confirm locked input passes through during gameplay and both global shortcuts respond.
3. Alt+Tab repeatedly and confirm NowLayer remains stable and topmost.
4. Repeat on a secondary monitor.
5. Test these Windows display combinations:
   - 1366 × 768 at 100% scaling
   - 1920 × 1080 at 100% and 125% scaling
   - 2560 × 1440 at 100% and 125% scaling
   - 3840 × 2160 at 150% scaling
6. Test once with the game running as Administrator. NowLayer may need the same privilege level for global input behavior; normal use should remain non-administrator.

## Packaging test

Create a clean Windows installer with:

```powershell
npm.cmd run dist
```

The installer is written to `build/NowLayer-Setup-<version>.exe`.

Before publishing:

1. Install it on a Windows account that has never run the development build.
2. Repeat the media, PiP, tray, hotkey, and borderless-game tests.
3. Restart Windows and verify no orphan NowLayer processes remain after using **Quit NowLayer**.
4. Uninstall NowLayer and confirm that the installed program files and shortcuts are removed.
5. Scan the exact release EXE with Microsoft Defender and VirusTotal.

See [docs/RELEASING.md](docs/RELEASING.md) for versioning and GitHub Release automation.

## Performance acceptance checks

- Enable Performance with no optional tools: CPU and RAM update; FPS follows the foreground app when capture permissions allow it; temperatures
  and unsupported GPU fields clearly remain unavailable.
- Follow [performance setup](docs/PERFORMANCE.md), then compare FPS with PresentMon
  for the same game process. Stop the game and confirm old FPS is cleared.
- Compare NVIDIA and Libre Hardware Monitor readings with their own tools. Stop
  a provider and confirm readings expire. Test zero usage and multiple adapters.
- Move the performance widget, change its own opacity, restart NowLayer, and verify
  preferences persist. Lock it and verify mouse clicks reach the game underneath.
- Hide/show with the configured shortcut, disable monitoring, reset settings, and
  quit: verify collection stops and owned helper/ETW sessions are cleaned up.
- Test media and Video PiP alongside performance with the personalization controls.
- Check the website's mobile menu, keyboard-operated overlay tabs, release download
  links, and FAQ. If the GitHub API is unavailable, download links should still
  open GitHub's latest release page.

### Version 1.1.0 acceptance

- On Home, toggle each feature and verify both the real window and its customization-page preference. Media off must leave performance visible. Hide all must hide the time widget too; alarms/countdowns keep their schedule.
- Select/cancel a Video PiP window from Home; turn media on to exit PiP.
- Cycle all three performance layouts and themes, move to a screen edge, and restart. Verify saved choices and 34-pixel strip height (before Windows scaling).
- Install on Windows without any separate PresentMon installation. Enable Performance, switch between two games, then desktop. Verify process isolation and stale FPS clearing. Check permission errors appear in Control Center.
- Play Spotify and YouTube Music with/without supplied thumbnails. Verify actual art, title/time/buttons, and no N placeholder or empty image slot.
- Confirm the installer contains resources/presentmon/PresentMon.exe and LICENSE.txt, with the pinned hash. Test a fresh install and upgrade to 1.1.0.
