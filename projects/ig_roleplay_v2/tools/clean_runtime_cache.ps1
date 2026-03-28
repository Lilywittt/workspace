param(
  [string]$ProjectDir = "F:\openclaw-dev\workspace\projects\ig_roleplay_v2",
  [string]$ConfigPath = "",
  [string[]]$Target = @("all-test-cache"),
  [double]$OlderThanDays = 0,
  [switch]$ListOnly
)

. (Join-Path $PSScriptRoot "bootstrap_utf8.ps1")
. (Join-Path $PSScriptRoot "runtime_layout.ps1")

$ErrorActionPreference = "Stop"

function Format-CleanupMode {
  param([double]$OlderThanDays)

  if ($OlderThanDays -gt 0) {
    return "prune items older than $OlderThanDays day(s)"
  }

  return "clear all contents"
}

function Invoke-ClearTarget {
  param([object]$Entry)

  if ($Entry.Kind -eq 'jsonl') {
    Clear-JsonlFile -Path $Entry.Path
    return
  }

  Clear-DirectoryContents -Path $Entry.Path
}

function Invoke-PruneTarget {
  param(
    [object]$Entry,
    [datetime]$Cutoff,
    [switch]$ListOnly
  )

  if ($Entry.Kind -eq 'jsonl') {
    $removedCount = Prune-JsonlFileByCreatedAt -Path $Entry.Path -Cutoff $Cutoff -ListOnly:$ListOnly
    if ($ListOnly) {
      Write-Host "[cache] would prune $removedCount publish-history record(s): $($Entry.Path)"
    } else {
      Write-Host "[cache] pruned $removedCount publish-history record(s): $($Entry.Path)"
    }
    return
  }

  $entries = @(Get-DirectoryEntriesOlderThan -Path $Entry.Path -Cutoff $Cutoff)
  if ($ListOnly) {
    if ($entries.Count -eq 0) {
      Write-Host "[cache] nothing older than cutoff in: $($Entry.Path)"
      return
    }
    foreach ($item in $entries) {
      Write-Host "[cache] would remove old item: $($item.FullName)"
    }
    return
  }

  foreach ($item in $entries) {
    Remove-Item -Recurse -Force $item.FullName
    Write-Host "[cache] removed old item: $($item.FullName)"
  }

  if ($entries.Count -eq 0) {
    Write-Host "[cache] nothing older than cutoff in: $($Entry.Path)"
  }
}

$layout = Get-RuntimeLayoutPaths -ProjectDir $ProjectDir -ConfigPath $ConfigPath
$targets = Resolve-RuntimeCleanupTargets -Layout $layout -Names $Target
$cutoff = if ($OlderThanDays -gt 0) { (Get-Date).ToUniversalTime().AddDays(-1 * $OlderThanDays) } else { $null }

Write-Host "[cache] Project runtime root:"
Write-Host "  $($layout.RuntimeDir)"
Write-Host "[cache] Mode: $(Format-CleanupMode -OlderThanDays $OlderThanDays)"

foreach ($entry in $targets) {
  if ($ListOnly) {
    if ($OlderThanDays -gt 0) {
      Invoke-PruneTarget -Entry $entry -Cutoff $cutoff -ListOnly
    } else {
      Write-Host "[cache] would clear: $($entry.Path)"
    }
    continue
  }

  if ($OlderThanDays -gt 0) {
    Invoke-PruneTarget -Entry $entry -Cutoff $cutoff
    continue
  }

  Invoke-ClearTarget -Entry $entry
  Write-Host "[cache] cleared: $($entry.Path)"
}

if ($ListOnly) {
  Write-Host "[cache] Preview only. Re-run without -ListOnly to apply the selected cleanup mode."
} else {
  Write-Host "[cache] Done."
}
