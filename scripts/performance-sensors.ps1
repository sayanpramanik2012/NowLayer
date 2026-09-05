# Read an already-running Libre Hardware Monitor WMI provider. No drivers are installed.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class NowLayerForeground {
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
}
'@
while ($true) {
    $snapshot = @{ hardware = @(); sensors = @() }
    try {
        $snapshot.hardware = @(Get-CimInstance -Namespace root/LibreHardwareMonitor -ClassName Hardware -OperationTimeoutSec 2 |
            Select-Object Identifier, Name, HardwareType)
        $snapshot.sensors = @(Get-CimInstance -Namespace root/LibreHardwareMonitor -ClassName Sensor -OperationTimeoutSec 2 |
            Select-Object Parent, Name, SensorType, Value)
    } catch {
        # Missing provider or unsupported sensors remain unavailable, never zero.
    }
    try {
        [uint32]$foregroundId = 0
        [void][NowLayerForeground]::GetWindowThreadProcessId([NowLayerForeground]::GetForegroundWindow(), [ref]$foregroundId)
        $foreground = [System.Diagnostics.Process]::GetProcessById([int]$foregroundId)
        $snapshot.foregroundProcessId = $foregroundId
        $snapshot.foregroundProcessName = $foreground.ProcessName + '.exe'
    } catch { }
    [Console]::WriteLine(($snapshot | ConvertTo-Json -Compress -Depth 4))
    [Console]::Out.Flush()
    Start-Sleep -Seconds 2
}
