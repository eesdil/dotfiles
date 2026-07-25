# openspec-loop (full package)

End-to-end **OpenSpec plan → controlled apply** package for Pi.

```text
/openspec-feature "add dark mode"
        │
        ▼
 ┌──────────────┐     proposal.md / specs / design.md / tasks.md
 │  PLAN phase  │ ──────────────────────────────────────────────►
 └──────────────┘
        │  confirm ready
        ▼
 ┌──────────────┐     pick main model + gate models (YAML templates)
 │  APPLY loop  │ ──────────────────────────────────────────────►
 └──────────────┘     shell gates + agent review gates
```

## Install (project)

```sh
# from the project you want to use
~/.dotfiles/pi-packages/openspec-loop/bin/setup.sh .

# or explicitly
cd ~/.dotfiles/pi-packages/openspec-loop
./bin/setup.sh /path/to/your/project
```

This will:

1. `npm install` this package
2. Install OpenSpec CLI if missing (`@fission-ai/openspec`)
3. Symlink the Pi extension
4. `openspec init --tools pi` in the project
5. Copy `.pi/openspec-loop.yaml` if absent

Then in Pi: `/reload` (or restart).

## Daily usage

| Command | When |
|---------|------|
| `/openspec-feature <desc>` | **Whole flow** — plan with OpenSpec, then apply with the loop |
| `/openspec-plan <desc>` | Plan only |
| `/openspec-loop [change]` | Apply only (existing change) — models + gates |
| `/openspec-loop-save` | Save run setup YAML (LLM bakeoff templates) |
| `/openspec-loop-runs` | List templates |
| `/openspec-loop-status` | Phase + models + tasks |
| `/openspec-loop-stop` | Cancel plan or disarm apply |

### Recommended path

1. `/openspec-feature add user avatars`
2. Choose **Full**
3. Confirm planning model → agent writes OpenSpec artifacts
4. When plan is ready → confirm → pick **main + gate models**
5. Apply loop implements `tasks.md` with gates (tests / review agent)

OpenSpec’s own `/opsx-propose` still works for planning if you prefer; use `/openspec-loop` afterward for gated apply.

## Run setups (YAML)

Saved under `.pi/openspec-loop/runs/`:

```yaml
name: kimi-main-sonnet-review
mode: apply-loop
main_model: ollama/kimi-k2.5:cloud
gate_models:
  review: anthropic/claude-sonnet-4-5
```

## Config

`.pi/openspec-loop.yaml` — gates, defaults, inline templates (see `config.example.yaml`).

## Layout

```text
bin/setup.sh            # one-shot project setup
src/core/               # harness-agnostic plan + apply + runs
src/adapters/pi/        # Pi extension
prompts/                # /openspec-feature /openspec-plan /openspec-loop
skills/                 # agent skill discovery
examples/               # sample run YAML
```
