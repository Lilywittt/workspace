# Local Image Generation User Manual / 本地生图使用手册

## Who This Is For / 适用对象

This manual is for operators who just want to run the product with the local anime image route.
这份手册给“只想把产品跑起来并看到本地图”的使用者。

## Quick Start / 快速开始

### 1. Prepare ComfyUI once / 先准备一次 ComfyUI

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\setup_comfyui_local.ps1 `
  -CheckpointPath 'D:\models\animagine-xl-4.0-opt.safetensors'
```

### 2. Start ComfyUI / 启动 ComfyUI

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\start_comfyui_local.ps1
```

### 3. Confirm it is healthy / 确认服务正常

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\check_comfyui_local.ps1
```

### 4. Run the product / 跑产品

Preferred explicit command:
推荐显式命令：

```powershell
powershell -ExecutionPolicy Bypass -File .\run_product.ps1 -Mode simulate -Provider comfyui-local-anime
```

You can also set the environment variable once for the current shell:
也可以先给当前 shell 设环境变量：

```powershell
$env:IMAGE_PROVIDER = "comfyui-local-anime"
powershell -ExecutionPolicy Bypass -File .\run_product.ps1 -Mode simulate
```

## Where To Review / 去哪里看结果

Product-facing acceptance directory:
产品验收目录：

- `runtime/final/current/`

Open in this order:
建议按这个顺序看：

1. `runtime/final/current/review_guide.txt`
2. `runtime/final/current/final_delivery.json`
3. `runtime/final/current/caption.txt`
4. `runtime/final/current/<final-image>`

## Direct Image-Only Run / 只跑生图层

If the upstream chain is already prepared and you only want to regenerate the image:
如果上游链已经准备好，只想重跑图片：

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\run_image_generation.ps1 -Provider comfyui-local-anime
```

This command reads:
它会读取：

- `runtime/intermediate/current/scene_plan.json`
- `runtime/intermediate/current/image_request.json`

And writes:
并写出：

- `runtime/intermediate/current/generated_image.json`
- `runtime/intermediate/runs/<runId>/generated_assets/...`

## What Success Looks Like / 成功时会看到什么

- terminal shows `generated image status: image_generated_local_only`
- `generated_image.json` points to a real local file
- `runtime/final/current/` contains the copied final image after a full product run

`image_generated_local_only` is expected for the current local route.
当前本地路线出现 `image_generated_local_only` 是正常的。

It means:

- the image file is real
- the product review bundle is usable
- the route still has no public upload bridge

## Common Problems / 常见问题

### `provider_request_failed`

Check:

- ComfyUI is actually running
- the checkpoint file exists and its name matches the provider/profile config
- `comfyui.stderr.log` for startup or node errors

### `provider_network_error`

Check:

- `tools/check_comfyui_local.ps1`
- local firewall or port occupancy
- whether ComfyUI is bound to the expected endpoint

### Product run finishes but publish is blocked

This is expected if the image only exists locally.
如果图片只有本地文件、没有公网 URL，这是当前预期行为。

Review can continue, but final publishing still needs an upload bridge.
验收可以继续，但最终发布仍需要上传桥接。

## Shutdown / 关闭服务

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\stop_comfyui_local.ps1
```
