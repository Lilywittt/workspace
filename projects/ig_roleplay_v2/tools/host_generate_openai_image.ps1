param(
  [string]$ProjectDir = "F:\openclaw-dev\workspace\projects\ig_roleplay_v2",
  [string]$ConfigPath = "",
  [ValidateSet("openai-images", "zhipu-images", "aliyun-qwen-image", "aliyun-z-image", "comfyui-local-anime")]
  [string]$Provider = "aliyun-z-image",
  [string]$Model = "",
  [string]$Quality = "medium",
  [string]$OutputFormat = "png"
)

$runnerScript = Join-Path $PSScriptRoot "run_image_generation.ps1"

& $runnerScript `
  -ProjectDir $ProjectDir `
  -ConfigPath $ConfigPath `
  -Provider $Provider `
  -Model $Model `
  -Quality $Quality `
  -OutputFormat $OutputFormat

exit $LASTEXITCODE
