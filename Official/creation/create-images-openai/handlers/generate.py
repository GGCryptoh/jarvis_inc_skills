"""OpenAI DALL-E 3 image generation handler.

Reads JSON from stdin: { "prompt": "...", "size": "1024x1024", "quality": "standard", "style": "vivid", "_apiKey": "sk-..." }
Writes JSON to stdout: { "result": "markdown", "imageUrl": "data:..." }
"""

import json
import sys
from urllib.request import Request, urlopen
from urllib.error import HTTPError

API_URL = "https://api.openai.com/v1/images/generations"


def main():
    params = json.loads(sys.stdin.read())
    prompt = params.get("prompt", "")
    api_key = params.get("_apiKey", "")
    size = params.get("size", "1024x1024")
    quality = params.get("quality", "standard")
    style = params.get("style", "vivid")

    if not prompt:
        json.dump({"error": "No prompt provided"}, sys.stdout)
        return
    if not api_key:
        json.dump({"error": "No API key — add your OpenAI key in the Vault"}, sys.stdout)
        return

    body = json.dumps({
        "model": "dall-e-3",
        "prompt": prompt,
        "n": 1,
        "size": size,
        "quality": quality,
        "style": style,
        "response_format": "b64_json",
    }).encode()

    req = Request(
        API_URL,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
    )

    try:
        with urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read())
    except HTTPError as e:
        err_body = e.read().decode() if e.fp else ""
        json.dump({"error": f"OpenAI API {e.code}: {err_body[:500]}"}, sys.stdout)
        return

    item = data.get("data", [{}])[0]
    b64 = item.get("b64_json", "")
    revised_prompt = item.get("revised_prompt", "")

    if not b64:
        json.dump({"error": "No image data returned from OpenAI"}, sys.stdout)
        return

    image_url = f"data:image/png;base64,{b64}"

    lines = [
        "## Generated Image (DALL-E 3)",
        "",
        f"![{prompt[:80]}]({image_url})",
        "",
        f"**Prompt:** {prompt}",
    ]
    if revised_prompt:
        lines.append("")
        lines.append(f"*Revised prompt:* {revised_prompt}")

    json.dump({
        "result": "\n".join(lines),
        "imageUrl": image_url,
    }, sys.stdout)


if __name__ == "__main__":
    main()
