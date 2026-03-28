function Ensure-Dir {
  param([string]$Path)
  if (-not (Test-Path $Path)) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
  }
}

function Remove-Tree {
  param([string]$Path)
  if (Test-Path $Path) {
    Remove-Item -Recurse -Force $Path
  }
}

function Read-JsonFile {
  param([string]$Path)
  $raw = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
  return $raw | ConvertFrom-Json
}

function Read-JsonFileSafe {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    return $null
  }

  try {
    return Read-JsonFile -Path $Path
  } catch {
    return $null
  }
}

function Write-JsonFile {
  param(
    [string]$Path,
    [object]$Object
  )
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  $json = $Object | ConvertTo-Json -Depth 100
  [System.IO.File]::WriteAllText($Path, $json, $utf8NoBom)
}

function Import-DotEnvIfPresent {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    return
  }

  Get-Content -Encoding UTF8 $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line) { return }
    if ($line.StartsWith('#')) { return }
    $parts = $line.Split('=', 2)
    if ($parts.Count -ne 2) { return }
    $name = $parts[0].Trim()
    $value = $parts[1].Trim().Trim('"')
    if (-not [Environment]::GetEnvironmentVariable($name, 'Process')) {
      [Environment]::SetEnvironmentVariable($name, $value, 'Process')
    }
  }
}

function Resolve-RelativePath {
  param(
    [string]$BasePath,
    [string]$MaybeRelativePath
  )

  if ([string]::IsNullOrWhiteSpace($MaybeRelativePath)) {
    throw "Path value cannot be empty."
  }

  if ([System.IO.Path]::IsPathRooted($MaybeRelativePath)) {
    return [System.IO.Path]::GetFullPath($MaybeRelativePath)
  }

  $resolvedBasePath = [System.IO.Path]::GetFullPath($BasePath)
  $baseDir = if (Test-Path $resolvedBasePath -PathType Leaf) {
    Split-Path -Path $resolvedBasePath -Parent
  } else {
    $resolvedBasePath
  }

  return [System.IO.Path]::GetFullPath((Join-Path $baseDir $MaybeRelativePath))
}

function Get-ProjectWorkspaceRoot {
  param([string]$ProjectDir)
  return [System.IO.Path]::GetFullPath((Join-Path $ProjectDir "..\..\.."))
}

function Get-DefaultRuntimeConfigPath {
  param([string]$ProjectDir)
  return Join-Path $ProjectDir "config\runtime.config.json"
}

function Get-DefaultAgentConfigPath {
  param([string]$ProjectDir)
  return Join-Path $ProjectDir "config\runtime\agent_runtime.config.json"
}

function Get-ConfiguredRuntimeDir {
  param(
    [string]$ProjectDir,
    [string]$ConfigPath = ""
  )

  $resolvedConfigPath = if ([string]::IsNullOrWhiteSpace($ConfigPath)) {
    Get-DefaultRuntimeConfigPath -ProjectDir $ProjectDir
  } else {
    [System.IO.Path]::GetFullPath($ConfigPath)
  }

  $config = Read-JsonFileSafe -Path $resolvedConfigPath
  $runtimeSetting = if ($config -and $config.paths -and $config.paths.runtimeDir) {
    [string]$config.paths.runtimeDir
  } else {
    "../runtime"
  }

  return Resolve-RelativePath -BasePath $resolvedConfigPath -MaybeRelativePath $runtimeSetting
}

function Resolve-RuntimeLayout {
  param([string]$RuntimeDir)

  $resolved = [System.IO.Path]::GetFullPath($RuntimeDir)
  $leaf = Split-Path -Path $resolved -Leaf
  if ($leaf -eq 'intermediate' -or $leaf -eq 'final') {
    $root = Split-Path -Path $resolved -Parent
    return [ordered]@{
      RuntimeRoot = $root
      IntermediateDir = if ($leaf -eq 'intermediate') { $resolved } else { Join-Path $root 'intermediate' }
      FinalDir = if ($leaf -eq 'final') { $resolved } else { Join-Path $root 'final' }
    }
  }

  return [ordered]@{
    RuntimeRoot = $resolved
    IntermediateDir = Join-Path $resolved 'intermediate'
    FinalDir = Join-Path $resolved 'final'
  }
}

function Get-RuntimeCurrentDir {
  param([string]$RuntimeDir)
  $layout = Resolve-RuntimeLayout -RuntimeDir $RuntimeDir
  return Join-Path $layout.IntermediateDir 'current'
}

function Get-RuntimeRunsDir {
  param([string]$RuntimeDir)
  $layout = Resolve-RuntimeLayout -RuntimeDir $RuntimeDir
  return Join-Path $layout.IntermediateDir 'runs'
}

function Get-ProviderCatalogPath {
  param([string]$BaseProjectDir)
  return Join-Path $BaseProjectDir "config\provider_catalog.json"
}

function Get-ProviderCatalogEntry {
  param(
    [string]$CatalogPath,
    [string]$ProviderName
  )

  $catalog = Read-JsonFile -Path $CatalogPath
  $entry = $catalog.PSObject.Properties[$ProviderName]
  if (-not $entry) {
    throw "Unknown image provider: $ProviderName"
  }

  return $entry.Value
}
