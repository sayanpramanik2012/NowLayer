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
6. Press `Ctrl+Shift+L`. Confirm the overlay becomes interactive and its supported media buttons work.
7. Drag the unlocked overlay, lock it again, then press `Ctrl+Shift+M` twice to test hide and restore.
8. Test at least two snap positions, compact mode, and several opacity levels.
9. Close and reopen the Control Center from the system tray.

## Video-PiP acceptance test

1. Open an ordinary YouTube video in a dedicated Chrome or Edge window and begin playback.
2. Open **Video PiP**, choose **Refresh windows**, and select that browser window.
3. Confirm that the overlay changes to a 480 × 270 video surface while audio continues only from the source window.
4. Confirm that the music timeline is hidden and only the optional floating play/pause control appears.
5. Test every PiP-button corner and the setting that hides the button.
6. Verify locked click-through and unlocked interaction over the PiP.
7. Select **Stop PiP** and confirm the media card returns.
8. Close the selected source window and confirm NowLayer reports that capture has ended.

Protected streaming services may show a black frame by design. Keep the source window open and non-minimized.

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
