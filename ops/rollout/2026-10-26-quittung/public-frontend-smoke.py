"""Read-only public HTTP verification; no credentials, customer queries or mutations."""
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
BASE = "https://crm-hirschen.ch"
result = {
    "observed_at": datetime.now(timezone.utc).isoformat(),
    "deployment_uuid": "es4ho9fzfxygjszkvzhcdf0x",
    "release_commit": "3008c18344de51f12d6aaba8673d5cd97ec72115",
    "scope": "Unauthenticated public GET only; no customer data or auth mutations",
    "checks": [],
}

def get(path):
    with urlopen(BASE + path, timeout=30) as response:
        body = response.read()
        info = {"path": path, "status": response.status,
                "content_type": response.headers.get("Content-Type", ""),
                "cache_control": response.headers.get("Cache-Control", ""),
                "bytes": len(body), "sha256": hashlib.sha256(body).hexdigest()}
        assert response.status == 200, info
        result["checks"].append(info)
        return info, body

try:
    assert get("/health")[1].strip() == b"healthy"
    html = ""
    for route in ("/firma/quittungen", "/firma/quittungen/neu"):
        info, body = get(route)
        assert "text/html" in info["content_type"], info
        assert b'<div id="root">' in body
        assert "no-store" in info["cache_control"]
        html = body.decode()
    entry = re.search(r'src="(/assets/index-[^"]+\.js)"', html).group(1)
    info, js = get(entry)
    assert "javascript" in info["content_type"]
    names = set(re.findall(
        r'(QuittungDetail-[A-Za-z0-9_-]+\.js|Quittungen-[A-Za-z0-9_-]+\.js|QuittungPDF-[A-Za-z0-9_-]+\.js)',
        js.decode()))
    assert all(any(n.startswith(prefix) for n in names)
               for prefix in ("QuittungDetail-", "Quittungen-", "QuittungPDF-")), names
    for name in sorted(names):
        info, body = get("/assets/" + name)
        assert "javascript" in info["content_type"] and b"<html" not in body[:100], info
    for filename, asset in (
        ("DejaVuSans.ttf", "DejaVuSans-D8qTUNWI.ttf"),
        ("DejaVuSans-Bold.ttf", "DejaVuSans-Bold-CmRlJs-h.ttf"),
    ):
        info, remote = get("/assets/" + asset)
        local = (ROOT / "src/assets/fonts" / filename).read_bytes()
        info["matches_release_source"] = hashlib.sha256(remote).digest() == hashlib.sha256(local).digest()
        assert info["matches_release_source"], info
    result["passed"] = True
except Exception as exc:
    result["passed"] = False
    result["error"] = str(exc)
    raise
finally:
    (OUT / "frontend-public-smoke.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))
