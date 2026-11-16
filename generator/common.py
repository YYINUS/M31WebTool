"""Shared Claude API plumbing: a web-research pass, then a structured-output pass."""

from __future__ import annotations

import json
import os
import sys
import time

import anthropic

MODEL = os.environ.get("CLAUDE_MODEL", "claude-opus-5-5")
FALLBACK_BETA = "server-side-fallback-2026-07-01"


def web_tools(searches: int, fetches: int) -> list[dict]:
    return [
        {"type": "web_search_20260209", "name": "web_search", "max_uses": searches},
        {"type": "web_fetch_20260209", "name": "web_fetch", "max_uses": fetches},
    ]


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", file=sys.stderr, flush=True)


def client() -> anthropic.Anthropic:
    if not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("ANTHROPIC_API_KEY is not set (add it as a GitHub Actions secret).")
    return anthropic.Anthropic(max_retries=4, timeout=1800)


def _stream(c: anthropic.Anthropic, **kwargs):
    """Stream one request (server-side refusal fallback on) and return the final message."""
    with c.beta.messages.stream(
        model=MODEL,
        betas=[FALLBACK_BETA],
        fallbacks="default",
        **kwargs,
    ) as stream:
        return stream.get_final_message()


def _text(msg) -> str:
    return "".join(b.text for b in msg.content if b.type == "text")


def research(system: str, task: str, effort: str = "high", searches: int = 30, fetches: int = 20) -> str:
    """Let Claude search and read the web, and return its research notes (plain text with URLs)."""
    c = client()
    messages = [{"role": "user", "content": task}]
    calls = 0
    for turn in range(8):
        msg = _stream(
            c,
            max_tokens=64000,
            system=system,
            thinking={"type": "adaptive"},
            output_config={"effort": effort},
            tools=web_tools(searches, fetches),
            messages=messages,
        )
        calls += sum(1 for b in msg.content if b.type == "server_tool_use")
        log(f"research turn {turn + 1}: stop={msg.stop_reason}, tool calls so far={calls}")
        if msg.stop_reason == "refusal":
            sys.exit(f"Research request was declined: {msg.stop_details}")
        if msg.stop_reason == "pause_turn":
            messages.append({"role": "assistant", "content": msg.content})
            continue
        notes = _text(msg)
        if not notes.strip():
            sys.exit("Research pass returned no notes.")
        return notes
    sys.exit("Research pass did not finish after 8 continuation turns.")


def structure(system: str, notes: str, instructions: str, schema: dict) -> dict:
    """Turn research notes into JSON that matches `schema` (structured outputs, no tools)."""
    c = client()
    msg = _stream(
        c,
        max_tokens=32000,
        system=system,
        thinking={"type": "adaptive"},
        output_config={
            "effort": "medium",
            "format": {"type": "json_schema", "schema": schema},
        },
        messages=[
            {
                "role": "user",
                "content": f"<research_notes>\n{notes}\n</research_notes>\n\n{instructions}",
            }
        ],
    )
    log(f"structure pass: stop={msg.stop_reason}")
    if msg.stop_reason == "refusal":
        sys.exit(f"Formatting request was declined: {msg.stop_details}")
    if msg.stop_reason == "max_tokens":
        sys.exit("Formatting pass hit max_tokens; output would be truncated.")
    return json.loads(_text(msg))


def obj(props: dict, required: list[str] | None = None) -> dict:
    """Strict JSON-schema object helper: every property required, no extras."""
    return {
        "type": "object",
        "properties": props,
        "required": required if required is not None else list(props),
        "additionalProperties": False,
    }


STR = {"type": "string"}


def arr(items: dict) -> dict:
    return {"type": "array", "items": items}


def enum(*values: str) -> dict:
    return {"type": "string", "enum": list(values)}


LINK = obj({"label": STR, "url": STR})
