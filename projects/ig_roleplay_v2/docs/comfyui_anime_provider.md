# ComfyUI Anime Provider / ComfyUI Anime Provider 概览

The project now includes a first-class local image provider:
项目现在包含一个正式接入的本地生图 provider：

- `comfyui-local-anime`

## What It Means / 这意味着什么

- the normal product pipeline can generate a real local anime image through ComfyUI
- the provider is selected from `config/provider_catalog.json`
- the same `generated_image.json -> post_package.json -> final_delivery.json` contract is preserved

## Current Files / 关键文件

- Provider catalog: `config/provider_catalog.json`
- Workflow profile: `config/render/comfyui_anime_engineering_profile.json`
- Workflow template: `config/workflows/comfyui/anime_engineering_api.workflow.json`
- Shared runner: `scripts/run_image_generation.js`
- PowerShell wrapper: `tools/run_image_generation.ps1`

## Related Docs / 相关文档

- Architecture: `docs/image_generation_architecture.md`
- Deployment: `docs/comfyui_local_deployment.md`
- User manual: `docs/local_image_generation_user_manual.md`

## Fastest Commands / 最快命令

Run the product with the local provider:

```powershell
powershell -ExecutionPolicy Bypass -File .\run_product.ps1 -Mode simulate -Provider comfyui-local-anime
```

Run only the image layer:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\run_image_generation.ps1 -Provider comfyui-local-anime
```
