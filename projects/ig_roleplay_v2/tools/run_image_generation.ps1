param(
  [string]$ProjectDir = "F:\openclaw-dev\workspace\projects\ig_roleplay_v2",
  [string]$ConfigPath = "",
  [ValidateSet("openai-images", "zhipu-images", "aliyun-qwen-image", "aliyun-z-image", "comfyui-local-anime")]
  [string]$Provider = "aliyun-z-image",
  [string]$Model = "",
  [string]$Quality = "medium",
  [string]$OutputFormat = "png"
)

. (Join-Path $PSScriptRoot "bootstrap_utf8.ps1")
. (Join-Path $PSScriptRoot "runtime_common.ps1")

$ErrorActionPreference = "Stop"

$workspaceRoot = Get-ProjectWorkspaceRoot -ProjectDir $ProjectDir
$dotenvPath = Join-Path $workspaceRoot '.env'
Import-DotEnvIfPresent -Path $dotenvPath

$resolvedProjectDir = [System.IO.Path]::GetFullPath($ProjectDir)
$resolvedConfigPath = if ([string]::IsNullOrWhiteSpace($ConfigPath)) {
  Get-DefaultRuntimeConfigPath -ProjectDir $resolvedProjectDir
} else {
  [System.IO.Path]::GetFullPath($ConfigPath)
}
$runnerScript = Join-Path $resolvedProjectDir "scripts\run_image_generation.js"

$nodeArgs = @(
  $runnerScript,
  '--project-dir', $resolvedProjectDir,
  '--config', $resolvedConfigPath,
  '--provider', $Provider,
  '--quality', $Quality,
  '--output-format', $OutputFormat
)
if (-not [string]::IsNullOrWhiteSpace($Model)) {
  $nodeArgs += @('--model', $Model)
}

node @nodeArgs
exit $LASTEXITCODE
