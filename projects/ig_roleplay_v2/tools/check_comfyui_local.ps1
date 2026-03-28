param(
  [string]$Endpoint = "http://127.0.0.1:8188"
)

. (Join-Path $PSScriptRoot "bootstrap_utf8.ps1")

$ErrorActionPreference = "Stop"

$statsUrl = ($Endpoint.TrimEnd('/')) + "/system_stats"
$stats = Invoke-RestMethod -Uri $statsUrl -Method Get -TimeoutSec 15
$devices = @($stats.devices)
$deviceSummary = if ($devices.Count -gt 0) {
  $devices | ForEach-Object { "$($_.name) ($($_.type))" }
} else {
  @("no_device_reported")
}

Write-Host "[comfyui-local] Healthy."
Write-Host "  Endpoint: $Endpoint"
Write-Host "  Devices: $($deviceSummary -join ', ')"
