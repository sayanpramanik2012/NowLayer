# Performance overlay

Enable **Performance** on Home. Open **Customize** to change its appearance.
The default is a slim horizontal strip, 560 × 34 logical pixels. Existing saved
settings automatically adopt this layout when no layout preference is stored.

| Layout | Size | Best use |
| --- | --- | --- |
| Slim strip (default) | 560 × 34 | Along the top or bottom edge |
| Compact row | 360 × 64 | A corner with limited horizontal space |
| Detailed card | 300 × 140 | More readable labels in a small two-column card |

Choose **Graphite**, **Midnight**, or **Minimal HUD** (text only, no background).
The Control Center preview uses the same component as the real overlay and shows
its actual logical size. Example values are labelled when monitoring is inactive.
Windows display scaling determines the physical pixel size. Setup errors appear
in Control Center, not in a persistent banner over the game. Missing readings use
a dash. Temperatures and frame time remain in every layout; RAM/VRAM use `G` for GiB.

The widget has its own corner/drag position and background opacity. Minimal HUD
has no background, so its background-opacity control is disabled. It follows the existing
lock and all-overlay visibility shortcuts. Hiding it pauses collection; disabling it or
quitting stops its helper processes and requests cleanup of its own ETW session.

## Data sources

| Reading | Source | Setup |
| --- | --- | --- |
| CPU usage | System-wide CPU time deltas | None |
| RAM used / total | OS physical-memory counters (GiB) | None |
| Game FPS / frame time | PresentMon Console CSV | Bundled; foreground app selected automatically |
| NVIDIA GPU usage, temperature, VRAM | Driver-provided `nvidia-smi.exe` | Must be available on PATH; unsupported counters stay unavailable |
| CPU temperature, AMD/Intel GPU sensors | Libre Hardware Monitor WMI | Keep its GUI/provider running with access to the relevant sensors |

CPU temperature prefers package/Tctl/Tdie sensors, taking the highest available
package value. When package readings are absent it uses the highest CPU core
sensor. It does not use ACPI thermal zones as a substitute for CPU temperature.
GPU readings stay associated with the chosen adapter. An unavailable selected GPU
does not silently switch to another adapter. Some devices lack temperature or
VRAM counters. Missing values are shown as unavailable, never as zero.

## Game FPS setup

1. Enable **Performance** on Home, then switch to your game in borderless-windowed mode.
2. NowLayer follows the foreground app by process ID. Opening Control Center keeps the last game target; switching to the desktop clears it.
3. Optionally enter `game.exe` under Performance customization to pin one executable. Leave blank for automatic selection.

The Windows installer includes the standalone PresentMon Console **2.3.1** executable and its MIT license. No separate installation, download, or path selection is needed by users. Builds fetch the pinned official x64 release, verify its SHA-256, and package it under `resources/presentmon`. Installed capture works offline. Legacy custom helper paths are discarded.

PresentMon needs ETW access. Its
[permissions guidance](https://github.com/GameTechDev/PresentMon#user-access-denied)
explains membership in **Performance Log Users** and signing out/back in. Running
NowLayer as administrator is an alternative when capture requires it. NowLayer
never automatically elevates, installs a driver, or changes group membership.
After correcting a launch or permission error, toggle performance off and on.

FPS is **application present rate**, calculated from the mean of valid
`MsBetweenPresents` intervals in each approximately one-second update. It is not
NowLayer's renderer FPS, and it is not a guarantee of displayed/generated FPS.
Process IDs and swap chains are kept separate; the chain with the most frame
samples in that update is shown rather than adding unrelated streams together.
The console runs with `--v1_metrics` to request a stable CSV schema. See the
[PresentMon console documentation](https://github.com/GameTechDev/PresentMon/blob/main/README-ConsoleApplication.md).
No CSV capture files are written. This integration does not inject a DLL into games.

## Hardware sensors

Download [Libre Hardware Monitor](https://github.com/LibreHardwareMonitor/LibreHardwareMonitor/releases),
run it with the sensor access your hardware requires, and enable its WMI provider
if disabled. Keep it running; NowLayer reads `root/LibreHardwareMonitor`'s
`Hardware` and `Sensor` classes every two seconds. It does not bundle LHM or its
drivers. If the provider is missing, CPU/RAM and other available providers keep
working. Sensor values expire after six seconds without a valid sample.

NVIDIA data is queried every two seconds with a 1.5-second process timeout and
30-second retry delay on failure. See
[NVIDIA's query reference](https://nvidia.custhelp.com/app/answers/detail/a_id/3751/~/useful-nvidia-smi-queries).
Sampling uses read-only queries. Changing widget position/opacity does not restart
capture. UI updates use a separate IPC event, avoiding repeated media artwork
transfers on each performance tick.

## Validation limits

Automated tests cover CPU deltas, CSV parsing, unavailable values, swap-chain
isolation, stale providers, selected adapters, process cleanup, and click-through
window behavior. Windows CI validates PowerShell syntax. Live game capture,
hardware sensor access, anti-cheat compatibility, and overhead still need testing
on a Windows gaming machine. Borderless-windowed mode is recommended as with
NowLayer's other overlays.
