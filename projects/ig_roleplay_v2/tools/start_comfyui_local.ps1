param(
  [string]$ProjectDir = "F:\openclaw-dev\workspace\projects\ig_roleplay_v2",
  [string]$InstallRoot = "",
  [string]$VenvDir = "",
  [string]$LogDir = "",
  [string]$ListenHost = "127.0.0.1",
  [int]$Port = 8188,
  [int]$WaitForReadySeconds = 30,
  [string[]]$AdditionalArgs = @()
)

. (Join-Path $PSScriptRoot "bootstrap_utf8.ps1")
. (Join-Path $PSScriptRoot "runtime_common.ps1")
. (Join-Path $PSScriptRoot "comfyui_local_common.ps1")

$ErrorActionPreference = "Stop"

$paths = Resolve-ComfyUiLocalPaths -ProjectDir $ProjectDir -InstallRoot $InstallRoot -VenvDir $VenvDir -LogDir $LogDir
$pythonPath = Get-ComfyUiPythonPath -Paths $paths
$mainPyPath = Join-Path $paths.InstallRoot "main.py"
$stdoutPath = Join-Path $paths.LogDir "comfyui.stdout.log"
$stderrPath = Join-Path $paths.LogDir "comfyui.stderr.log"

if (-not (Test-Path $pythonPath)) {
  throw "ComfyUI venv python not found: $pythonPath. Run setup_comfyui_local.ps1 first."
}
if (-not (Test-Path $mainPyPath)) {
  throw "ComfyUI main.py not found: $mainPyPath. Run setup_comfyui_local.ps1 first."
}

Ensure-Dir $paths.LogDir
Ensure-Dir $paths.RunDir

$existingPidInfo = Read-ComfyUiPidInfo -PidPath $paths.PidPath
if ($existingPidInfo -and $existingPidInfo.pid) {
  $existingProcess = Get-Process -Id ([int]$existingPidInfo.pid) -ErrorAction SilentlyContinue
  if ($existingProcess) {
    Write-Host "[comfyui-local] Already running."
    Write-Host "  PID: $($existingProcess.Id)"
    Write-Host "  Endpoint: http://$ListenHost`:$Port"
    Write-Host "  Stdout: $stdoutPath"
    Write-Host "  Stderr: $stderrPath"
    exit 0
  }
}

$argumentList = @(
  $mainPyPath,
  "--listen", $ListenHost,
  "--port", [string]$Port
) + $AdditionalArgs

$process = Start-Process -FilePath $pythonPath `
  -ArgumentList $argumentList `
  -WorkingDirectory $paths.InstallRoot `
  -RedirectStandardOutput $stdoutPath `
  -RedirectStandardError $stderrPath `
  -PassThru

$pidInfo = [ordered]@{
  pid = $process.Id
  startedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  endpoint = "http://$ListenHost`:$Port"
  installRoot = $paths.InstallRoot
  venvDir = $paths.VenvDir
  stdoutPath = $stdoutPath
  stderrPath = $stderrPath
}
Write-JsonFile -Path $paths.PidPath -Object $pidInfo

$healthUrl = "http://$ListenHost`:$Port/system_stats"
$deadline = (Get-Date).AddSeconds($WaitForReadySeconds)
$isReady = $false
while ((Get-Date) -lt $deadline) {
  try {
    Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 5 | Out-Null
    $isReady = $true
    break
  } catch {
    Start-Sleep -Milliseconds 750
  }
}

Write-Host "[comfyui-local] Started."
Write-Host "  PID: $($process.Id)"
Write-Host "  Endpoint: http://$ListenHost`:$Port"
Write-Host "  Stdout: $stdoutPath"
Write-Host "  Stderr: $stderrPath"
Write-Host "  PID file: $($paths.PidPath)"
Write-Host "  Ready: $isReady"

if (-not $isReady) {
  throw "ComfyUI process started but did not answer on $healthUrl within $WaitForReadySeconds seconds."
}
