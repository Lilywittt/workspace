import argparse
import json
import os
import subprocess
import sys
import textwrap
from datetime import datetime
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen


PROJECT_DIR = Path(r"F:\openclaw-dev\workspace\projects\ig_roleplay_v2")
POWERSHELL_EXE = Path(os.environ.get("SystemRoot", r"C:\Windows")) / "System32" / "WindowsPowerShell" / "v1.0" / "powershell.exe"


def now_stamp() -> str:
    return datetime.now().strftime("%Y-%m-%dT%H-%M-%S")


def log(message: str) -> None:
    print(f"[batch] {message}", flush=True)


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")


def load_provider_spec(project_dir: Path, provider_name: str) -> dict:
    catalog_path = project_dir / "config" / "provider_catalog.json"
    catalog = read_json(catalog_path)
    provider_spec = catalog.get(provider_name)
    if not provider_spec:
        raise RuntimeError(f"Unknown provider in catalog: {provider_name}")
    return provider_spec


def resolve_relative(base_file: Path, value: str) -> str:
    if not value:
        return value
    source = Path(value)
    if source.is_absolute():
        return str(source)
    return str((base_file.parent / source).resolve())


def to_portable_relative(target_file: Path, absolute_path: str) -> str:
    relative = os.path.relpath(absolute_path, start=target_file.parent)
    return relative.replace("\\", "/")


def rewrite_path_value(source_file: Path, target_file: Path, value: str) -> str:
    if not value:
        return value
    resolved = resolve_relative(source_file, value)
    return to_portable_relative(target_file, resolved)


def ensure_comfyui_ready(endpoint: str) -> None:
    try:
        with urlopen(f"{endpoint.rstrip('/')}/system_stats", timeout=15) as response:
            if response.status != 200:
                raise RuntimeError(f"ComfyUI health check failed with HTTP {response.status}")
    except URLError as error:
        raise RuntimeError(f"ComfyUI endpoint is not reachable: {endpoint}") from error


def ensure_container_running(container_name: str) -> None:
    result = subprocess.run(
        ["docker", "ps", "--format", "{{.Names}}"],
        capture_output=True,
        text=True,
        check=False,
    )
    names = [line.strip() for line in result.stdout.splitlines() if line.strip()]
    if container_name not in names:
        raise RuntimeError(f"Docker container is not running: {container_name}")


def build_runtime_config(project_dir: Path, target_path: Path):
    source_path = project_dir / "config" / "runtime.config.json"
    config = read_json(source_path)
    config["paths"]["runtimeDir"] = "./runtime"
    for key, value in list(config.get("paths", {}).items()):
        if key == "runtimeDir":
            continue
        if isinstance(value, str) and value.strip():
            config["paths"][key] = rewrite_path_value(source_path, target_path, value)
    write_json(target_path, config)


def build_agent_config(project_dir: Path, target_path: Path):
    source_path = project_dir / "config" / "runtime" / "agent_runtime.config.json"
    config = read_json(source_path)
    path_block = config.get("paths", {})
    for key, value in list(path_block.items()):
        if key in {"runtimeDir", "signalCollectionConfigPath"}:
            continue
        if isinstance(value, str) and value.strip():
            path_block[key] = rewrite_path_value(source_path, target_path, value)
    path_block["runtimeDir"] = "./runtime"
    path_block["signalCollectionConfigPath"] = "./signal_collection.config.json"
    write_json(target_path, config)


def build_signal_config(project_dir: Path, target_path: Path):
    source_path = project_dir / "config" / "runtime" / "signal_collection.config.json"
    config = read_json(source_path)
    path_block = config.get("paths", {})
    for key, value in list(path_block.items()):
        if key in {"outputSignalsPath", "outputReportPath"}:
            continue
        if isinstance(value, str) and value.strip():
            path_block[key] = rewrite_path_value(source_path, target_path, value)
    path_block["outputSignalsPath"] = "./signals.json"
    path_block["outputReportPath"] = "./signal_collection_report.json"
    write_json(target_path, config)


def extract_prompt_snapshot(generated_image: dict) -> dict:
    prompt = (((generated_image or {}).get("providerRequest") or {}).get("requestBody") or {}).get("prompt") or {}
    return {
        "checkpointName": (((prompt.get("3") or {}).get("inputs") or {}).get("ckpt_name") or ""),
        "positivePrompt": (((prompt.get("6") or {}).get("inputs") or {}).get("text") or ""),
        "negativePrompt": (((prompt.get("7") or {}).get("inputs") or {}).get("text") or ""),
        "filenamePrefix": (((prompt.get("9") or {}).get("inputs") or {}).get("filename_prefix") or ""),
    }


def collect_run_summary(run_root: Path, run_index: int) -> dict:
    runtime_root = run_root / "runtime"
    intermediate_current = runtime_root / "intermediate" / "current"
    final_current = runtime_root / "final" / "current"

    scene_plan = read_json(intermediate_current / "scene_plan.json")
    image_request = read_json(intermediate_current / "image_request.json")
    generated_image = read_json(intermediate_current / "generated_image.json")
    final_delivery = read_json(final_current / "final_delivery.json")
    run_summary = read_json(intermediate_current / "run_summary.json")

    return {
        "runIndex": run_index,
        "runRoot": str(run_root),
        "runtimeRoot": str(runtime_root),
        "finalCurrentDir": str(final_current),
        "intermediateCurrentDir": str(intermediate_current),
        "scenePlanRunId": scene_plan.get("runId"),
        "scenePremise": scene_plan.get("narrative", {}).get("premise", ""),
        "selectedLane": scene_plan.get("lane", ""),
        "imageStatus": generated_image.get("status", ""),
        "generatedLocalFilePath": generated_image.get("localFilePath", ""),
        "finalImagePath": final_delivery.get("image", {}).get("localFilePath", ""),
        "finalDeliveryPath": str(final_current / "final_delivery.json"),
        "generatedImagePath": str(intermediate_current / "generated_image.json"),
        "reviewGuidePath": str(final_current / "review_guide.txt"),
        "captionTextPath": str(final_current / "caption.txt"),
        "releaseReadiness": final_delivery.get("deliveryReadiness", {}),
        "promptSnapshot": extract_prompt_snapshot(generated_image),
        "renderSummary": image_request.get("reviewSignals", {}).get("renderStyleSummaryEn", ""),
        "captureSummary": image_request.get("reviewSignals", {}).get("captureSummaryEn", ""),
        "altText": image_request.get("publishHints", {}).get("altText", ""),
        "publishStatus": run_summary.get("release", {}).get("publishStatus", ""),
    }


def write_batch_report(batch_root: Path, runs: list[dict]) -> None:
    summary = {
        "createdAt": datetime.now().isoformat(timespec="seconds"),
        "runCount": len(runs),
        "runs": runs,
    }
    write_json(batch_root / "batch_summary.json", summary)

    lines = [
        "# Product Fullchain Batch Report",
        "",
        f"- Created at: `{summary['createdAt']}`",
        f"- Run count: `{summary['runCount']}`",
        "",
        "## Runs",
        "",
    ]
    for run in runs:
        lines.extend([
            f"### Run {run['runIndex']:02d}",
            "",
            f"- runRoot: `{run['runRoot']}`",
            f"- scenePlanRunId: `{run['scenePlanRunId']}`",
            f"- lane: `{run['selectedLane']}`",
            f"- imageStatus: `{run['imageStatus']}`",
            f"- publishStatus: `{run['publishStatus']}`",
            f"- finalImagePath: `{run['finalImagePath']}`",
            f"- finalDeliveryPath: `{run['finalDeliveryPath']}`",
            f"- scenePremise: {run['scenePremise']}",
            "",
            "Positive prompt:",
            "```text",
            run["promptSnapshot"]["positivePrompt"],
            "```",
            "",
            "Negative prompt:",
            "```text",
            run["promptSnapshot"]["negativePrompt"],
            "```",
            "",
        ])

    (batch_root / "report.md").write_text("\n".join(lines), encoding="utf-8")


def run_once(project_dir: Path, run_root: Path, args, run_index: int) -> dict:
    runtime_config_path = run_root / "runtime.config.json"
    agent_config_path = run_root / "agent_runtime.config.json"
    signal_config_path = run_root / "signal_collection.config.json"
    stdout_path = run_root / "run_product.stdout.log"
    stderr_path = run_root / "run_product.stderr.log"

    build_runtime_config(project_dir, runtime_config_path)
    build_agent_config(project_dir, agent_config_path)
    build_signal_config(project_dir, signal_config_path)

    command = [
        str(POWERSHELL_EXE),
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        str(project_dir / "run_product.ps1"),
        "-Mode",
        args.mode,
        "-Provider",
        args.provider,
        "-RuntimeConfigPath",
        str(runtime_config_path),
        "-AgentConfigPath",
        str(agent_config_path),
        "-Container",
        args.container,
    ]
    if args.resolved_model:
        command.extend(["-Model", args.resolved_model])

    log(f"Run {run_index:02d}: starting fullchain product run")
    result = subprocess.run(
        command,
        cwd=project_dir,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=args.timeout_sec,
        check=False,
    )
    stdout_path.write_text(result.stdout or "", encoding="utf-8")
    stderr_path.write_text(result.stderr or "", encoding="utf-8")
    if result.returncode != 0:
        raise RuntimeError(
            textwrap.dedent(
                f"""
                Run {run_index:02d} failed with exit code {result.returncode}.
                STDOUT log: {stdout_path}
                STDERR log: {stderr_path}
                """
            ).strip()
        )

    summary = collect_run_summary(run_root, run_index)
    if summary["imageStatus"] not in {"image_ready", "image_generated_local_only"}:
        raise RuntimeError(
            f"Run {run_index:02d} completed without a usable image. "
            f"imageStatus={summary['imageStatus']} generatedImage={summary['generatedImagePath']}"
        )
    if not summary["generatedLocalFilePath"]:
        raise RuntimeError(
            f"Run {run_index:02d} did not record a local generated image file. "
            f"generatedImage={summary['generatedImagePath']}"
        )
    write_json(run_root / "run_summary.compact.json", summary)
    log(f"Run {run_index:02d}: done -> {summary['generatedLocalFilePath']}")
    return summary


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=3)
    parser.add_argument("--mode", default="simulate", choices=["simulate", "publish"])
    parser.add_argument("--provider", default="comfyui-local-anime")
    parser.add_argument("--model", default="")
    parser.add_argument("--container", default="openclaw-dev-agent")
    parser.add_argument("--project-dir", default=str(PROJECT_DIR))
    parser.add_argument("--output-root", default="")
    parser.add_argument("--comfyui-endpoint", default="http://127.0.0.1:8188")
    parser.add_argument("--timeout-sec", type=int, default=1800)
    args = parser.parse_args()

    project_dir = Path(args.project_dir).resolve()
    provider_spec = load_provider_spec(project_dir, args.provider)
    args.resolved_model = args.model or provider_spec.get("defaultModel", "")
    batch_root = Path(args.output_root).resolve() if args.output_root else (
        project_dir / "eval" / "runs" / f"fullchain_{args.provider}_{now_stamp()}"
    )
    batch_root.mkdir(parents=True, exist_ok=True)

    ensure_container_running(args.container)
    ensure_comfyui_ready(args.comfyui_endpoint)

    runs = []
    for run_index in range(1, args.count + 1):
        run_root = batch_root / "runs" / f"run_{run_index:02d}"
        run_root.mkdir(parents=True, exist_ok=True)
        summary = run_once(project_dir, run_root, args, run_index)
        runs.append(summary)

    write_batch_report(batch_root, runs)
    log(f"Batch complete: {batch_root}")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"[batch] ERROR: {error}", file=sys.stderr)
        sys.exit(1)
