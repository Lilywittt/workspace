# ComfyUI Local Deployment / 本地 ComfyUI 部署说明

## Purpose / 目的

This guide covers the scripted deployment route for the local anime image provider.
本文说明本地 anime 生图 provider 的脚本化部署路线。

## Scripts / 脚本

- Setup: `tools/setup_comfyui_local.ps1`
- Start: `tools/start_comfyui_local.ps1`
- Health check: `tools/check_comfyui_local.ps1`
- Stop: `tools/stop_comfyui_local.ps1`

## Default Paths / 默认路径

If you do not pass custom paths, the scripts use workspace-root defaults:
如果不传自定义路径，脚本默认使用工作区根目录下的这些位置：

- ComfyUI repo: `F:\openclaw-dev\.local\ComfyUI`
- Python venv: `F:\openclaw-dev\.local\comfyui-env`
- logs: `F:\openclaw-dev\.local\logs\comfyui`
- pid file: `F:\openclaw-dev\.local\run\comfyui.pid.json`

## Prerequisites / 前置条件

- Windows PowerShell
- `git`
- `python`
- NVIDIA GPU with working CUDA driver is recommended
- a local checkpoint file such as `animagine-xl-4.0-opt.safetensors`

## One-Time Setup / 一次性初始化

Example with an existing checkpoint file:
如果你已经有 checkpoint 文件，初始化命令示例：

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\setup_comfyui_local.ps1 `
  -CheckpointPath 'D:\models\animagine-xl-4.0-opt.safetensors' `
  -CheckpointName 'animagine-xl-4.0-opt.safetensors'
```

What the setup script does:
初始化脚本会做的事：

1. clone ComfyUI if missing
2. create a dedicated Python virtual environment
3. upgrade `pip`
4. install PyTorch CUDA wheels
5. install ComfyUI requirements
6. optionally copy the checkpoint into `models/checkpoints/`

If the checkpoint is not copied during setup, place it manually before the first run.
如果 setup 阶段没有复制 checkpoint，请在首次出图前手动放到 `models/checkpoints/`。

## Start The Service / 启动服务

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\start_comfyui_local.ps1
```

The script waits for `/system_stats` to respond before returning.
脚本会等到 `/system_stats` 可访问后再返回。

Optional custom install example:
自定义安装目录示例：

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\start_comfyui_local.ps1 `
  -InstallRoot 'F:\openclaw-dev\.tmp\ComfyUI' `
  -VenvDir 'F:\openclaw-dev\.tmp\comfyui-env' `
  -LogDir 'F:\openclaw-dev\.tmp\comfyui-logs'
```

## Health Check / 健康检查

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\check_comfyui_local.ps1
```

Expected result:
期望结果：

- endpoint is reachable
- at least one device is reported

## Stop The Service / 停止服务

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\stop_comfyui_local.ps1
```

## Direct Image Smoke Test / 直接生图冒烟

After the service is healthy, you can run the image layer directly:
服务健康后，可以直接跑生图层：

```powershell
$env:IMAGE_PROVIDER = "comfyui-local-anime"
powershell -ExecutionPolicy Bypass -File .\tools\run_image_generation.ps1 -Provider comfyui-local-anime
```

Or use the direct Node entry:
或者直接跑 Node 入口：

```powershell
node .\scripts\run_image_generation.js --provider comfyui-local-anime
```

## Product Integration Check / 产品接线检查

Run the full product with the local provider:
用本地 provider 跑完整产品：

```powershell
powershell -ExecutionPolicy Bypass -File .\run_product.ps1 -Mode simulate -Provider comfyui-local-anime
```

Or via environment variable:
或者走环境变量：

```powershell
$env:IMAGE_PROVIDER = "comfyui-local-anime"
powershell -ExecutionPolicy Bypass -File .\run_product.ps1 -Mode simulate
```

## Logs / 日志

Default log files:

- `comfyui.stdout.log`
- `comfyui.stderr.log`

Use them first when:
出现这些情况时先看日志：

- service start succeeds but health check fails
- generation hangs while waiting for outputs
- a checkpoint name is wrong
- custom nodes or dependency imports fail

## Known Boundary / 当前边界

The local route is integrated into the product review bundle, but it still produces a local image file rather than a publishable public URL.
本地路线已经接进产品验收包，但当前仍产出本地图片文件，而不是可直接发布的公网 URL。

That means:

- `final_delivery.json` can point to the local file
- product review can continue normally
- publish remains blocked until an upload bridge exists
