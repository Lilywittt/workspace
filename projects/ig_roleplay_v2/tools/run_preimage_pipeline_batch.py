import argparse
import hashlib
import json
import shutil
import subprocess
import time
from collections import Counter
from datetime import datetime
from pathlib import Path


PROJECT_DIR = Path(r"F:\openclaw-dev\workspace\projects\ig_roleplay_v2")
CONTAINER = "openclaw-dev-agent"
CONTAINER_PROJECT_DIR = "/home/node/.openclaw/workspace/projects/ig_roleplay_v2"

PREIMAGE_COMMANDS = [
    "node scripts/build_continuity_snapshot.js",
    "node scripts/build_novelty_ledger.js",
    "node scripts/build_reflection_notes.js",
    "node scripts/build_world_state_snapshot.js",
    "node scripts/build_affordance_pool.js",
    "node scripts/build_world_graph_snapshot.js",
    "node scripts/build_continuity_creative_review.js",
    "node scripts/build_activation_map.js",
    "node scripts/build_situation_hypotheses_ai.js",
    "node scripts/validate_situation_hypotheses.js",
    "node scripts/build_semantic_repeat_critic.js",
    "node scripts/build_scene_plan_candidates.js",
    "node scripts/select_scene_plan_candidate.js",
    "node scripts/build_program_instance_ai.js",
    "node scripts/build_scene_plan_draft.js",
    "node scripts/build_scene_plan.js",
    "node scripts/build_caption_brief_draft.js",
    "node scripts/build_caption_brief.js",
    "node scripts/build_caption_candidates_ai.js",
    "node scripts/build_caption_candidates.js",
    "node scripts/build_caption_selection_review.js",
    "node scripts/select_caption_candidate.js",
    "node scripts/build_image_brief.js",
    "node scripts/build_image_request.js",
    "node scripts/validate_creative_intelligence.js",
]

ARTIFACT_NAMES = [
    "continuity_snapshot.json",
    "novelty_ledger.json",
    "reflection_notes.json",
    "world_state_snapshot.json",
    "affordance_pool.json",
    "world_graph_snapshot.json",
    "continuity_creative_review.json",
    "activation_map.json",
    "situation_hypotheses_ai.json",
    "validated_situation_hypotheses.json",
    "semantic_repeat_critic.json",
    "scene_plan_candidates.json",
    "selected_scene_candidate.json",
    "program_instance_ai.json",
    "scene_plan_draft.json",
    "scene_plan.json",
    "caption_brief_draft.json",
    "caption_brief.json",
    "caption_candidates_ai.json",
    "caption_candidates.json",
    "caption_selection_review.json",
    "selected_caption.json",
    "image_brief.json",
    "image_request.json",
    "creative_intelligence_validation.json",
]


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def timestamp() -> str:
    return datetime.now().strftime("%H:%M:%S")


def emit_progress(message: str) -> None:
    print(f"[{timestamp()}] {message}", flush=True)


def write_progress_snapshot(output_dir: Path, runs) -> None:
    snapshot = {
        "completedRunCount": len(runs),
        "lastUpdatedAt": datetime.now().isoformat(timespec="seconds"),
        "analysis": analyze_runs(runs) if runs else {},
        "runs": runs,
    }
    (output_dir / "batch_progress.json").write_text(
        json.dumps(snapshot, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def run_container_command(command: str, timeout_sec: int) -> None:
    try:
        result = subprocess.run(
            ["docker", "exec", CONTAINER, "sh", "-lc", f"cd {CONTAINER_PROJECT_DIR} && {command}"],
            capture_output=True,
            text=True,
            timeout=timeout_sec,
        )
    except subprocess.TimeoutExpired as error:
        raise RuntimeError(
            f"Command timed out after {timeout_sec}s: {command}\n"
            f"STDOUT:\n{error.stdout or ''}\nSTDERR:\n{error.stderr or ''}"
        ) from error
    if result.returncode != 0:
        raise RuntimeError(
            f"Command failed: {command}\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
        )


def copy_artifacts(current_dir: Path, target_dir: Path) -> None:
    ensure_dir(target_dir)
    for artifact_name in ARTIFACT_NAMES:
        source = current_dir / artifact_name
        if source.exists():
            shutil.copy2(source, target_dir / artifact_name)


def first_line(text: str) -> str:
    for line in str(text or "").splitlines():
        line = line.strip()
        if line:
            return line
    return ""


def shorten(text: str, limit: int = 120) -> str:
    value = " ".join(str(text or "").split())
    if len(value) <= limit:
        return value
    return value[: limit - 3] + "..."


def signature_of(value: str) -> str:
    return hashlib.sha1(str(value or "").encode("utf-8")).hexdigest()[:12]


def collect_run_summary(current_dir: Path, run_index: int):
    continuity_snapshot = read_json(current_dir / "continuity_snapshot.json")
    novelty_ledger = read_json(current_dir / "novelty_ledger.json")
    reflection_notes = read_json(current_dir / "reflection_notes.json")
    world_state = read_json(current_dir / "world_state_snapshot.json")
    affordance_pool = read_json(current_dir / "affordance_pool.json")
    continuity_review = read_json(current_dir / "continuity_creative_review.json")
    world_graph = read_json(current_dir / "world_graph_snapshot.json")
    activation_map = read_json(current_dir / "activation_map.json")
    situation_hypotheses = read_json(current_dir / "situation_hypotheses_ai.json")
    validated_situation_hypotheses = read_json(current_dir / "validated_situation_hypotheses.json")
    semantic_repeat_critic = read_json(current_dir / "semantic_repeat_critic.json")
    scene_candidates = read_json(current_dir / "scene_plan_candidates.json")
    selected_scene_candidate = read_json(current_dir / "selected_scene_candidate.json")
    program_instance = read_json(current_dir / "program_instance_ai.json")
    scene_plan_draft = read_json(current_dir / "scene_plan_draft.json")
    scene_plan = read_json(current_dir / "scene_plan.json")
    caption_brief = read_json(current_dir / "caption_brief.json")
    selected_caption = read_json(current_dir / "selected_caption.json")
    image_brief = read_json(current_dir / "image_brief.json")
    image_request = read_json(current_dir / "image_request.json")
    validation = read_json(current_dir / "creative_intelligence_validation.json")

    summary = {
        "runIndex": run_index,
        "scenePlanRunId": scene_plan.get("runId"),
        "continuity": {
            "preferredLane": continuity_snapshot.get("recommendation", {}).get("preferredLane"),
            "reason": continuity_snapshot.get("recommendation", {}).get("reason"),
            "sceneFatigue": continuity_snapshot.get("recommendation", {}).get("sceneFatigue", []),
        },
        "noveltyLedger": {
            "scenePrograms": novelty_ledger.get("counts", {}).get("sceneProgramId", [])[:4],
            "locations": novelty_ledger.get("counts", {}).get("locationArchetype", [])[:4],
            "objectFamilies": novelty_ledger.get("counts", {}).get("objectFamily", [])[:4],
            "fatigueFlags": novelty_ledger.get("fatigueFlags", {}),
        },
        "reflectionNotes": {
            "recurringObjects": reflection_notes.get("recurringObjects", []),
            "familiarPlaces": reflection_notes.get("familiarPlaces", []),
            "fatiguePatterns": reflection_notes.get("fatiguePatterns", []),
        },
        "worldState": {
            "daypart": world_state.get("timeContext", {}).get("daypart"),
            "weekdayMode": world_state.get("timeContext", {}).get("weekdayMode"),
            "seasonPhase": world_state.get("timeContext", {}).get("seasonPhase"),
            "mobilityWindow": world_state.get("environment", {}).get("mobilityWindow"),
            "needState": world_state.get("characterState", {}).get("needState", []),
            "preferredLane": world_state.get("characterState", {}).get("lanePreference"),
        },
        "affordancePool": {
            "primaryAffordanceIds": affordance_pool.get("primaryAffordanceIds", []),
            "topAffordances": affordance_pool.get("affordances", [])[:4],
        },
        "activationMap": {
            "seedCount": len(activation_map.get("activatedSeeds", [])),
            "topSeedPrograms": [seed.get("sceneProgramId") for seed in activation_map.get("activatedSeeds", [])[:4]],
        },
        "situationHypotheses": {
            "source": situation_hypotheses.get("source"),
            "count": situation_hypotheses.get("hypothesisCount"),
            "validatedCount": validated_situation_hypotheses.get("acceptedCount"),
        },
        "semanticRepeatCritic": {
            "source": semantic_repeat_critic.get("source"),
            "summary": semantic_repeat_critic.get("summary"),
        },
        "sceneCandidates": {
            "count": scene_candidates.get("candidateCount"),
            "topCandidateIds": [candidate.get("candidateId") for candidate in scene_candidates.get("candidates", [])[:5]],
            "programs": [candidate.get("sceneProgramId") for candidate in scene_candidates.get("candidates", [])[:5]],
        },
        "selectedSceneCandidate": {
            "selectedCandidateId": selected_scene_candidate.get("selectedCandidateId"),
            "sceneProgramId": selected_scene_candidate.get("selectedCandidate", {}).get("sceneProgramId"),
            "locationArchetype": selected_scene_candidate.get("selectedCandidate", {}).get("locationArchetype"),
            "objectFamily": selected_scene_candidate.get("selectedCandidate", {}).get("objectFamily"),
            "objectBindings": selected_scene_candidate.get("selectedCandidate", {}).get("objectBindings", []),
            "weatherRole": selected_scene_candidate.get("selectedCandidate", {}).get("weatherRole"),
            "emotionalLanding": selected_scene_candidate.get("selectedCandidate", {}).get("emotionalLanding"),
        },
        "programInstance": {
            "dynamicProgramName": program_instance.get("dynamicProgramName"),
            "microTension": program_instance.get("microTension"),
        },
        "scenePlanDraft": {
            "premise": scene_plan_draft.get("narrativePremise"),
            "microPlot": scene_plan_draft.get("microPlot", []),
        },
        "scenePlan": {
            "lane": scene_plan.get("lane"),
            "presenceMode": scene_plan.get("visual", {}).get("presenceMode"),
            "sceneProgramId": scene_plan.get("sceneSemantics", {}).get("sceneProgramId"),
            "locationArchetype": scene_plan.get("sceneSemantics", {}).get("locationArchetype"),
            "objectFamily": scene_plan.get("sceneSemantics", {}).get("objectFamily"),
            "emotionalLanding": scene_plan.get("sceneSemantics", {}).get("emotionalLanding"),
            "premise": scene_plan.get("narrative", {}).get("premise"),
        },
        "captionBrief": {
            "goal": caption_brief.get("goal"),
            "sceneProgramId": caption_brief.get("contentBlocks", {}).get("sceneSemantics", {}).get("sceneProgramId"),
        },
        "selectedCaption": {
            "candidateAngle": selected_caption.get("candidateAngle"),
            "caption": selected_caption.get("caption"),
        },
        "imageBrief": {
            "sceneProgramId": image_brief.get("semanticBindings", {}).get("sceneProgramId"),
            "locationArchetype": image_brief.get("semanticBindings", {}).get("locationArchetype"),
        },
        "imageRequest": {
            "sceneProgramId": image_request.get("sceneSemantics", {}).get("sceneProgramId"),
            "scene": image_request.get("promptPackage", {}).get("promptBlocks", {}).get("scene"),
            "camera": image_request.get("promptPackage", {}).get("promptBlocks", {}).get("camera"),
            "mood": image_request.get("promptPackage", {}).get("promptBlocks", {}).get("mood"),
        },
        "validation": {
            "status": validation.get("status"),
            "passedChecks": validation.get("summary", {}).get("passedChecks"),
            "warningCount": validation.get("summary", {}).get("warningCount"),
            "errorCount": validation.get("summary", {}).get("errorCount"),
        },
    }

    summary["_signatures"] = {
        "premise": signature_of(scene_plan.get("narrative", {}).get("premise")),
        "sceneProgram": signature_of(scene_plan.get("sceneSemantics", {}).get("sceneProgramId")),
        "locationArchetype": signature_of(scene_plan.get("sceneSemantics", {}).get("locationArchetype")),
        "objectFamily": signature_of(scene_plan.get("sceneSemantics", {}).get("objectFamily")),
        "selectedCaption": signature_of(selected_caption.get("caption")),
        "imageScene": signature_of(image_request.get("promptPackage", {}).get("promptBlocks", {}).get("scene")),
    }
    return summary


def analyze_runs(runs):
    program_counter = Counter(run["scenePlan"]["sceneProgramId"] for run in runs)
    location_counter = Counter(run["scenePlan"]["locationArchetype"] for run in runs)
    object_counter = Counter(run["scenePlan"]["objectFamily"] for run in runs)
    landing_counter = Counter(run["scenePlan"]["emotionalLanding"] for run in runs)
    affordance_counter = Counter()
    for run in runs:
        affordance_counter.update(run["affordancePool"]["primaryAffordanceIds"])

    return {
        "runCount": len(runs),
        "laneCounts": dict(Counter(run["scenePlan"]["lane"] for run in runs)),
        "presenceModeCounts": dict(Counter(run["scenePlan"]["presenceMode"] for run in runs)),
        "sceneProgramCounts": dict(program_counter),
        "locationArchetypeCounts": dict(location_counter),
        "objectFamilyCounts": dict(object_counter),
        "emotionalLandingCounts": dict(landing_counter),
        "affordanceCounts": dict(affordance_counter),
        "uniquePremiseCount": len(set(run["_signatures"]["premise"] for run in runs)),
        "uniqueSceneProgramCount": len(set(run["_signatures"]["sceneProgram"] for run in runs)),
        "uniqueLocationArchetypeCount": len(set(run["_signatures"]["locationArchetype"] for run in runs)),
        "uniqueObjectFamilyCount": len(set(run["_signatures"]["objectFamily"] for run in runs)),
        "uniqueSelectedCaptionCount": len(set(run["_signatures"]["selectedCaption"] for run in runs)),
        "uniqueImageSceneCount": len(set(run["_signatures"]["imageScene"] for run in runs)),
        "allCreativeValidationReady": all(run["validation"]["status"] == "creative_intelligence_ready" for run in runs),
    }


def write_markdown_report(output_dir: Path, runs, analysis):
    lines = [
        "# Pre-image Pipeline Batch Report",
        "",
        f"- Generated at: `{datetime.now().isoformat(timespec='seconds')}`",
        f"- Run count: `{analysis['runCount']}`",
        f"- All creative validations ready: `{analysis['allCreativeValidationReady']}`",
        "",
        "## Aggregate",
        "",
        f"- Lane counts: `{json.dumps(analysis['laneCounts'], ensure_ascii=False)}`",
        f"- Presence mode counts: `{json.dumps(analysis['presenceModeCounts'], ensure_ascii=False)}`",
        f"- Scene program counts: `{json.dumps(analysis['sceneProgramCounts'], ensure_ascii=False)}`",
        f"- Location archetype counts: `{json.dumps(analysis['locationArchetypeCounts'], ensure_ascii=False)}`",
        f"- Object family counts: `{json.dumps(analysis['objectFamilyCounts'], ensure_ascii=False)}`",
        f"- Emotional landing counts: `{json.dumps(analysis['emotionalLandingCounts'], ensure_ascii=False)}`",
        f"- Affordance counts: `{json.dumps(analysis['affordanceCounts'], ensure_ascii=False)}`",
        f"- Unique premises: `{analysis['uniquePremiseCount']}`",
        f"- Unique scene programs: `{analysis['uniqueSceneProgramCount']}`",
        f"- Unique location archetypes: `{analysis['uniqueLocationArchetypeCount']}`",
        f"- Unique object families: `{analysis['uniqueObjectFamilyCount']}`",
        f"- Unique selected captions: `{analysis['uniqueSelectedCaptionCount']}`",
        f"- Unique image scene blocks: `{analysis['uniqueImageSceneCount']}`",
        "",
        "## Runs",
        "",
    ]

    for run in runs:
        lines.extend([
            f"### Run {run['runIndex']:02d}",
            "",
            f"- `scenePlanRunId`: `{run['scenePlanRunId']}`",
            f"- lane / presence: `{run['scenePlan']['lane']}` / `{run['scenePlan']['presenceMode']}`",
            f"- scene program: `{run['scenePlan']['sceneProgramId']}`",
            f"- location / object: `{run['scenePlan']['locationArchetype']}` / `{run['scenePlan']['objectFamily']}`",
            f"- premise: {shorten(run['scenePlan']['premise'], 180)}",
            f"- selected caption: {shorten(run['selectedCaption']['caption'], 220)}",
            f"- image scene: {shorten(run['imageRequest']['scene'], 220)}",
            f"- validation: `{run['validation']['status']}`",
            "",
        ])

    (output_dir / "report.md").write_text("\n".join(lines), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=10)
    parser.add_argument("--project-dir", default=str(PROJECT_DIR))
    parser.add_argument("--output-dir", default="")
    parser.add_argument("--command-timeout-sec", type=int, default=300)
    args = parser.parse_args()

    project_dir = Path(args.project_dir)
    current_dir = project_dir / "runtime" / "current"
    stamp = datetime.now().strftime("%Y-%m-%dT%H-%M-%S")
    output_dir = Path(args.output_dir) if args.output_dir else Path(r"F:\openclaw-dev\workspace\reports") / f"preimage_pipeline_batch_{stamp}"
    ensure_dir(output_dir)

    runs = []
    emit_progress(f"batch start: output={output_dir} runCount={args.count}")
    for index in range(1, args.count + 1):
        emit_progress(f"run {index:02d}/{args.count} start")
        for command in PREIMAGE_COMMANDS:
            step_started = time.perf_counter()
            emit_progress(f"run {index:02d}/{args.count} step start: {command}")
            run_container_command(command, args.command_timeout_sec)
            emit_progress(
                f"run {index:02d}/{args.count} step done: {command} ({time.perf_counter() - step_started:.1f}s)"
            )

        run_dir = output_dir / f"run_{index:02d}" / "artifacts"
        copy_artifacts(current_dir, run_dir)
        run_summary = collect_run_summary(current_dir, index)
        (output_dir / f"run_{index:02d}" / "summary.json").write_text(
            json.dumps(run_summary, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        runs.append(run_summary)
        write_progress_snapshot(output_dir, runs)
        emit_progress(
            "run "
            f"{index:02d}/{args.count} done: "
            f"program={run_summary['scenePlan']['sceneProgramId']} "
            f"location={run_summary['scenePlan']['locationArchetype']} "
            f"validation={run_summary['validation']['status']}"
        )

    analysis = analyze_runs(runs)
    (output_dir / "batch_summary.json").write_text(
        json.dumps({"analysis": analysis, "runs": runs}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    write_markdown_report(output_dir, runs, analysis)
    emit_progress(
        "batch done: "
        f"uniquePrograms={analysis['uniqueSceneProgramCount']} "
        f"uniqueLocations={analysis['uniqueLocationArchetypeCount']} "
        f"allCreativeReady={analysis['allCreativeValidationReady']}"
    )
    print(output_dir)


if __name__ == "__main__":
    main()
