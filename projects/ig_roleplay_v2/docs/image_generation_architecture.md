# Image Generation Architecture / 生图架构说明

## Scope / 范围

This document describes the image-generation layer that is now wired into the active product pipeline.
本文描述当前已经接入产品主链的生图层实现。

## Active Entry Points / 当前入口

- Product pipeline: `run_product.ps1`
- Host image wrapper: `tools/run_image_generation.ps1`
- Legacy compatibility wrapper: `tools/host_generate_openai_image.ps1`
- Direct Node runner: `scripts/run_image_generation.js`
- ComfyUI-only shortcut: `scripts/run_comfyui_workflow.js`

`run_product.ps1` now calls only one host-side image entry: `tools/run_image_generation.ps1`.
`run_product.ps1` 现在只调用一个宿主机生图入口：`tools/run_image_generation.ps1`。

## Layer Split / 分层

### 1. Provider catalog / Provider 编目

Source:

- `config/provider_catalog.json`

Responsibilities:

- define provider name, endpoint, auth env, default model
- define transport style: hosted API vs local ComfyUI workflow
- define aspect-ratio size mapping
- point workflow providers to a render profile

### 2. Shared generation runtime / 通用生成运行层

Source:

- `scripts/lib/image_generation.js`

Responsibilities:

- load `scene_plan.json` and `image_request.json`
- normalize provider request bodies
- build `generated_image.json`
- manage generated asset paths under `runtime/intermediate/runs/<runId>/generated_assets/`
- keep hosted providers and local providers on the same artifact contract

### 3. ComfyUI workflow adapter / ComfyUI 工作流适配层

Sources:

- `scripts/lib/comfyui_workflow.js`
- `scripts/lib/comfyui_client.js`
- `config/render/comfyui_anime_engineering_profile.json`
- `config/workflows/comfyui/anime_engineering_api.workflow.json`

Responsibilities:

- load the workflow profile and API template
- translate verbose upstream prompt blocks into diffusion-friendly anime tags
- inject checkpoint, size, seed, sampler settings, and filename prefix
- submit workflow, poll history, and download local outputs

### 4. Thin PowerShell shell / 薄 PowerShell 壳

Sources:

- `tools/run_image_generation.ps1`
- `tools/host_generate_openai_image.ps1`

Responsibilities:

- import workspace `.env`
- forward product parameters into the Node runner
- keep the Windows product entry stable

## Provider Modes / Provider 模式

### Hosted providers

Current examples:

- `openai-images`
- `zhipu-images`
- `aliyun-qwen-image`
- `aliyun-z-image`

Behavior:

- send one hosted request
- download b64 or remote image payload
- write `generated_image.json`
- if no public URL is returned, the artifact remains `image_generated_local_only`

### Local workflow provider

Current example:

- `comfyui-local-anime`

Behavior:

- build a ComfyUI workflow payload from `image_request.json`
- submit to local ComfyUI
- wait for history outputs
- download the saved image into runtime assets
- write `generated_image.json` with `status: image_generated_local_only`

## Prompt Path / Prompt 路径

Upstream prompt semantics are still owned by the product chain.
上游 prompt 语义仍然由产品链负责。

Current path:

`selected_moment -> moment_package -> image_intent -> scene_plan -> image_request -> image runner`

Important rule:

- hosted prose prompts are not sent unchanged into anime diffusion checkpoints
- local anime workflows first condense them into short tag prompts

This avoids the earlier failure mode where a long hosted-model prose prompt produced abstract or mosaic-like output in local SDXL anime generation.
这避免了之前那种情况：面向 hosted 模型写的长 prose prompt 直接喂给本地 SDXL anime checkpoint，最后出抽象块或马赛克。

## Runtime Contract / Runtime 契约

The image layer writes:

- `runtime/intermediate/current/generated_image.json`
- `runtime/intermediate/runs/<runId>/generated_image.json`
- `runtime/intermediate/runs/<runId>/generated_assets/<timestamp>-<provider>.<ext>`

Downstream consumers:

- `scripts/build_post_package.js`
- `scripts/build_final_delivery.js`
- `scripts/publish_post_package.js`

This means the local ComfyUI route is already part of the normal product review bundle.
这意味着本地 ComfyUI 路线已经进入正常产品验收包，不再是独立实验链。

## Deployment Scripts / 部署脚本

Local ComfyUI lifecycle is scriptized with:

- `tools/setup_comfyui_local.ps1`
- `tools/start_comfyui_local.ps1`
- `tools/check_comfyui_local.ps1`
- `tools/stop_comfyui_local.ps1`

The scripts intentionally separate:

- one-time install and dependency setup
- service start and readiness wait
- health check
- service shutdown

## Extension Rules / 扩展规则

When adding a new image backend:

1. add the provider entry in `config/provider_catalog.json`
2. reuse `scripts/run_image_generation.js` unless the transport is genuinely new
3. keep the output artifact contract identical
4. keep `run_product.ps1` unchanged whenever possible

When upgrading the local anime route:

- prefer editing the workflow profile and template first
- only add runner logic when the transport itself changes
- keep prompt adaptation explicit and testable
