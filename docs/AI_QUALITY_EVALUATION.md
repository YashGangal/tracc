# AI and ML Quality Evaluation Guide

## Purpose

Use this guide before enabling real AI providers or relying on delay-risk predictions in live operations. The current project includes a deterministic fallback for demos; production acceptance requires evaluation against representative operations data.

## Evaluation scope

| Capability | What to evaluate | Release target |
|---|---|---|
| Text-to-SQL | SQL safety, correctness, valid table selection, useful summaries | 100% safety-policy compliance; at least 90% correct answers on approved test cases |
| SOP RAG | Citation relevance, factual grounding, correct refusal when SOPs lack an answer | At least 90% cited answers supported by the cited SOP; 100% of unsupported questions safely refused |
| Operations agent | Correct tool selection, trace quality, no unsupported external action | At least 90% correct tool sequence on approved scenarios; 100% policy compliance |
| Delay prediction | Precision, recall, calibration, and stability on unseen loads | Thresholds to be agreed with operations before pilot |
| Workflow alerts | Alert precision, duplicate rate, and time to acknowledgement | Duplicate rate below 1%; alert ownership and delivery verified |

## Required evaluation set

Create a reviewed test set before production use:

- 25–50 real or carefully anonymized dispatcher data questions for Text-to-SQL.
- 25 SOP questions with expected citations, including at least 5 questions that must be refused because the SOP library does not cover them.
- 15 multi-step operations-agent scenarios that cover delayed loads, carrier performance, driver safety, and failed/ambiguous inputs.
- A held-out set of historical loads for prediction evaluation. It must not overlap with model-training data.
- At least one duplicate-event, notification-failure, and schedule-retry scenario for every workflow.

## Review process

1. An operations manager writes the expected outcome for each case.
2. Run each case with the configured AI provider/model version recorded.
3. Grade output as correct, partly correct, incorrect, unsafe, or unsupported-but-refused.
4. Record citations, generated SQL, agent tools used, prediction score, and human review comments.
5. Fix prompts, guardrails, threshold settings, or data issues before rerunning failed cases.
6. Approve only a named model/provider/version for the pilot environment.

## Model governance

- The prediction response now derives its model version from `benchmark_metrics.json`; it must match the serialized model artifact.
- Retrain only using a documented dataset version and preserve the corresponding benchmark result, model file, explainer, and feature list together.
- Compare candidate models using recall, precision, F1, ROC-AUC, PR-AUC, and calibration—not accuracy alone.
- Review prediction thresholds with dispatch leadership; a high-risk score should lead to human review, not irreversible automatic action.
- Monitor prediction quality and late-delivery rates monthly after pilot launch. Retrain or roll back when agreed thresholds are missed.

## Current limitation

No live AI-provider credential, notification destination, Power BI workspace, or representative production dataset is configured in this repository. Those inputs are required to conduct the final Phase 3 evaluation and integration verification.
