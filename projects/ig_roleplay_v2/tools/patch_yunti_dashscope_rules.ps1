param(
  [string]$UserProfilePath = ""
)

. (Join-Path $PSScriptRoot "bootstrap_utf8.ps1")

$ErrorActionPreference = "Stop"

function Write-Utf8File {
  param(
    [string]$Path,
    [string]$Text
  )

  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($Path, $Text, $utf8NoBom)
}

function Read-Utf8File {
  param([string]$Path)

  return [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
}

function Get-YuntiConfigPath {
  param([string]$BaseUserProfilePath)

  if ([string]::IsNullOrWhiteSpace($BaseUserProfilePath)) {
    $BaseUserProfilePath = [Environment]::GetFolderPath("UserProfile")
  }
  return Join-Path $BaseUserProfilePath ".config\com.vortex.helper\config.yaml"
}

function Get-ControllerBaseUrl {
  param([string]$ConfigPath)

  if (-not (Test-Path $ConfigPath)) {
    return $null
  }

  $line = Select-String -Path $ConfigPath -Pattern '^external-controller:\s*(.+)$' | Select-Object -First 1
  if (-not $line) {
    return $null
  }

  $controller = $line.Matches[0].Groups[1].Value.Trim()
  if ([string]::IsNullOrWhiteSpace($controller)) {
    return $null
  }

  return "http://$controller"
}

function Try-ReloadYuntiConfig {
  param([string]$ConfigPath)

  $baseUrl = Get-ControllerBaseUrl -ConfigPath $ConfigPath
  if (-not $baseUrl) {
    return [ordered]@{
      attempted = $false
      succeeded = $false
      reason = 'controller_missing'
    }
  }

  $body = @{ path = $ConfigPath } | ConvertTo-Json -Depth 5
  $reloadUrl = $baseUrl.TrimEnd('/') + '/configs?force=true'

  try {
    Invoke-WebRequest -Uri $reloadUrl -Method Put -ContentType 'application/json' -Body $body -TimeoutSec 3 | Out-Null
    return [ordered]@{
      attempted = $true
      succeeded = $true
      reason = ''
    }
  } catch {
    return [ordered]@{
      attempted = $true
      succeeded = $false
      reason = $_.Exception.Message
    }
  }
}

function Ensure-YuntiDashScopeDirectRules {
  param([string]$ConfigPath)

  if (-not (Test-Path $ConfigPath)) {
    return [ordered]@{
      configPath = $ConfigPath
      found = $false
      changed = $false
      reload = [ordered]@{
        attempted = $false
        succeeded = $false
        reason = 'config_missing'
      }
    }
  }

  $raw = Read-Utf8File -Path $ConfigPath
  $requiredRules = @(
    '  - DOMAIN,dashscope.aliyuncs.com,DIRECT',
    '  - DOMAIN-SUFFIX,aliyuncs.com,DIRECT'
  )

  $missingRules = @($requiredRules | Where-Object { -not $raw.Contains($_) })
  if ($missingRules.Count -eq 0) {
    return [ordered]@{
      configPath = $ConfigPath
      found = $true
      changed = $false
      reload = [ordered]@{
        attempted = $false
        succeeded = $false
        reason = 'rules_already_present'
      }
    }
  }

  $updated = $raw
  $replacement = @(
    '  - DOMAIN,dashscope.aliyuncs.com,DIRECT',
    '  - DOMAIN-SUFFIX,aliyuncs.com,DIRECT',
    '  - DOMAIN-SUFFIX,alibaba.com,DIRECT'
  ) -join "`r`n"

  if ($updated -match '(?m)^  - DOMAIN-SUFFIX,alibaba\.com,DIRECT\r?$') {
    $updated = [regex]::Replace(
      $updated,
      '(?m)^  - DOMAIN-SUFFIX,alibaba\.com,DIRECT\r?$',
      [System.Text.RegularExpressions.MatchEvaluator]{
        param($match)
        return $replacement
      },
      1
    )
  } elseif ($updated -match '(?m)^  - GEOIP,CN,DIRECT\r?$') {
    $updated = [regex]::Replace(
      $updated,
      '(?m)^  - GEOIP,CN,DIRECT\r?$',
      [System.Text.RegularExpressions.MatchEvaluator]{
        param($match)
        return ('  - DOMAIN,dashscope.aliyuncs.com,DIRECT' + "`r`n" +
                '  - DOMAIN-SUFFIX,aliyuncs.com,DIRECT' + "`r`n" +
                $match.Value)
      },
      1
    )
  } else {
    $updated = $updated.TrimEnd() + "`r`n" + ($requiredRules -join "`r`n") + "`r`n"
  }

  $backupPath = $ConfigPath + '.codex.bak'
  if (-not (Test-Path $backupPath)) {
    Copy-Item $ConfigPath $backupPath -Force
  }

  Write-Utf8File -Path $ConfigPath -Text $updated
  $reload = Try-ReloadYuntiConfig -ConfigPath $ConfigPath

  return [ordered]@{
    configPath = $ConfigPath
    found = $true
    changed = $true
    reload = $reload
  }
}

$configPath = Get-YuntiConfigPath -BaseUserProfilePath $UserProfilePath
$result = Ensure-YuntiDashScopeDirectRules -ConfigPath $configPath

if (-not $result.found) {
  Write-Host "[v2] Yunti config not found; skipping local DashScope direct patch."
  exit 0
}

if ($result.changed) {
  Write-Host "[v2] Yunti DashScope direct patch applied: $($result.configPath)"
} else {
  Write-Host "[v2] Yunti DashScope direct patch already present: $($result.configPath)"
}

if ($result.reload.attempted -and $result.reload.succeeded) {
  Write-Host '[v2] Yunti config reload succeeded.'
} elseif ($result.reload.attempted) {
  Write-Host "[v2] Yunti config reload did not succeed, continuing anyway. $($result.reload.reason)"
} else {
  Write-Host "[v2] Yunti config reload skipped: $($result.reload.reason)"
}
