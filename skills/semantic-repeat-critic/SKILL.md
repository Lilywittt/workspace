---
name: semantic-repeat-critic
description: Use when validated situation hypotheses already exist and you need a critic pass that catches hidden structural repetition before candidate selection.
---

# Semantic Repeat Critic

Use this skill after `validated_situation_hypotheses.json` exists and before final scene candidate selection. The goal is not to rewrite hypotheses but to detect fake freshness.

## Inputs
- `runtime/current/validated_situation_hypotheses.json`
- `runtime/current/novelty_ledger.json`
- `runtime/current/reflection_notes.json`
- `runtime/current/continuity_creative_review.json`

## Output Shape
Return compact JSON only, with these fields:
- `critiques`
- `summary`

Each critique must include:
- `hypothesisId`
- `keepOrCut`
- `repeatRiskLabel`
- `repeatRiskScore`
- `hiddenSimilarity`
- `freshnessWins`
- `suggestedAdjustment`

## Workflow
1. Compare each hypothesis against recent semantic history, not just surface wording.
2. Flag when a proposal only changes the object or weather while keeping the same underlying situation shape.
3. Call out what is genuinely fresh so downstream scoring can reward real novelty.
4. Keep judgments short, operational, and tied to existing hypothesis ids.

## Guardrails
- Never invent or rename hypothesis ids.
- Do not rewrite full hypotheses.
- Prefer structural analysis over stylistic taste.
- Be suspicious of “indoor + small object + soft feeling” variants that only changed labels.

## Success Criteria
- The critic catches disguised repetition early.
- Code can combine your judgments with deterministic scoring.
- The final selected situation is fresher in structure, not just in wording.
