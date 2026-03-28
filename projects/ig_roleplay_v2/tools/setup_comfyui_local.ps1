param(
  [string]$ProjectDir = "F:\openclaw-dev\workspace\projects\ig_roleplay_v2",
  [string]$InstallRoot = "",
  [string]$VenvDir = "",
  [string]$LogDir = "",
  [string]$PythonExe = "python",
  [string]$TorchIndexUrl = "https://download.pytorch.org/whl/cu128",
  [string]$CheckpointPath = "",
  [string]$CheckpointName = "animagine-xl-4.0-opt.safetensors",
  [switch]$SkipTorchInstall,
  [switch]$SkipRequirementsInstall
)

. (Join-Path $PSScriptRoot "bootstrap_utf8.ps1")
. (Join-Path $PSScriptRoot "runtime_common.ps1")
. (Join-Path $PSScriptRoot "comfyui_local_common.ps1")

$ErrorActionPreference = "Stop"

$paths = Resolve-ComfyUiLocalPaths -ProjectDir $ProjectDir -InstallRoot $InstallRoot -VenvDir $VenvDir -LogDir $LogDir
$pythonPath = Get-ComfyUiPythonPath -Paths $paths

Ensure-Dir $paths.LogDir
Ensure-Dir $paths.RunDir

if (-not (Test-Path $paths.InstallRoot)) {
  $parentDir = Split-Path -Path $paths.InstallRoot -Parent
  Ensure-Dir $parentDir
  Invoke-ExternalStep -FilePath "git" -ArgumentList @("clone", "https://github.com/comfyanonymous/ComfyUI.git", $paths.InstallRoot)
} else {
  Write-Host "[comfyui-local] Reusing existing install: $($paths.InstallRoot)"
}

if (-not (Test-Path $pythonPath)) {
  Ensure-Dir $paths.VenvDir
  Invoke-ExternalStep -FilePath $PythonExe -ArgumentList @("-m", "venv", $paths.VenvDir)
} else {
  Write-Host "[comfyui-local] Reusing existing venv: $($paths.VenvDir)"
}

Invoke-ExternalStep -FilePath $pythonPath -ArgumentList @("-m", "pip", "install", "--upgrade", "pip")

if (-not $SkipTorchInstall) {
  Invoke-ExternalStep -FilePath $pythonPath -ArgumentList @(
    "-m", "pip", "install",
    "torch", "torchvision", "torchaudio",
    "--index-url", $TorchIndexUrl
  )
}

if (-not $SkipRequirementsInstall) {
  $requirementsPath = Join-Path $paths.InstallRoot "requirements.txt"
  Invoke-ExternalStep -FilePath $pythonPath -ArgumentList @("-m", "pip", "install", "-r", $requirementsPath)
}

$checkpointDir = Join-Path $paths.InstallRoot "models\checkpoints"
Ensure-Dir $checkpointDir

if (-not [string]::IsNullOrWhiteSpace($CheckpointPath)) {
  $resolvedCheckpointPath = [System.IO.Path]::GetFullPath($CheckpointPath)
  if (-not (Test-Path $resolvedCheckpointPath)) {
    throw "Checkpoint file not found: $resolvedCheckpointPath"
  }
  $targetPath = Join-Path $checkpointDir $CheckpointName
  Copy-Item -Path $resolvedCheckpointPath -Destination $targetPath -Force
  Write-Host "[comfyui-local] Copied checkpoint to $targetPath"
} else {
  Write-Host "[comfyui-local] No checkpoint was copied. Place '$CheckpointName' under $checkpointDir before first generation."
}

Write-Host "[comfyui-local] Setup complete."
Write-Host "  InstallRoot: $($paths.InstallRoot)"
Write-Host "  VenvDir: $($paths.VenvDir)"
Write-Host "  LogDir: $($paths.LogDir)"
Write-Host "  CheckpointDir: $checkpointDir"
