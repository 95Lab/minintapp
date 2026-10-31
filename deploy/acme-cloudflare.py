#!/usr/bin/env python3
"""Approved TXT scope only. Reads credentials in place; never writes credential copies."""
import json
import os
from pathlib import Path
import re
import shlex
import sys
import time
import urllib.parse
import urllib.request


def main():
    if len(sys.argv) != 2 or sys.argv[1] not in ("auth", "cleanup"):
        raise RuntimeError("Invalid hook action")
    if os.environ.get("CERTBOT_DOMAIN", "").removeprefix("*.") != "minintapp.io.vn":
        raise RuntimeError("Domain outside approved scope")
    value = os.environ.get("CERTBOT_VALIDATION", "")
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,256}", value):
        raise RuntimeError("Invalid validation")
    values = {}
    for line in (Path.home() / ".config/ai-secrets/api.env").read_text().splitlines():
        line = line.strip().removeprefix("export ")
        if "=" in line and not line.startswith("#"):
            key, raw = line.split("=", 1)
            parts = shlex.split(raw, comments=True)
            if parts:
                values[key.strip()] = parts[0]
    base = "https://api.cloudflare.com/client/v4/zones/" + values["CLOUDFLARE_ZONE_ID"] + "/dns_records"

    def api(path="", method="GET", body=None):
        request = urllib.request.Request(base + path, method=method, headers={
            "Authorization": "Bearer " + values["CLOUDFLARE_API_TOKEN"], "Content-Type": "application/json",
        }, data=json.dumps(body).encode() if body else None)
        with urllib.request.urlopen(request, timeout=20) as response:
            result = json.load(response)
        if not result.get("success"):
            raise RuntimeError("DNS operation failed")
        return result["result"]

    name = "_acme-challenge.minintapp.io.vn"
    records = api("?" + urllib.parse.urlencode({"type": "TXT", "name": name}))
    own = [record for record in records if record.get("content") == value and record.get("comment") == "minintapp:acme"]
    if sys.argv[1] == "auth":
        if not own:
            api(method="POST", body={"type": "TXT", "name": name, "content": value, "ttl": 120, "comment": "minintapp:acme"})
        time.sleep(30)
    else:
        for record in own:
            api("/" + record["id"], method="DELETE")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print("MinintApp ACME DNS hook failed; inspect permissions and DNS availability.", file=sys.stderr)
        sys.exit(1)
