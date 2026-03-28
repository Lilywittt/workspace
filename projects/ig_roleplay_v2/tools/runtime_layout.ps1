. (Join-Path $PSScriptRoot "runtime_common.ps1")

function Test-IsZeroMemoryRunId {
  param([string]$RunId)
  return (-not [string]::IsNullOrWhiteSpace($RunId)) -and $RunId.StartsWith('zeromemory-', [System.StringComparison]::OrdinalIgnoreCase)
}

function Test-IsCanonicalZeroMemoryRunDir {
  param([string]$RunDir)

  if (-not (Test-Path $RunDir)) {
    return $false
  }

  $requiredFiles = @(
    "scene_plan.json",
    "selected_caption.json",
    "zero_memory_pipeline_validation.json"
  )

  foreach ($fileName in $requiredFiles) {
    if (-not (Test-Path (Join-Path $RunDir $fileName))) {
      return $false
    }
  }

  return $true
}

function Get-RuntimeLayoutPaths {
  param(
    [string]$ProjectDir,
    [string]$ConfigPath = ""
  )

  $runtimeDir = Get-ConfiguredRuntimeDir -ProjectDir $ProjectDir -ConfigPath $ConfigPath
  $intermediateDir = Join-Path $runtimeDir "intermediate"
  $historyDir = Join-Path $intermediateDir "history"
  $finalDir = Join-Path $runtimeDir "final"

  return [pscustomobject]@{
    RuntimeDir = $runtimeDir
    IntermediateDir = $intermediateDir
    IntermediateCurrentDir = Join-Path $intermediateDir "current"
    IntermediateRunsDir = Join-Path $intermediateDir "runs"
    IntermediateHistoryDir = $historyDir
    IntermediatePublishHistoryPath = Join-Path $historyDir "publish_history.jsonl"
    FinalDir = $finalDir
    FinalCurrentDir = Join-Path $finalDir "current"
    FinalHistoryDir = Join-Path $finalDir "history"
  }
}

function Get-ActiveRuntimeDirectories {
  param([object]$Layout)

  return @(
    $Layout.IntermediateDir,
    $Layout.IntermediateCurrentDir,
    $Layout.IntermediateRunsDir,
    $Layout.IntermediateHistoryDir,
    $Layout.FinalDir,
    $Layout.FinalCurrentDir,
    $Layout.FinalHistoryDir
  )
}

function Get-LegacyRootRuntimeDirectories {
  param([object]$Layout)

  return @(
    (Join-Path $Layout.RuntimeDir "current"),
    (Join-Path $Layout.RuntimeDir "generated"),
    (Join-Path $Layout.RuntimeDir "history"),
    (Join-Path $Layout.RuntimeDir "runs"),
    (Join-Path $Layout.RuntimeDir "deliverables"),
    (Join-Path $Layout.RuntimeDir "evaluations")
  )
}

function Get-LegacyIntermediateDirectories {
  param([object]$Layout)

  return @(
    (Join-Path $Layout.IntermediateDir "generated"),
    (Join-Path $Layout.IntermediateDir "evaluations")
  )
}

function Get-LegacyRunDirs {
  param([string]$RunsDir)

  if (-not (Test-Path $RunsDir)) {
    return @()
  }

  return Get-ChildItem -Directory $RunsDir | Where-Object {
    $name = $_.Name
    if ($name.StartsWith('zeromemory-', [System.StringComparison]::OrdinalIgnoreCase)) {
      return $false
    }

    if (Test-IsCanonicalZeroMemoryRunDir -RunDir $_.FullName) {
      return $false
    }

    if ($name.StartsWith('generatedimage-', [System.StringComparison]::OrdinalIgnoreCase)) {
      $artifact = Read-JsonFileSafe -Path (Join-Path $_.FullName 'generated_image.json')
      return -not (Test-IsZeroMemoryRunId -RunId ([string]$artifact.scenePlanRunId))
    }

    if ($name.StartsWith('postpackage-', [System.StringComparison]::OrdinalIgnoreCase)) {
      $artifact = Read-JsonFileSafe -Path (Join-Path $_.FullName 'post_package.json')
      return -not (Test-IsZeroMemoryRunId -RunId ([string]$artifact.scenePlanRunId))
    }

    if ($name.StartsWith('publishresult-', [System.StringComparison]::OrdinalIgnoreCase)) {
      $artifact = Read-JsonFileSafe -Path (Join-Path $_.FullName 'publish_result.json')
      return -not (Test-IsZeroMemoryRunId -RunId ([string]$artifact.scenePlanRunId))
    }

    return $true
  }
}

function Get-StageScopedRunMigrations {
  param([string]$RunsDir)

  if (-not (Test-Path $RunsDir)) {
    return @()
  }

  $stageArtifacts = @{
    "generatedimage-" = "generated_image.json"
    "postpackage-" = "post_package.json"
    "publishresult-" = "publish_result.json"
  }

  $migrations = @()
  foreach ($entry in (Get-ChildItem -Directory $RunsDir)) {
    $matchedPrefix = $null
    foreach ($prefix in $stageArtifacts.Keys) {
      if ($entry.Name.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        $matchedPrefix = $prefix
        break
      }
    }

    if (-not $matchedPrefix) {
      continue
    }

    $artifactFileName = $stageArtifacts[$matchedPrefix]
    $sourcePath = Join-Path $entry.FullName $artifactFileName
    $artifact = Read-JsonFileSafe -Path $sourcePath
    $scenePlanRunId = [string]$artifact.scenePlanRunId
    if ([string]::IsNullOrWhiteSpace($scenePlanRunId)) {
      continue
    }

    $targetDir = Join-Path $RunsDir $scenePlanRunId
    $targetPath = Join-Path $targetDir $artifactFileName
    $migrations += [pscustomobject]@{
      SourceDir = $entry.FullName
      SourcePath = $sourcePath
      TargetDir = $targetDir
      TargetPath = $targetPath
      ArtifactFileName = $artifactFileName
      ScenePlanRunId = $scenePlanRunId
    }
  }

  return $migrations
}

function Get-LegacyFinalDeliveryDirs {
  param([string]$FinalHistoryDir)

  if (-not (Test-Path $FinalHistoryDir)) {
    return @()
  }

  return Get-ChildItem -Directory $FinalHistoryDir | Where-Object {
    if ($_.Name -match '^finaldelivery-.*-zeromemory-') {
      return $false
    }

    $artifact = Read-JsonFileSafe -Path (Join-Path $_.FullName 'final_delivery.json')
    return [string]::IsNullOrWhiteSpace([string]$artifact.scenePlanRunId)
  }
}

function New-RuntimeCleanupTarget {
  param(
    [string]$Name,
    [string]$Path,
    [string]$Kind = 'directory'
  )

  return [pscustomobject]@{
    Name = $Name
    Path = $Path
    Kind = $Kind
  }
}

function Resolve-RuntimeCleanupTargets {
  param(
    [object]$Layout,
    [string[]]$Names
  )

  $map = @{
    "intermediate-current" = @(
      (New-RuntimeCleanupTarget -Name "intermediate-current" -Path $Layout.IntermediateCurrentDir)
    )
    "intermediate-runs" = @(
      (New-RuntimeCleanupTarget -Name "intermediate-runs" -Path $Layout.IntermediateRunsDir)
    )
    "generated-current" = @(
      (New-RuntimeCleanupTarget -Name "generated-current" -Path (Join-Path $Layout.IntermediateDir "generated\current"))
    )
    "generated-history" = @(
      (New-RuntimeCleanupTarget -Name "generated-history" -Path (Join-Path $Layout.IntermediateDir "generated\history"))
    )
    "publish-history" = @(
      (New-RuntimeCleanupTarget -Name "publish-history" -Path $Layout.IntermediatePublishHistoryPath -Kind "jsonl")
    )
    "final-current" = @(
      (New-RuntimeCleanupTarget -Name "final-current" -Path $Layout.FinalCurrentDir)
    )
    "final-history" = @(
      (New-RuntimeCleanupTarget -Name "final-history" -Path $Layout.FinalHistoryDir)
    )
    "all-current" = @(
      (New-RuntimeCleanupTarget -Name "intermediate-current" -Path $Layout.IntermediateCurrentDir),
      (New-RuntimeCleanupTarget -Name "final-current" -Path $Layout.FinalCurrentDir)
    )
    "all-test-cache" = @(
      (New-RuntimeCleanupTarget -Name "intermediate-runs" -Path $Layout.IntermediateRunsDir)
    )
    "all-history" = @(
      (New-RuntimeCleanupTarget -Name "intermediate-runs" -Path $Layout.IntermediateRunsDir),
      (New-RuntimeCleanupTarget -Name "publish-history" -Path $Layout.IntermediatePublishHistoryPath -Kind "jsonl"),
      (New-RuntimeCleanupTarget -Name "final-history" -Path $Layout.FinalHistoryDir)
    )
  }

  $resolved = @()
  foreach ($name in $Names) {
    if (-not $map.ContainsKey($name)) {
      throw "Unknown cache target: $name"
    }
    $resolved += $map[$name]
  }

  return $resolved | Group-Object Name, Path, Kind | ForEach-Object { $_.Group[0] }
}

function Parse-RuntimeTimestamp {
  param([object]$Value)

  if ([string]::IsNullOrWhiteSpace([string]$Value)) {
    return $null
  }

  $parsed = [DateTimeOffset]::MinValue
  if ([DateTimeOffset]::TryParse([string]$Value, [System.Globalization.CultureInfo]::InvariantCulture, [System.Globalization.DateTimeStyles]::RoundtripKind, [ref]$parsed)) {
    return $parsed.UtcDateTime
  }

  return $null
}

function Get-DirectoryEntriesOlderThan {
  param(
    [string]$Path,
    [datetime]$Cutoff
  )

  if (-not (Test-Path $Path)) {
    return @()
  }

  return Get-ChildItem -Force -Path $Path | Where-Object {
    $_.LastWriteTimeUtc -lt $Cutoff.ToUniversalTime()
  }
}

function Clear-DirectoryContents {
  param([string]$Path)

  Ensure-Dir -Path $Path
  Get-ChildItem -Force -Path $Path | Remove-Item -Recurse -Force
}

function Clear-JsonlFile {
  param([string]$Path)

  Ensure-Dir -Path (Split-Path -Parent $Path)
  if (Test-Path $Path) {
    Remove-Item -Force $Path
  }
}

function Prune-JsonlFileByCreatedAt {
  param(
    [string]$Path,
    [datetime]$Cutoff,
    [switch]$ListOnly
  )

  if (-not (Test-Path $Path)) {
    return 0
  }

  $rawLines = Get-Content -Encoding UTF8 -Path $Path
  $keptLines = New-Object System.Collections.Generic.List[string]
  $removedCount = 0

  foreach ($line in $rawLines) {
    if ([string]::IsNullOrWhiteSpace($line)) {
      continue
    }

    $parsed = $null
    try {
      $parsed = $line | ConvertFrom-Json
    } catch {
      $keptLines.Add($line)
      continue
    }

    $createdAt = Parse-RuntimeTimestamp -Value $parsed.createdAt
    if ($createdAt -and $createdAt -lt $Cutoff.ToUniversalTime()) {
      $removedCount += 1
      continue
    }

    $keptLines.Add($line)
  }

  if (-not $ListOnly) {
    if ($keptLines.Count -eq 0) {
      Remove-Item -Force $Path
    } else {
      [System.IO.File]::WriteAllLines($Path, $keptLines, [System.Text.UTF8Encoding]::new($false))
    }
  }

  return $removedCount
}
