function Resolve-ComfyUiLocalPaths {
  param(
    [string]$ProjectDir,
    [string]$InstallRoot = "",
    [string]$VenvDir = "",
    [string]$LogDir = ""
  )

  $workspaceRoot = Get-ProjectWorkspaceRoot -ProjectDir $ProjectDir
  $resolvedInstallRoot = if ([string]::IsNullOrWhiteSpace($InstallRoot)) {
    Join-Path $workspaceRoot ".local\ComfyUI"
  } else {
    [System.IO.Path]::GetFullPath($InstallRoot)
  }
  $resolvedVenvDir = if ([string]::IsNullOrWhiteSpace($VenvDir)) {
    Join-Path $workspaceRoot ".local\comfyui-env"
  } else {
    [System.IO.Path]::GetFullPath($VenvDir)
  }
  $resolvedLogDir = if ([string]::IsNullOrWhiteSpace($LogDir)) {
    Join-Path $workspaceRoot ".local\logs\comfyui"
  } else {
    [System.IO.Path]::GetFullPath($LogDir)
  }
  $runDir = Join-Path $workspaceRoot ".local\run"

  return [ordered]@{
    WorkspaceRoot = $workspaceRoot
    InstallRoot = $resolvedInstallRoot
    VenvDir = $resolvedVenvDir
    LogDir = $resolvedLogDir
    RunDir = $runDir
    PidPath = Join-Path $runDir "comfyui.pid.json"
  }
}

function Get-ComfyUiPythonPath {
  param([hashtable]$Paths)
  return Join-Path $Paths.VenvDir "Scripts\python.exe"
}

function Invoke-ExternalStep {
  param(
    [string]$FilePath,
    [string[]]$ArgumentList = @(),
    [string]$WorkingDirectory = ""
  )

  $displayArgs = if ($ArgumentList -and $ArgumentList.Count -gt 0) {
    $ArgumentList -join ' '
  } else {
    ''
  }
  Write-Host "[comfyui-local] $FilePath $displayArgs".Trim()

  if ([string]::IsNullOrWhiteSpace($WorkingDirectory)) {
    & $FilePath @ArgumentList
  } else {
    Push-Location $WorkingDirectory
    try {
      & $FilePath @ArgumentList
    } finally {
      Pop-Location
    }
  }

  if ($LASTEXITCODE -ne 0) {
    throw "Command failed: $FilePath $displayArgs"
  }
}

function Read-ComfyUiPidInfo {
  param([string]$PidPath)
  return Read-JsonFileSafe -Path $PidPath
}
