# Read an already-running Libre Hardware Monitor WMI provider. No drivers are installed.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
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
    [Console]::WriteLine(($snapshot | ConvertTo-Json -Compress -Depth 4))
    [Console]::Out.Flush()
    Start-Sleep -Seconds 2
}
