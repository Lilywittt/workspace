param(
  [ValidateSet("simulate", "publish")]
  [string]$Mode = "simulate",
  [string]$Provider = "",
  [string]$Model = "",
  [string]$RuntimeConfigPath = "",
  [string]$AgentConfigPath = "",
  [string]$Container = "openclaw-dev-agent"
)

. (Join-Path $PSScriptRoot "tools\bootstrap_utf8.ps1")
. (Join-Path $PSScriptRoot "tools\runtime_common.ps1")

$ErrorActionPreference = "Stop"

function Invoke-ContainerStep {
  param(
    [string]$ContainerName,
    [string]$Command
  )

  Write-Host "[v2] $Command"
  docker exec $ContainerName sh -lc ("export LANG=C.UTF-8 LC_ALL=C.UTF-8; " + $Command)
  if ($LASTEXITCODE -ne 0) {
    throw "Container step failed: $Command"
  }
}

function Convert-HostPathToContainerPath {
  param(
    [string]$HostPath,
    [string]$ProjectDir,
    [string]$ContainerProjectDir
  )

  $resolvedHostPath = [System.IO.Path]::GetFullPath($HostPath)
  $resolvedProjectDir = [System.IO.Path]::GetFullPath($ProjectDir)

  if (-not $resolvedHostPath.StartsWith($resolvedProjectDir, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Container-readable path must stay under the project directory: $resolvedHostPath"
  }

  $relative = $resolvedHostPath.Substring($resolvedProjectDir.Length).TrimStart('\', '/')
  if ([string]::IsNullOrWhiteSpace($relative)) {
    return ($ContainerProjectDir -replace '\\', '/').TrimEnd('/')
  }

  return ($ContainerProjectDir.TrimEnd('/') + '/' + ($relative -replace '\\', '/'))
}

function New-NodeCommand {
  param(
    [string]$ScriptPath,
    [string]$ConfigPath = "",
    [string]$AdditionalArgs = ""
  )

  $parts = @("node $ScriptPath")
  if (-not [string]::IsNullOrWhiteSpace($ConfigPath)) {
    $parts += "--config $ConfigPath"
  }
  if (-not [string]::IsNullOrWhiteSpace($AdditionalArgs)) {
    $parts += $AdditionalArgs.Trim()
  }

  return ($parts -join ' ').Trim()
}

$projectDir = $PSScriptRoot
$workspaceRoot = Get-ProjectWorkspaceRoot -ProjectDir $projectDir
$dotenvPath = Join-Path $workspaceRoot ".env"
$providerCatalogPath = Join-Path $projectDir "config\provider_catalog.json"
$imageGenerationScript = Join-Path $projectDir "tools\run_image_generation.ps1"
$cleanCacheScript = Join-Path $projectDir "tools\clean_runtime_cache.ps1"
$normalizeRuntimeScript = Join-Path $projectDir "tools\normalize_runtime_layout.ps1"
$yuntiPatchScript = Join-Path $projectDir "tools\patch_yunti_dashscope_rules.ps1"
$containerProjectDir = "/home/node/.openclaw/workspace/projects/ig_roleplay_v2"
$resolvedRuntimeConfigPath = if ([string]::IsNullOrWhiteSpace($RuntimeConfigPath)) {
  Get-DefaultRuntimeConfigPath -ProjectDir $projectDir
} else {
  [System.IO.Path]::GetFullPath($RuntimeConfigPath)
}
$resolvedAgentConfigPath = if ([string]::IsNullOrWhiteSpace($AgentConfigPath)) {
  Get-DefaultAgentConfigPath -ProjectDir $projectDir
} else {
  [System.IO.Path]::GetFullPath($AgentConfigPath)
}
$resolvedSignalConfigPath = $null
$agentConfig = Read-JsonFileSafe -Path $resolvedAgentConfigPath
if ($agentConfig -and $agentConfig.paths -and $agentConfig.paths.signalCollectionConfigPath) {
  $resolvedSignalConfigPath = Resolve-RelativePath -BasePath $resolvedAgentConfigPath -MaybeRelativePath ([string]$agentConfig.paths.signalCollectionConfigPath)
} else {
  $resolvedSignalConfigPath = Resolve-RelativePath -BasePath $resolvedAgentConfigPath -MaybeRelativePath "./signal_collection.config.json"
}
$signalConfig = Read-JsonFileSafe -Path $resolvedSignalConfigPath
$signalReportSetting = if ($signalConfig -and $signalConfig.paths -and $signalConfig.paths.outputReportPath) {
  [string]$signalConfig.paths.outputReportPath
} else {
  "../../../../data/ig_roleplay/signal_collection_report.json"
}
$signalReportPath = Resolve-RelativePath -BasePath $resolvedSignalConfigPath -MaybeRelativePath $signalReportSetting
$runtimeDir = Get-ConfiguredRuntimeDir -ProjectDir $projectDir -ConfigPath $resolvedRuntimeConfigPath
$runtimeFinalCurrentDir = Join-Path $runtimeDir "final\current"
$runtimeIntermediateCurrentDir = Join-Path $runtimeDir "intermediate\current"
$containerRuntimeConfigPath = Convert-HostPathToContainerPath -HostPath $resolvedRuntimeConfigPath -ProjectDir $projectDir -ContainerProjectDir $containerProjectDir
$containerAgentConfigPath = Convert-HostPathToContainerPath -HostPath $resolvedAgentConfigPath -ProjectDir $projectDir -ContainerProjectDir $containerProjectDir
$containerSignalConfigPath = Convert-HostPathToContainerPath -HostPath $resolvedSignalConfigPath -ProjectDir $projectDir -ContainerProjectDir $containerProjectDir

Import-DotEnvIfPresent -Path $dotenvPath

$resolvedProvider = if ([string]::IsNullOrWhiteSpace($Provider)) {
  if ($env:IMAGE_PROVIDER) { [string]$env:IMAGE_PROVIDER } else { "aliyun-z-image" }
} else {
  $Provider
}

if ($resolvedProvider -like 'aliyun-*' -and (Test-Path $yuntiPatchScript)) {
  try {
    & $yuntiPatchScript
  } catch {
    Write-Host "[v2] Warning: Yunti DashScope patch did not complete. $($_.Exception.Message)"
  }
}

$providerSpec = Get-ProviderCatalogEntry -CatalogPath $providerCatalogPath -ProviderName $resolvedProvider
$imageModel = if ([string]::IsNullOrWhiteSpace($Model)) {
  if ($env:IMAGE_MODEL) { [string]$env:IMAGE_MODEL } else { [string]$providerSpec.defaultModel }
} else {
  $Model
}

$requiredEnvName = if ($providerSpec.requiredEnv -and $providerSpec.requiredEnv.Count -gt 0) {
  [string]$providerSpec.requiredEnv[0]
} else {
  ""
}
$providerKey = if (-not [string]::IsNullOrWhiteSpace($requiredEnvName)) {
  [Environment]::GetEnvironmentVariable($requiredEnvName, 'Process')
} else {
  $null
}
if (-not [string]::IsNullOrWhiteSpace($requiredEnvName) -and -not $providerKey) {
  Write-Host "[v2] Warning: $requiredEnvName is missing. The host image executor will write a structured failure artifact."
}

& $normalizeRuntimeScript -ProjectDir $projectDir -ConfigPath $resolvedRuntimeConfigPath
& $cleanCacheScript -ProjectDir $projectDir -ConfigPath $resolvedRuntimeConfigPath -Target all-history -OlderThanDays 1
& $cleanCacheScript -ProjectDir $projectDir -ConfigPath $resolvedRuntimeConfigPath -Target all-current

$refreshSignalsCommand = New-NodeCommand -ScriptPath "$containerProjectDir/scripts/refresh_signals.js" -ConfigPath $containerSignalConfigPath
try {
  Invoke-ContainerStep -ContainerName $Container -Command $refreshSignalsCommand
} catch {
  Write-Host "[v2] Warning: signal refresh failed. $($_.Exception.Message)"
}

$zeroMemoryCommand = New-NodeCommand -ScriptPath "$containerProjectDir/pipeline/run_zero_memory_agent.js" -ConfigPath $containerAgentConfigPath

Invoke-ContainerStep -ContainerName $Container -Command $zeroMemoryCommand

Write-Host "[v2] Host image generation provider=$resolvedProvider model=$imageModel"
powershell -NoProfile -ExecutionPolicy Bypass -File $imageGenerationScript -ProjectDir $projectDir -ConfigPath $resolvedRuntimeConfigPath -Provider $resolvedProvider -Model $imageModel
if ($LASTEXITCODE -ne 0) {
  throw "Host image generation failed."
}

Invoke-ContainerStep -ContainerName $Container -Command (New-NodeCommand -ScriptPath "$containerProjectDir/scripts/build_post_package.js" -ConfigPath $containerRuntimeConfigPath)
Invoke-ContainerStep -ContainerName $Container -Command (New-NodeCommand -ScriptPath "$containerProjectDir/scripts/build_final_delivery.js" -ConfigPath $containerRuntimeConfigPath -AdditionalArgs ("--host-project-dir " + ($projectDir -replace '\\', '/')))
Invoke-ContainerStep -ContainerName $Container -Command (New-NodeCommand -ScriptPath "$containerProjectDir/scripts/publish_post_package.js" -ConfigPath $containerRuntimeConfigPath -AdditionalArgs $(if ($Mode -eq 'publish') { '--force-live' } else { '--dry-run' }))
Invoke-ContainerStep -ContainerName $Container -Command (New-NodeCommand -ScriptPath "$containerProjectDir/pipeline/build_zero_memory_run_summary.js" -ConfigPath $containerAgentConfigPath)

$reviewGuidePath = Join-Path $runtimeFinalCurrentDir "review_guide.txt"
$finalDeliveryPath = Join-Path $runtimeFinalCurrentDir "final_delivery.json"
$diagnosisPath = Join-Path $runtimeFinalCurrentDir "image_diagnosis.md"
$captionPath = Join-Path $runtimeFinalCurrentDir "caption.txt"
$finalImagePath = ""
if (Test-Path $finalDeliveryPath) {
  try {
    $finalDelivery = Read-JsonFile -Path $finalDeliveryPath
    $finalImagePath = [string]$finalDelivery.image.localFilePath
  } catch {
    $finalImagePath = ""
  }
}

Write-Host "[v2] Done."
Write-Host "[v2] Final review directory:"
Write-Host "  $runtimeFinalCurrentDir"
Write-Host "[v2] Review these files:"
Write-Host "  $reviewGuidePath"
if (Test-Path $diagnosisPath) {
  Write-Host "  $diagnosisPath"
}
Write-Host "  $finalDeliveryPath"
Write-Host "  $captionPath"
if (-not [string]::IsNullOrWhiteSpace($finalImagePath)) {
  Write-Host "  $finalImagePath"
}
Write-Host "  $signalReportPath"
Write-Host "[v2] Intermediate debug directory:"
Write-Host "  $runtimeIntermediateCurrentDir"
