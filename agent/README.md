# FitMind AI — Fitness Coaching Agent

A real local-LLM agent, adapted from the Ollama agent pattern in
`50-AI-Engineering-Projects/09-ai-medical-imaging-agent`.

## What changed vs. the source project

The source project is a *medical imaging* assistant. Its own code notes that
the local `qwen2.5:0.5b` model is text-only and cannot read scan pixels, so it
is scaffolded hard against inventing findings.

This version keeps the same architecture (local Ollama model + strict prompt
guardrails + JSON-shaped output) but re-aims it at **fitness coaching**, which
is what this app actually needs — and which the model can genuinely do well.

The guardrails were rewritten to match: the agent gives training, recovery and
nutrition guidance, and explicitly refuses to diagnose medical conditions,
interpret scans or labs, or recommend medication — it redirects those to a
healthcare professional.

## Setup

1. Install Ollama: https://ollama.com/download
2. Pull the model:
   ```bash
   ollama pull qwen2.5:0.5b
   ```
   (Any Ollama model works — set `FITMIND_MODEL=llama3.2` for a stronger one.)
3. Make sure Ollama is running (`ollama serve`, or it auto-starts on most installs).
4. Start the agent:
   ```bash
   cd agent
   python agent_server.py
   ```

Runs on `http://localhost:5000`. No pip install required.

## Endpoints

| Method | Path                    | Purpose                                  |
|--------|--------------------------|------------------------------------------|
| GET    | `/agent/health`          | Is Ollama up? which model?               |
| POST   | `/agent/coach-decision`  | Today's training call, from live vitals  |
| POST   | `/agent/muscle-insight`  | Per-muscle coaching note                 |
| POST   | `/agent/fuel-guidance`   | Nutrition suggestion                     |
| POST   | `/agent/chat`            | Free-form coaching Q&A                   |

## Config

| Env var          | Default                  | Meaning                    |
|------------------|--------------------------|----------------------------|
| `FITMIND_MODEL`  | `qwen2.5:0.5b`           | Ollama model to use        |
| `OLLAMA_HOST`    | `http://localhost:11434` | Where Ollama is listening  |
| `AGENT_PORT`     | `5000`                   | Port for this service      |
| `FITMIND_TIMEOUT`| `60`                     | Per-request timeout (sec)  |

## Offline behaviour

If Ollama isn't running, every endpoint still returns 200 with a safe default
and `"source": "fallback"`. The UI shows "AI AGENT · OFFLINE" instead of
breaking. Start Ollama and it switches to live with no code changes.

## A note on the model

`qwen2.5:0.5b` is tiny (~400MB) — fast and easy to run, but its coaching text
is basic. For noticeably better answers use a larger model:
```bash
ollama pull llama3.2
FITMIND_MODEL=llama3.2 python agent_server.py
```
