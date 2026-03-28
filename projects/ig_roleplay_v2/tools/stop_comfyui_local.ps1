param(
  [string]$ProjectDir = "F:\openclaw-dev\workspace\projects\ig_roleplay_v2",
  [string]$InstallRoot = "",
  [string]$VenvDir = "",
  [string]$LogDir = ""
)

. (Join-Path $PSScriptRoot "bootstrap_utf8.ps1")
. (Join-Path $PSScriptRoot "runtime_common.ps1")
. (Join-Path $PSScriptRoot "comfyui_local_common.ps1")

$ErrorActionPreference = "Stop"

$paths = Resolve-ComfyUiLocalPaths -ProjectDir $ProjectDir -InstallRoot $InstallRoot -VenvDir $VenvDir -LogDir $LogDir
$pidInfo = Read-ComfyUiPidInfo -PidPath $paths.PidPath

if (-not $pidInfo -or -not $pidInfo.pid) {
  Write-Host "[comfyui-local] No pid file found. Nothing to stop."
  exit 0
}

$process = Get-Process -Id ([int]$pidInfo.pid) -ErrorAction SilentlyContinue
if ($process) {
  Stop-Process -Id $process.Id -Force
  Write-Host "[comfyui-local] Stopped PID $($process.Id)."
} else {
  Write-Host "[comfyui-local] PID file existed but process was already gone."
}

if (Test-Path $paths.PidPath) {
  Remove-Item $paths.PidPath -Force
}
