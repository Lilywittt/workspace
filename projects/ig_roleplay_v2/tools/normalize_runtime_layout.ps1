param(
  [string]$ProjectDir = "F:\openclaw-dev\workspace\projects\ig_roleplay_v2",
  [string]$ConfigPath = "",
  [switch]$ListOnly
)

. (Join-Path $PSScriptRoot "bootstrap_utf8.ps1")
. (Join-Path $PSScriptRoot "runtime_layout.ps1")

$ErrorActionPreference = "Stop"

function Test-PathUnderDirectory {
  param(
    [string]$Path,
    [string]$Directory
  )

  if ([string]::IsNullOrWhiteSpace($Path) -or [string]::IsNullOrWhiteSpace($Directory)) {
    return $false
  }

  try {
    $resolvedPath = [System.IO.Path]::GetFullPath($Path)
    $resolvedDirectory = [System.IO.Path]::GetFullPath($Directory)
  } catch {
    return $false
  }

  if (-not $resolvedDirectory.EndsWith([System.IO.Path]::DirectorySeparatorChar)) {
    $resolvedDirectory += [System.IO.Path]::DirectorySeparatorChar
  }

  return $resolvedPath.StartsWith($resolvedDirectory, [System.StringComparison]::OrdinalIgnoreCase)
}

function Get-LegacyGeneratedImageMigrations {
  param([object]$Layout)

  $legacyHistoryDir = Join-Path $Layout.IntermediateDir "generated\history"
  $candidateArtifactPaths = @()
  $currentArtifactPath = Join-Path $Layout.IntermediateCurrentDir 'generated_image.json'
  if (Test-Path $currentArtifactPath) {
    $candidateArtifactPaths += $currentArtifactPath
  }
  if (Test-Path $Layout.IntermediateRunsDir) {
    $candidateArtifactPaths += Get-ChildItem -Directory $Layout.IntermediateRunsDir | ForEach-Object {
      $artifactPath = Join-Path $_.FullName 'generated_image.json'
      if (Test-Path $artifactPath) {
        $artifactPath
      }
    }
  }

  $migrations = @()
  foreach ($artifactPath in ($candidateArtifactPaths | Sort-Object -Unique)) {
    $artifact = Read-JsonFileSafe -Path $artifactPath
    if (-not $artifact) {
      continue
    }

    $runId = [string]$artifact.scenePlanRunId
    $localFilePath = [string]$artifact.localFilePath
    if ([string]::IsNullOrWhiteSpace($runId) -or [string]::IsNullOrWhiteSpace($localFilePath)) {
      continue
    }
    if (-not (Test-PathUnderDirectory -Path $localFilePath -Directory $legacyHistoryDir)) {
      continue
    }

    $targetDir = Join-Path (Join-Path $Layout.IntermediateRunsDir $runId) 'generated_assets'
    $targetPath = Join-Path $targetDir (Split-Path $localFilePath -Leaf)
    $migrations += [pscustomobject]@{
      RunId = $runId
      SourceFilePath = $localFilePath
      TargetDir = $targetDir
      TargetFilePath = $targetPath
    }
  }

  return $migrations | Group-Object RunId, SourceFilePath, TargetFilePath | ForEach-Object { $_.Group[0] }
}

function Get-ReferenceCandidatePaths {
  param(
    [object]$Layout,
    [string]$RunId
  )

  $runDir = Join-Path $Layout.IntermediateRunsDir $RunId
  $paths = @(
    (Join-Path $Layout.IntermediateCurrentDir 'generated_image.json'),
    (Join-Path $Layout.IntermediateCurrentDir 'post_package.json'),
    (Join-Path $Layout.IntermediateCurrentDir 'run_summary.json'),
    (Join-Path $runDir 'generated_image.json'),
    (Join-Path $runDir 'post_package.json'),
    (Join-Path $runDir 'run_summary.json'),
    (Join-Path $Layout.FinalCurrentDir 'final_delivery.json')
  )

  if (Test-Path $Layout.FinalHistoryDir) {
    $paths += Get-ChildItem -Path $Layout.FinalHistoryDir -Filter 'final_delivery.json' -Recurse -File | ForEach-Object { $_.FullName }
  }

  return $paths | Sort-Object -Unique
}

function Update-GeneratedImageReferenceFiles {
  param(
    [object]$Layout,
    [object]$Migration,
    [switch]$ListOnly
  )

  foreach ($path in (Get-ReferenceCandidatePaths -Layout $Layout -RunId $Migration.RunId)) {
    if (-not (Test-Path $path)) {
      continue
    }

    $json = Read-JsonFileSafe -Path $path
    if (-not $json) {
      continue
    }

    $fileName = Split-Path $path -Leaf
    $changed = $false

    if ($fileName -eq 'generated_image.json') {
      if ([string]$json.scenePlanRunId -ne $Migration.RunId) {
        continue
      }
      if ([string]$json.localFilePath -eq $Migration.SourceFilePath) {
        $json.localFilePath = $Migration.TargetFilePath
        $changed = $true
      }
      if (-not [string]::IsNullOrWhiteSpace([string]$json.latestFilePath)) {
        $json.latestFilePath = ''
        $changed = $true
      }
    } elseif ($fileName -eq 'post_package.json') {
      if ([string]$json.scenePlanRunId -ne $Migration.RunId -or -not $json.image) {
        continue
      }
      if ([string]$json.image.localFilePath -eq $Migration.SourceFilePath) {
        $json.image.localFilePath = $Migration.TargetFilePath
        $changed = $true
      }
      if ($null -ne $json.image.latestFilePath) {
        $json.image.latestFilePath = $null
        $changed = $true
      }
    } elseif ($fileName -eq 'run_summary.json') {
      if ([string]$json.runId -ne $Migration.RunId -or -not $json.image) {
        continue
      }
      if ([string]$json.image.localFilePath -eq $Migration.SourceFilePath) {
        $json.image.localFilePath = $Migration.TargetFilePath
        $changed = $true
      }
    } elseif ($fileName -eq 'final_delivery.json') {
      if ([string]$json.scenePlanRunId -ne $Migration.RunId -or -not $json.image) {
        continue
      }
      if ([string]$json.image.sourceLocalFilePath -eq $Migration.SourceFilePath) {
        $json.image.sourceLocalFilePath = $Migration.TargetFilePath
        $changed = $true
      }
    }

    if (-not $changed) {
      continue
    }

    if ($ListOnly) {
      Write-Host "[runtime-layout] would rewrite generated image reference: $path"
      continue
    }

    Write-JsonFile -Path $path -Object $json
    Write-Host "[runtime-layout] rewrote generated image reference: $path"
  }
}

function Move-LegacyGeneratedImageFile {
  param(
    [object]$Migration,
    [switch]$ListOnly
  )

  if ($ListOnly) {
    Write-Host "[runtime-layout] would consolidate generated image file: $($Migration.SourceFilePath) -> $($Migration.TargetFilePath)"
    return
  }

  Ensure-Dir -Path $Migration.TargetDir
  if (Test-Path $Migration.SourceFilePath) {
    if (Test-Path $Migration.TargetFilePath) {
      Remove-Item -Force $Migration.SourceFilePath
    } else {
      Move-Item -Force -Path $Migration.SourceFilePath -Destination $Migration.TargetFilePath
    }
    Write-Host "[runtime-layout] consolidated generated image file into run dir: $($Migration.TargetFilePath)"
    return
  }

  if (Test-Path $Migration.TargetFilePath) {
    Write-Host "[runtime-layout] generated image file already consolidated: $($Migration.TargetFilePath)"
    return
  }

  Write-Host "[runtime-layout] skipped missing generated image file: $($Migration.SourceFilePath)"
}

$layout = Get-RuntimeLayoutPaths -ProjectDir $ProjectDir -ConfigPath $ConfigPath
$activeDirs = @(Get-ActiveRuntimeDirectories -Layout $layout)
$legacyRootDirs = @(Get-LegacyRootRuntimeDirectories -Layout $layout)
$legacyIntermediateDirs = @(Get-LegacyIntermediateDirectories -Layout $layout)
$legacyGeneratedImageMigrations = @(Get-LegacyGeneratedImageMigrations -Layout $layout)
$stageRunMigrations = @(Get-StageScopedRunMigrations -RunsDir $layout.IntermediateRunsDir)
$legacyFinalHistoryDirs = @(Get-LegacyFinalDeliveryDirs -FinalHistoryDir $layout.FinalHistoryDir)

Write-Host "[runtime-layout] Project runtime root:"
Write-Host "  $($layout.RuntimeDir)"

foreach ($dir in $activeDirs) {
  if ($ListOnly) {
    if (-not (Test-Path $dir)) {
      Write-Host "[runtime-layout] would ensure: $dir"
    }
    continue
  }
  Ensure-Dir -Path $dir
}

foreach ($dir in $legacyRootDirs) {
  if (-not (Test-Path $dir)) {
    continue
  }

  if ($ListOnly) {
    Write-Host "[runtime-layout] would remove legacy root dir: $dir"
    continue
  }

  Remove-Tree -Path $dir
  Write-Host "[runtime-layout] removed legacy root dir: $dir"
}

foreach ($dir in $legacyIntermediateDirs) {
  if (-not (Test-Path $dir)) {
    continue
  }

  $pendingGeneratedMigrations = @($legacyGeneratedImageMigrations | Where-Object {
    Test-PathUnderDirectory -Path $_.SourceFilePath -Directory $dir
  })
  foreach ($migration in $pendingGeneratedMigrations) {
    Update-GeneratedImageReferenceFiles -Layout $layout -Migration $migration -ListOnly:$ListOnly
    Move-LegacyGeneratedImageFile -Migration $migration -ListOnly:$ListOnly
  }

  if ($ListOnly) {
    Write-Host "[runtime-layout] would remove legacy intermediate dir: $dir"
    continue
  }

  Remove-Tree -Path $dir
  Write-Host "[runtime-layout] removed legacy intermediate dir: $dir"
}

foreach ($migration in $stageRunMigrations) {
  if ($ListOnly) {
    Write-Host "[runtime-layout] would consolidate stage artifact: $($migration.SourcePath) -> $($migration.TargetPath)"
    continue
  }

  Ensure-Dir -Path $migration.TargetDir
  Move-Item -Force -Path $migration.SourcePath -Destination $migration.TargetPath
  Remove-Tree -Path $migration.SourceDir
  Write-Host "[runtime-layout] consolidated stage artifact into run dir: $($migration.TargetPath)"
}

$legacyRunDirs = @(Get-LegacyRunDirs -RunsDir $layout.IntermediateRunsDir)
foreach ($entry in $legacyRunDirs) {
  if ($ListOnly) {
    Write-Host "[runtime-layout] would remove legacy intermediate run dir: $($entry.FullName)"
    continue
  }

  Remove-Tree -Path $entry.FullName
  Write-Host "[runtime-layout] removed legacy intermediate run dir: $($entry.FullName)"
}

foreach ($entry in $legacyFinalHistoryDirs) {
  if ($ListOnly) {
    Write-Host "[runtime-layout] would remove legacy final history dir: $($entry.FullName)"
    continue
  }

  Remove-Tree -Path $entry.FullName
  Write-Host "[runtime-layout] removed legacy final history dir: $($entry.FullName)"
}

if ($ListOnly) {
  Write-Host "[runtime-layout] Preview only. Re-run without -ListOnly to apply the runtime layout cleanup."
} else {
  Write-Host "[runtime-layout] Done."
}
