"""Example Python handler for an api_key skill.

I/O Contract:
    Input:  JSON on stdin — { "prompt": "...", "_apiKey": "..." }
    Output: JSON on stdout — { "result": "..." }

The `_apiKey` value is automatically injected by the executor from the Vault
based on the skill's `api_config.vault_service` field.

Rules:
    - Read all input from sys.stdin as JSON
    - Write JSON to sys.stdout with json.dump()
    - Return {"result": "..."} for success, {"error": "..."} for failure
    - Use only Python stdlib (no pip dependencies) — urllib, json, base64, etc.
    - Include `if __name__ == "__main__": main()` guard
    - 30-second execution timeout
"""
import json
import sys
from urllib.request import Request, urlopen


def main():
    params = json.loads(sys.stdin.read())
    prompt = params.get("prompt", "")
    api_key = params.get("_apiKey", "")

    if not api_key:
        json.dump({"error": "No API key — add it in the Vault"}, sys.stdout)
        return

    # TODO: Replace with your actual API call
    req = Request(
        "https://api.example.com/endpoint",
        data=json.dumps({"prompt": prompt}).encode(),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urlopen(req, timeout=25) as resp:
            data = json.loads(resp.read())
    except Exception as e:
        json.dump({"error": str(e)}, sys.stdout)
        return

    # TODO: Format the response
    json.dump({"result": f"**Result:** {json.dumps(data)}"}, sys.stdout)


if __name__ == "__main__":
    main()
