# Archive

> Documentation kept for **historical reference only**. Nothing here is the
> current source of truth. If you read a doc here, also read the live
> equivalent listed below.

## What's here

### `legacy-md/`

Markdown files superseded by the audience-organized structure.

| Archived file | Replaced by |
|---|---|
| `functional.md` | [functional/](../functional/README.md) — full FRD + per-screen detail |
| `technical.md` | [technical/](../technical/README.md) — TRD + architecture + data model + security + ops |
| `requirements.md` | [functional/business-requirements.md](../functional/business-requirements.md) + [technical/technical-requirements.md](../technical/technical-requirements.md) |
| `implementation-plan.md` (legacy) | superseded by [development-plan.md](../development-plan.md) — REQUIRED |
| `deployment-plan.md` | [technical/deployment-and-operations.md](../technical/deployment-and-operations.md) |
| `user-training.md` | [training/](../training/README.md) + per-role pages |
| `competitive-gap-analysis.md` | [product/market-analysis.md](../product/market-analysis.md) |

### `legacy-testing/`

Superseded snapshots from the Master Test Plan workbook generators and
the runtime smoke runner. The current authoritative set
(latest non-EXECUTED workbook + latest EXECUTED workbook + the four
Python generators + the latest report) lives at
[`docs/testing/`](../testing/README.md).

| Archived asset | Replaced by |
|---|---|
| `ESSEN_Credentialing_Master_Test_Plan_20260417_010249.xlsx` | `docs/testing/ESSEN_Credentialing_Master_Test_Plan_20260417_010720.xlsx` (later regen the same day) |
| `ESSEN_Credentialing_Master_Test_Plan_EXECUTED_20260417_013233.xlsx` | `docs/testing/ESSEN_Credentialing_Master_Test_Plan_EXECUTED_20260417_074709.xlsx` (later run the same day) |
| `ESSEN_Credentialing_Test_Plan_20260416_100935.xlsx`, `..._110654.xlsx` | first-pass legacy workbooks; superseded by the Master Test Plan series |
| `runtime_results_20260416_105254.json`, `runtime_test_results_20260416_104910.json`, `test_results_deep.json` | one-shot runtime smoke outputs; the runner now writes results back into the EXECUTED workbook |
| `TEST_EXECUTION_REPORT_20260417.md` | `docs/testing/TEST_EXECUTION_REPORT_20260417_v2.md` (later run the same day) |

### `legacy-decks/`

Older PowerPoint and HTML deck artifacts plus the build scripts that
generated them.

| Archived asset | Replaced by |
|---|---|
| `user-training.pptx`, `user-training-v2.pptx` (early drafts) | [training/user-training.pptx](../training/user-training.pptx) — single current training deck |
| `pitch-deck.pptx` (early draft), `pitch-deck.html` | [product/pitch-deck.pptx](../product/pitch-deck.pptx) — single current pitch deck |
| `pitch-deck-feedback-2026-04-16.pptx` | source PowerPoint containing primary-user operations feedback (April 16, 2026); the actionable changes have been incorporated into [product/pitch-deck.pptx](../product/pitch-deck.pptx) by [scripts/incorporate-pitch-feedback.py](../scripts/incorporate-pitch-feedback.py). Retained as evidence of how the canonical deck was updated. |
| `update_training_deck.py`, `update_pitch_deck.py`, `_deck_primitives.py` | retained for reproducibility. The current deck artifacts are produced by these scripts followed by [scripts/normalize-deck-versions.py](../scripts/normalize-deck-versions.py), which strips version-era framing (no "v2 / v3 / What's New Since…") because the platform is in active development and everything is current. |

## Policy

- Do not edit files in this folder. If something needs updating, update its
  current replacement and leave the archive as-is.
- If a file here is contradicted by a live doc, the live doc wins.
- Archive files may be deleted after 12 months unless flagged for retention
  by Compliance.
