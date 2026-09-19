"""
FitMind AI — Agent HTTP service
===============================

Exposes the real Ollama-backed fitness agent over HTTP so the Node backend
(and the browser) can call it.

Runs on stdlib only — no FastAPI/Flask needed — so `python agent_server.py`
just works. Ollama itself is the only external dependency, and if it's down
every endpoint still responds with a safe fallback plus source:"fallback".

Endpoints:
  GET  /agent/health
  POST /agent/coach-decision   {bpm, energy, recovery, activation}
  POST /agent/muscle-insight   {zone, activation}
  POST /agent/fuel-guidance    {protein, hydration, recovery, absorption}
  POST /agent/chat             {question, context}
"""

import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import fitness_agent as agent

PORT = int(os.environ.get("AGENT_PORT", "5000"))


class Handler(BaseHTTPRequestHandler):
    # --- helpers ---------------------------------------------------
    def _send(self, code, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        length = int(self.headers.get("Content-Length") or 0)
        if not length:
            return {}
        try:
            return json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception:
            return {}

    def log_message(self, fmt, *args):
        print(f"[agent] {fmt % args}")

    # --- routes ----------------------------------------------------
    def do_OPTIONS(self):
        self._send(204, {})

    def do_GET(self):
        if self.path == "/agent/health":
            up = agent.agent_available()
            self._send(
                200,
                {
                    "ok": True,
                    "ollama": up,
                    "model": agent.MODEL_NAME,
                    "host": agent.OLLAMA_HOST,
                    "mode": "live" if up else "fallback",
                },
            )
        else:
            self._send(404, {"error": "not found"})

    def do_POST(self):
        data = self._read_json()

        try:
            if self.path == "/agent/coach-decision":
                result = agent.coach_decision(data)
                self._send(200, {**result, "source": "agent"})

            elif self.path == "/agent/muscle-insight":
                result = agent.muscle_insight(
                    data.get("zone", "core"), data.get("activation", 80)
                )
                self._send(200, {**result, "source": "agent"})

            elif self.path == "/agent/fuel-guidance":
                result = agent.fuel_guidance(data)
                self._send(200, {**result, "source": "agent"})

            elif self.path == "/agent/chat":
                question = (data.get("question") or "").strip()
                if not question:
                    self._send(400, {"error": "question is required"})
                    return
                answer = agent.coach_chat(question, data.get("context"), data.get("history"))
                self._send(200, {"answer": answer, "source": "agent"})

            else:
                self._send(404, {"error": "not found"})

        except Exception as err:
            # Ollama down / model missing / timeout -> safe fallback
            self._send(
                200,
                {
                    **_fallback_for(self.path, data),
                    "source": "fallback",
                    "detail": str(err)[:200],
                },
            )


def _fallback_for(path, data):
    if path == "/agent/coach-decision":
        return {
            "title": "TRAIN MODERATE",
            "explain": "Agent offline — showing a safe default. Start Ollama for live coaching.",
        }
    if path == "/agent/muscle-insight":
        zone = (data.get("zone") or "core").title()
        return {
            "headline": f"{zone} engaged",
            "note": "Agent offline — start Ollama for live per-muscle coaching.",
        }
    if path == "/agent/fuel-guidance":
        return {
            "headline": "Steady fueling",
            "note": "Agent offline — start Ollama for live nutrition guidance.",
        }
    if path == "/agent/chat":
        return {
            "answer": (
                "The coaching agent isn't running right now. Start Ollama "
                "(`ollama serve`) and pull the model to enable live answers."
            )
        }
    return {"error": "unknown route"}


if __name__ == "__main__":
    up = agent.agent_available()
    print(f"FitMind AI agent service on http://localhost:{PORT}")
    print(f"  model : {agent.MODEL_NAME}")
    print(f"  ollama: {agent.OLLAMA_HOST} -> {'CONNECTED' if up else 'NOT RUNNING (fallback mode)'}")
    if not up:
        print("  hint  : run `ollama serve` and `ollama pull " + agent.MODEL_NAME + "`")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
