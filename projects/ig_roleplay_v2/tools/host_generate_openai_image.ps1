param(
  [string]$ProjectDir = "F:\openclaw-dev\workspace\projects\ig_roleplay_v2",
  [ValidateSet("openai-images", "zhipu-images", "aliyun-qwen-image", "aliyun-z-image")]
  [string]$Provider = "aliyun-z-image",
  [string]$Model = "",
  [string]$Quality = "medium",
  [string]$OutputFormat = "png"
)

. (Join-Path $PSScriptRoot "bootstrap_utf8.ps1")

$ErrorActionPreference = "Stop"

function Read-JsonFile {
  param([string]$Path)
  $raw = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
  return $raw | ConvertFrom-Json
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

function Ensure-Dir {
  param([string]$Path)
  if (-not (Test-Path $Path)) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
  }
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

function Get-RuntimeGeneratedDir {
  param([string]$RuntimeDir)
  $layout = Resolve-RuntimeLayout -RuntimeDir $RuntimeDir
  return Join-Path $layout.IntermediateDir 'generated'
}

function Get-ProviderCatalogPath {
  param([string]$BaseProjectDir)
  return Join-Path $BaseProjectDir "config\provider_catalog.json"
}

function Get-EndpointHost {
  param([string]$Url)
  try {
    return ([System.Uri]$Url).Host
  } catch {
    return $null
  }
}

function Resolve-HostAddresses {
  param([string]$HostName)
  try {
    return [System.Net.Dns]::GetHostAddresses($HostName) | ForEach-Object { $_.IPAddressToString }
  } catch {
    return @()
  }
}

function Test-IsFakeIpAddress {
  param([string]$Address)
  return $Address -match '^198\.18\.'
}

function Build-Stamp {
  return (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH-mm-ss")
}

function Get-ProviderSpec {
  param(
    [string]$CatalogPath,
    [string]$ProviderName,
    [string]$RequestedModel
  )

  $catalog = Read-JsonFile -Path $CatalogPath
  $entry = $catalog.PSObject.Properties[$ProviderName]
  if (-not $entry) {
    throw "Unknown image provider: $ProviderName"
  }

  $value = $entry.Value
  $defaultModel = [string]$value.defaultModel
  return [ordered]@{
    provider = $ProviderName
    apiStyle = [string]$value.apiStyle
    endpoint = [string]$value.endpoint
    requiredEnv = @($value.requiredEnv)
    envName = [string]$value.requiredEnv[0]
    defaultModel = $defaultModel
    dashScopeAsync = [string]$value.dashScopeAsync
    requestIdField = [string]$value.responseContract.requestIdField
    imageUrlField = [string]$value.responseContract.imageUrlField
    referenceHandling = $value.referenceHandling
    sizeByAspectRatio = $value.sizeByAspectRatio
    model = $(if ([string]::IsNullOrWhiteSpace($RequestedModel)) { $defaultModel } else { $RequestedModel })
  }
}

function Get-SizeForProvider {
  param(
    [hashtable]$ProviderSpec,
    [string]$AspectRatio
  )

  $mapping = $ProviderSpec.sizeByAspectRatio.PSObject.Properties[$AspectRatio]
  if ($mapping) {
    return [string]$mapping.Value
  }
  if ($ProviderSpec.apiStyle -eq 'dashscope-multimodal') {
    return '1024*1280'
  }
  return '1024x1536'
}

function Compose-Prompt {
  param(
    [object]$ImageRequest,
    [hashtable]$ProviderSpec
  )

  $positive = [string]($ImageRequest.promptPackage.positivePrompt)
  $negative = [string]($ImageRequest.promptPackage.negativePrompt)
  if ([string]::IsNullOrWhiteSpace($negative)) {
    return $positive
  }
  return "$positive`n`nAvoid: $negative"
}

function Build-ProviderRequestBody {
  param(
    [hashtable]$ProviderSpec,
    [string]$Prompt,
    [string]$Size,
    [string]$Quality,
    [string]$OutputFormat
  )

  if ($ProviderSpec.provider -eq 'aliyun-qwen-image') {
    return [ordered]@{
      model = $ProviderSpec.model
      input = [ordered]@{
        messages = @(
          [ordered]@{
            role = 'user'
            content = @(
              [ordered]@{ text = $Prompt }
            )
          }
        )
      }
      parameters = [ordered]@{
        n = 1
      }
    }
  }

  if ($ProviderSpec.provider -eq 'aliyun-z-image') {
    return [ordered]@{
      model = $ProviderSpec.model
      input = [ordered]@{
        messages = @(
          [ordered]@{
            role = 'user'
            content = @(
              [ordered]@{ text = $Prompt }
            )
          }
        )
      }
      parameters = [ordered]@{
        size = $Size
        prompt_extend = $false
        watermark = $false
      }
    }
  }

  $body = [ordered]@{
    model = $ProviderSpec.model
    prompt = $Prompt
    size = $Size
  }
  if ($ProviderSpec.provider -eq 'openai-images') {
    $body.output_format = $OutputFormat
    $body.quality = $Quality
  }
  return $body
}

function Build-FallbackBody {
  param(
    [hashtable]$ProviderSpec,
    [string]$Prompt,
    [string]$Size
  )

  if ($ProviderSpec.apiStyle -eq 'dashscope-multimodal') {
    return $null
  }

  return [ordered]@{
    model = $ProviderSpec.model
    prompt = $Prompt
    size = $Size
  }
}

function Build-ArtifactBase {
  param(
    [object]$ScenePlan,
    [object]$ImageRequest,
    [hashtable]$ProviderSpec,
    [string]$OutputFormat,
    [hashtable]$RequestBody
  )

  return [ordered]@{
    version = '2.0.0-alpha.1'
    createdAt = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    scenePlanRunId = $ScenePlan.runId
    sourceRequestCreatedAt = $ImageRequest.createdAt
    provider = $ProviderSpec.provider
    model = $ProviderSpec.model
    imageUrl = ''
    assetId = $null
    remoteJobId = $null
    providerRequestId = $null
    requestSummary = [ordered]@{
      generationMode = $ImageRequest.generationMode
      endpoint = $ProviderSpec.endpoint
      aspectRatio = $ImageRequest.renderPlan.aspectRatio
      candidateCount = $ImageRequest.renderPlan.candidateCount
      altText = $ImageRequest.publishHints.altText
      characterPresenceTarget = $ImageRequest.reviewSignals.characterPresenceTarget
      referenceIds = @($ImageRequest.references | ForEach-Object { $_.id })
      referenceHandling = [ordered]@{
        requestedReferenceCount = @($ImageRequest.references).Count
        unresolvedReferenceIds = @($ImageRequest.referencePlan.unresolvedReferenceIds)
        placeholderReferenceIds = @($ImageRequest.referencePlan.placeholderReferenceIds)
        providerCapability = [string]$ProviderSpec.referenceHandling.providerCapability
        hostTransport = [string]$ProviderSpec.referenceHandling.hostTransport
        deliveryMode = [string]$ProviderSpec.referenceHandling.deliveryMode
      }
      promptPackage = $ImageRequest.promptPackage
    }
    providerRequest = [ordered]@{
      provider = $ProviderSpec.provider
      endpoint = $ProviderSpec.endpoint
      submissionMode = 'host_executed_sync'
      requiredEnv = $ProviderSpec.requiredEnv
      model = $ProviderSpec.model
      assetFilenameHint = $null
      requestBody = $RequestBody
      responseContract = [ordered]@{
        jobIdField = $ProviderSpec.requestIdField
        requestIdField = $ProviderSpec.requestIdField
        imageUrlField = $ProviderSpec.imageUrlField
      }
    }
    notes = @()
    status = 'generation_scaffold_ready'
    outputFormat = $OutputFormat
    localFilePath = ''
    latestFilePath = ''
    failureReason = ''
  }
}

function Write-GeneratedArtifact {
  param(
    [string]$RuntimeDir,
    [object]$Artifact
  )
  $currentDir = Get-RuntimeCurrentDir -RuntimeDir $RuntimeDir
  $runDir = Join-Path (Get-RuntimeRunsDir -RuntimeDir $RuntimeDir) ('generatedimage-' + (Build-Stamp))
  Ensure-Dir $currentDir
  Ensure-Dir $runDir

  $currentPath = Join-Path $currentDir 'generated_image.json'
  $archivedPath = Join-Path $runDir 'generated_image.json'
  Write-JsonFile -Path $currentPath -Object $Artifact
  Write-JsonFile -Path $archivedPath -Object $Artifact
  return $currentPath
}

function Invoke-ProviderImageRequest {
  param(
    [string]$Endpoint,
    [hashtable]$Headers,
    [object]$Body
  )
  return Invoke-RestMethod -Uri $Endpoint -Headers $Headers -Method Post -Body ($Body | ConvertTo-Json -Depth 20) -TimeoutSec 180
}

function Get-HttpStatusFromError {
  param([object]$ErrorRecord)
  try {
    return $ErrorRecord.Exception.Response.StatusCode.value__
  } catch {
    return $null
  }
}

function Should-RetryProviderRequest {
  param(
    [object]$StatusCode,
    [int]$Attempt,
    [int]$MaxAttempts
  )

  if ($Attempt -ge $MaxAttempts) {
    return $false
  }

  if ($null -eq $StatusCode) {
    return $true
  }

  return ($StatusCode -eq 408 -or $StatusCode -eq 429 -or $StatusCode -ge 500)
}

function Invoke-ProviderImageRequestWithRetry {
  param(
    [string]$Endpoint,
    [hashtable]$Headers,
    [object]$Body,
    [string]$ProviderName,
    [string]$RequestLabel = 'primary',
    [int]$MaxAttempts = 3,
    [int]$BaseDelaySeconds = 2
  )

  for ($attempt = 1; $attempt -le $MaxAttempts; $attempt += 1) {
    try {
      $response = Invoke-ProviderImageRequest -Endpoint $Endpoint -Headers $Headers -Body $Body
      return [ordered]@{
        response = $response
        attemptCount = $attempt
      }
    } catch {
      $status = Get-HttpStatusFromError -ErrorRecord $_
      if (-not (Should-RetryProviderRequest -StatusCode $status -Attempt $attempt -MaxAttempts $MaxAttempts)) {
        throw
      }

      $statusLabel = if ($null -eq $status) { 'no_http_response' } else { "http_$status" }
      Write-Host "[v2] $ProviderName $RequestLabel attempt $attempt/$MaxAttempts hit $statusLabel, retrying..."
      Start-Sleep -Seconds ($BaseDelaySeconds * $attempt)
    }
  }

  throw "Retry loop ended unexpectedly for $RequestLabel request."
}

$runtimeDir = Join-Path $ProjectDir 'runtime'
$currentDir = Get-RuntimeCurrentDir -RuntimeDir $runtimeDir
$imageRequestPath = Join-Path $currentDir 'image_request.json'
$scenePlanPath = Join-Path $currentDir 'scene_plan.json'
$providerCatalogPath = Get-ProviderCatalogPath -BaseProjectDir $ProjectDir

$imageRequest = Read-JsonFile -Path $imageRequestPath
$scenePlan = Read-JsonFile -Path $scenePlanPath
$providerSpec = Get-ProviderSpec -CatalogPath $providerCatalogPath -ProviderName $Provider -RequestedModel $Model

$size = Get-SizeForProvider -ProviderSpec $providerSpec -AspectRatio $imageRequest.renderPlan.aspectRatio
$prompt = Compose-Prompt -ImageRequest $imageRequest -ProviderSpec $providerSpec
$primaryBody = Build-ProviderRequestBody -ProviderSpec $providerSpec -Prompt $prompt -Size $size -Quality $Quality -OutputFormat $OutputFormat
$fallbackBody = Build-FallbackBody -ProviderSpec $providerSpec -Prompt $prompt -Size $size
$artifact = Build-ArtifactBase -ScenePlan $scenePlan -ImageRequest $imageRequest -ProviderSpec $providerSpec -OutputFormat $OutputFormat -RequestBody $primaryBody

$apiKey = (Get-Item -Path ('Env:' + $providerSpec.envName) -ErrorAction SilentlyContinue).Value
$endpointHost = Get-EndpointHost -Url $providerSpec.endpoint
$resolvedAddresses = if ($endpointHost) { @(Resolve-HostAddresses -HostName $endpointHost) } else { @() }

if (-not $apiKey) {
  $artifact.status = 'provider_credentials_missing'
  $artifact.notes = @("Host $($providerSpec.envName) is missing, so image generation could not start.")
  if (@($imageRequest.references).Count -gt 0) {
    $artifact.notes += "Reference IDs were requested but this host path only records them as metadata; no executable reference asset was sent."
  }
  $artifact.failureReason = "$($providerSpec.envName)_missing"
  $currentPath = Write-GeneratedArtifact -RuntimeDir $runtimeDir -Artifact $artifact
  Write-Host "generated image artifact: $currentPath"
  Write-Host 'generated image status: provider_credentials_missing'
  exit 0
}

if ($resolvedAddresses | Where-Object { Test-IsFakeIpAddress -Address $_ }) {
  $artifact.status = 'provider_network_error'
  $artifact.notes = @(
    "$($providerSpec.provider) resolved to a fake IP address ($($resolvedAddresses -join ', ')). This usually means VPN/TUN fake-ip DNS is intercepting the provider domain before HTTPS can be established."
  )
  if (@($imageRequest.references).Count -gt 0) {
    $artifact.notes += "Reference IDs were requested but this host path only records them as metadata; no executable reference asset was sent."
  }
  $artifact.failureReason = 'fake_ip_dns_interference'
  $currentPath = Write-GeneratedArtifact -RuntimeDir $runtimeDir -Artifact $artifact
  Write-Host "generated image artifact: $currentPath"
  Write-Host 'generated image status: provider_network_error'
  exit 0
}

$headers = @{
  Authorization = "Bearer $apiKey"
  'Content-Type' = 'application/json'
}
if ($providerSpec.apiStyle -eq 'dashscope-multimodal' -and -not [string]::IsNullOrWhiteSpace($providerSpec.dashScopeAsync)) {
  $headers['X-DashScope-Async'] = $providerSpec.dashScopeAsync
}

try {
  $responseInfo = $null
  try {
    $responseInfo = Invoke-ProviderImageRequestWithRetry -Endpoint $providerSpec.endpoint -Headers $headers -Body $primaryBody -ProviderName $providerSpec.provider -RequestLabel 'primary'
    $response = $responseInfo.response
  } catch {
    $status = $null
    try { $status = $_.Exception.Response.StatusCode.value__ } catch {}
    if ($status -eq 400 -and $fallbackBody) {
      $responseInfo = Invoke-ProviderImageRequestWithRetry -Endpoint $providerSpec.endpoint -Headers $headers -Body $fallbackBody -ProviderName $providerSpec.provider -RequestLabel 'fallback'
      $response = $responseInfo.response
    } elseif ($status -eq 401) {
      $artifact.status = 'provider_auth_failed'
      $artifact.notes = @("$($providerSpec.provider) rejected the configured key for image generation.")
      $artifact.failureReason = "$($providerSpec.envName)_invalid"
      $currentPath = Write-GeneratedArtifact -RuntimeDir $runtimeDir -Artifact $artifact
      Write-Host "generated image artifact: $currentPath"
      Write-Host 'generated image status: provider_auth_failed'
      exit 0
    } elseif ($null -eq $status) {
      $artifact.status = 'provider_network_error'
      $artifact.notes = @("$($providerSpec.provider) request failed before an HTTP response was received. This usually points to TLS, proxy, VPN, or tunnel interference.")
      $artifact.failureReason = 'transport_error_no_http_response'
      $currentPath = Write-GeneratedArtifact -RuntimeDir $runtimeDir -Artifact $artifact
      Write-Host "generated image artifact: $currentPath"
      Write-Host 'generated image status: provider_network_error'
      exit 0
    } else {
      $artifact.status = 'provider_request_failed'
      $artifact.notes = @("$($providerSpec.provider) image request failed with HTTP $status.")
      $artifact.failureReason = "http_$status"
      $currentPath = Write-GeneratedArtifact -RuntimeDir $runtimeDir -Artifact $artifact
      Write-Host "generated image artifact: $currentPath"
      Write-Host 'generated image status: provider_request_failed'
      exit 0
    }
  }
} catch {
  $artifact.status = 'provider_network_error'
  $artifact.notes = @("Host could not reach the $($providerSpec.provider) image endpoint.")
  $artifact.failureReason = 'provider_network_error'
  $currentPath = Write-GeneratedArtifact -RuntimeDir $runtimeDir -Artifact $artifact
  Write-Host "generated image artifact: $currentPath"
  Write-Host 'generated image status: provider_network_error'
  exit 0
}

$item = $null
if ($providerSpec.apiStyle -eq 'dashscope-multimodal') {
  $content = $response.output.choices[0].message.content
  if ($content) {
    $item = $content | Where-Object { $_.image -or $_.url -or $_.b64_json } | Select-Object -First 1
  }
} else {
  $item = $response.data[0]
}
if (-not $item) {
  $artifact.status = 'provider_request_failed'
  $artifact.notes = @("$($providerSpec.provider) image API returned no image data.")
  $artifact.failureReason = 'empty_image_data'
  $currentPath = Write-GeneratedArtifact -RuntimeDir $runtimeDir -Artifact $artifact
  Write-Host "generated image artifact: $currentPath"
  Write-Host 'generated image status: provider_request_failed'
  exit 0
}

$generatedDir = Get-RuntimeGeneratedDir -RuntimeDir $runtimeDir
$historyDir = Join-Path $generatedDir 'history'
$latestDir = Join-Path $generatedDir 'current'
Ensure-Dir $historyDir
Ensure-Dir $latestDir

$extension = if ($OutputFormat -in @('jpg', 'jpeg')) { 'jpg' } elseif ($OutputFormat -eq 'webp') { 'webp' } else { 'png' }
$historyFile = Join-Path $historyDir ((Build-Stamp) + "-$($providerSpec.provider).$extension")
$latestFile = Join-Path $latestDir "latest-$($providerSpec.provider).$extension"

if ($item.b64_json) {
  [System.IO.File]::WriteAllBytes($historyFile, [Convert]::FromBase64String($item.b64_json))
  [System.IO.File]::WriteAllBytes($latestFile, [Convert]::FromBase64String($item.b64_json))
} elseif ($item.url -or $item.image) {
  $remoteUrl = if ($item.url) { $item.url } else { $item.image }
  Invoke-WebRequest -Uri $remoteUrl -OutFile $historyFile -TimeoutSec 180 | Out-Null
  Copy-Item $historyFile $latestFile -Force
} else {
  $artifact.status = 'provider_request_failed'
  $artifact.notes = @("$($providerSpec.provider) image API returned neither b64_json nor url.")
  $artifact.failureReason = 'missing_image_payload'
  $currentPath = Write-GeneratedArtifact -RuntimeDir $runtimeDir -Artifact $artifact
  Write-Host "generated image artifact: $currentPath"
  Write-Host 'generated image status: provider_request_failed'
  exit 0
}

$artifact.createdAt = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
$artifact.imageUrl = [string]$(if ($item.url) { $item.url } else { $item.image })
$artifact.providerRequestId = [string]$(if ($response.request_id) { $response.request_id } else { $response.id })
$artifact.providerRequest.assetFilenameHint = [System.IO.Path]::GetFileName($historyFile)
$artifact.notes = @("Host executor generated a real image file from the current image_request.json using $($providerSpec.provider).")
if (@($imageRequest.references).Count -gt 0) {
  $artifact.notes += "Reference IDs remained metadata-only during execution; manual identity review is still required."
}
if ($responseInfo -and $responseInfo.attemptCount -gt 1) {
  $artifact.notes += "The provider request succeeded after $($responseInfo.attemptCount) attempts."
}
$artifact.status = if ([string]::IsNullOrWhiteSpace($artifact.imageUrl)) { 'image_generated_local_only' } else { 'image_ready' }
$artifact.localFilePath = $historyFile
$artifact.latestFilePath = $latestFile
$artifact.failureReason = ''

$currentPath = Write-GeneratedArtifact -RuntimeDir $runtimeDir -Artifact $artifact
Write-Host "generated image artifact: $currentPath"
Write-Host "generated image status: $($artifact.status)"
Write-Host "generated image file: $historyFile"
