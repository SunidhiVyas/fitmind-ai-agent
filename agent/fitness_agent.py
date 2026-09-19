"""
FitMind AI — Real Fitness Coaching Agent
========================================

Adapted from the local-Ollama agent pattern in:
  50-AI-Engineering-Projects/09-ai-medical-imaging-agent

That project runs a small local model (qwen2.5:0.5b) through Ollama and uses
careful prompt scaffolding to keep the model inside a safe, useful lane.
We keep the same architecture here, but re-aim it at fitness coaching, which
is what this app actually needs.

Two transports are supported, tried in order:
  1. autogen-ext OllamaChatCompletionClient (same as the source project)
  2. Ollama's plain HTTP REST API (fewer deps, very reliable)

If Ollama isn't running, every function degrades gracefully and returns
`source: "fallback"` so the rest of the app keeps working.
"""

import json
import os
import urllib.error
import urllib.request

MODEL_NAME = os.environ.get("FITMIND_MODEL", "qwen2.5:0.5b")
OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
REQUEST_TIMEOUT = int(os.environ.get("FITMIND_TIMEOUT", "60"))


# ----------------------------------------------------------------------
# Transport 1: autogen-ext (matches the original project)
# ----------------------------------------------------------------------
def _ask_via_autogen(prompt: str) -> str:
    import asyncio

    from autogen_core.models import UserMessage
    from autogen_ext.models.ollama import OllamaChatCompletionClient

    async def run():
        client = OllamaChatCompletionClient(model=MODEL_NAME)
        try:
            result = await client.create(
                [UserMessage(content=prompt, source="user")]
            )
            return str(getattr(result, "content", result))
        finally:
            await client.close()

    return asyncio.run(run())


# ----------------------------------------------------------------------
# Transport 2: Ollama REST API directly
# ----------------------------------------------------------------------
def _ask_via_http(prompt: str) -> str:
    payload = json.dumps(
        {
            "model": MODEL_NAME,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.4},
        }
    ).encode("utf-8")

    req = urllib.request.Request(
        f"{OLLAMA_HOST}/api/generate",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    return body.get("response", "").strip()


def ask_agent(prompt: str) -> str:
    """Send a prompt to the local model. Raises if no transport works."""
    try:
        return _ask_via_http(prompt)
    except Exception as http_err:
        try:
            return _ask_via_autogen(prompt)
        except Exception as autogen_err:
            raise RuntimeError(
                f"Ollama unreachable at {OLLAMA_HOST}. "
                f"HTTP error: {http_err}. autogen error: {autogen_err}"
            )


def agent_available() -> bool:
    """Check whether Ollama is up and the model is present."""
    try:
        with urllib.request.urlopen(f"{OLLAMA_HOST}/api/tags", timeout=4) as resp:
            tags = json.loads(resp.read().decode("utf-8"))
        names = [m.get("name", "") for m in tags.get("models", [])]
        return any(n.startswith(MODEL_NAME.split(":")[0]) for n in names)
    except Exception:
        return False


# ----------------------------------------------------------------------
# Shared guardrails — kept in the same spirit as the source project's
# "do not invent findings / do not diagnose" scaffolding.
# ----------------------------------------------------------------------
GUARDRAILS = """
You are FitMind AI, a fitness and recovery coaching assistant.

IMPORTANT RULES:
- You give general fitness, training, and recovery guidance only.
- You are NOT a doctor. Do not diagnose medical conditions, interpret medical
  scans or lab results, or recommend medication or treatment.
- If the user describes pain, injury, dizziness, chest symptoms, or anything
  that sounds medical, tell them plainly to consult a qualified healthcare
  professional, and do not attempt to assess it yourself.
- Do not invent specific biometric numbers you were not given.
- Keep advice practical, encouraging, and safe for a general adult audience.
"""


# ----------------------------------------------------------------------
# 1. Coach decision — replaces the hardcoded rotating array
# ----------------------------------------------------------------------
def coach_decision(vitals: dict) -> dict:
    prompt = f"""{GUARDRAILS}

Here are today's readings for the user:
- Resting/current heart rate: {vitals.get('bpm')} bpm
- Energy level: {vitals.get('energy')}%
- Recovery score: {vitals.get('recovery')}%
- Muscle activation average: {vitals.get('activation')}%

Decide what this person should do today.

Respond with ONLY raw JSON, no markdown fences, no extra text, in exactly
this shape:
{{"title":"SHORT ALL-CAPS RECOMMENDATION, max 3 words","explain":"One or two sentences explaining why, referencing the readings above."}}
"""
    raw = ask_agent(prompt)
    return _parse_json(
        raw,
        fallback={
            "title": "TRAIN MODERATE",
            "explain": "Readings look steady. A moderate session is a reasonable choice today.",
        },
    )


# ----------------------------------------------------------------------
# 2. Muscle zone insight — real text for the hover panels
# ----------------------------------------------------------------------
def muscle_insight(zone: str, activation: int) -> dict:
    prompt = f"""{GUARDRAILS}

The user is looking at their "{zone}" muscle group, which is currently showing
{activation}% activation in their training data.

Give a brief coaching note about this muscle group.

Respond with ONLY raw JSON, no markdown fences, in exactly this shape:
{{"headline":"3-6 word summary","note":"One or two sentences of practical training or recovery guidance for this muscle group."}}
"""
    raw = ask_agent(prompt)
    return _parse_json(
        raw,
        fallback={
            "headline": f"{zone.title()} engaged",
            "note": "Keep movements controlled and allow adequate recovery between sessions.",
        },
    )


# ----------------------------------------------------------------------
# 3. Fuel guidance — nutrition coaching for the Fuel page
# ----------------------------------------------------------------------
def fuel_guidance(stats: dict) -> dict:
    prompt = f"""{GUARDRAILS}

Current nutrition and recovery readings:
- Protein intake score: {stats.get('protein')}%
- Hydration: {stats.get('hydration')}%
- Recovery: {stats.get('recovery')}%
- Nutrient absorption: {stats.get('absorption')}%

Give one short, practical nutrition suggestion for today. Do not prescribe
supplements, specific calorie targets, or restrictive diets.

Respond with ONLY raw JSON, no markdown fences, in exactly this shape:
{{"headline":"3-6 word summary","note":"One or two sentences of practical, non-restrictive nutrition guidance."}}
"""
    raw = ask_agent(prompt)
    return _parse_json(
        raw,
        fallback={
            "headline": "Steady fueling",
            "note": "Aim for balanced meals and consistent water intake through the day.",
        },
    )


# ----------------------------------------------------------------------
# 4. Free-form chat — ask the coach anything (now with follow-up history)
# ----------------------------------------------------------------------
def coach_chat(question: str, context: dict | None = None, history: list | None = None) -> str:
    ctx = ""
    if context:
        ctx = (
            "\nCurrent readings for context: "
            f"HR {context.get('bpm')} bpm, energy {context.get('energy')}%, "
            f"recovery {context.get('recovery')}%.\n"
        )

    hist_block = ""
    if history and isinstance(history, list) and len(history) > 0:
        # Use last 8 turns to keep prompt small and relevant
        trimmed = history[-8:]
        lines = []
        for h in trimmed:
            role = (h.get("role") or "").lower()
            content = h.get("content") if h.get("content") is not None else h.get("text", "")
            content = str(content).strip()
            if not content:
                continue
            # Avoid duplicating the current question if it's already the last history entry
            if role == "user" and content == question and h is trimmed[-1]:
                continue
            speaker = "User" if role == "user" else "Assistant"
            lines.append(f"{speaker}: {content}")
        if lines:
            hist_block = "\nConversation so far (for follow-up context):\n" + "\n".join(lines) + "\n"

    prompt = f"""{GUARDRAILS}
{ctx}{hist_block}
The user asks: "{question}"

Answer in 2-4 short sentences. Be direct and practical. Consider the conversation so far for follow-up context. If the question is
medical rather than fitness-related, say so and point them to a healthcare
professional instead of answering.
"""
    return ask_agent(prompt)


# ----------------------------------------------------------------------
def _parse_json(raw: str, fallback: dict) -> dict:
    """Small models often wrap JSON in fences or prose. Recover what we can."""
    text = raw.strip().replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(text)
    except Exception:
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(text[start : end + 1])
            except Exception:
                pass
    return fallback
