"""Gemini image generation handler.

Reads JSON from stdin: { "prompt": "...", "_apiKey": "..." }
Writes JSON to stdout: { "result": "markdown", "imageUrl": "data:..." }
"""

import json
import sys
import base64
from urllib.request import Request, urlopen
from urllib.error import HTTPError

API_BASE = "https://generativelanguage.googleapis.com/v1beta"
MODEL = "gemini-2.0-flash-exp-image-generation"


def main():
    params = json.loads(sys.stdin.read())
    prompt = params.get("prompt", "")
    api_key = params.get("_apiKey", "")

    if not prompt:
        json.dump({"error": "No prompt provided"}, sys.stdout)
        return
    if not api_key:
        json.dump({"error": "No API key — add your Google key in the Vault"}, sys.stdout)
        return

    url = f"{API_BASE}/models/{MODEL}:generateContent?key={api_key}"
    body = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseModalities": ["TEXT", "IMAGE"]},
    }).encode()

    req = Request(url, data=body, headers={"Content-Type": "application/json"})

    try:
        with urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read())
    except HTTPError as e:
        err_body = e.read().decode() if e.fp else ""
        json.dump({"error": f"Gemini API {e.code}: {err_body[:500]}"}, sys.stdout)
        return

    parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])

    image_b64 = None
    mime_type = "image/png"
    text_response = ""

    for part in parts:
        inline = part.get("inlineData")
        if inline and inline.get("data"):
            image_b64 = inline["data"]
            mime_type = inline.get("mimeType", "image/png")
        if part.get("text"):
            text_response += part["text"]

    if not image_b64:
        json.dump({"error": "No image returned from Gemini"}, sys.stdout)
        return

    image_url = f"data:{mime_type};base64,{image_b64}"

    lines = [
        "## Generated Image (Gemini)",
        "",
        f"![{prompt[:80]}]({image_url})",
        "",
        f"**Prompt:** {prompt}",
    ]
    if text_response:
        lines.append(f"**Model notes:** {text_response}")
    lines.append("")
    lines.append("> Generated via Gemini image generation")

    json.dump({
        "result": "\n".join(lines),
        "imageUrl": image_url,
    }, sys.stdout)


if __name__ == "__main__":
    main()
