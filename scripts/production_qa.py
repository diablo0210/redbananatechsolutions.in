#!/usr/bin/env python3
"""Read-only production checks for the Red Banana GitHub Pages site."""

import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APEX = "redbananatechsolutions.in"
WWW = f"www.{APEX}"
CANONICAL = f"https://{APEX}"
EXPECTED_A = {"185.199.108.153", "185.199.109.153", "185.199.110.153", "185.199.111.153"}
EXPECTED_AAAA = {"2606:50c0:8000::153", "2606:50c0:8001::153", "2606:50c0:8002::153", "2606:50c0:8003::153"}
EXPECTED_WWW = "diablo0210.github.io."
failures = []


def check(condition, message):
    print(("PASS" if condition else "FAIL") + "  " + message)
    if not condition:
        failures.append(message)


def command(*args):
    return subprocess.run(args, text=True, capture_output=True, timeout=30, check=False)


def dns(name, record_type):
    result = command("dig", "+short", name, record_type)
    check(result.returncode == 0, f"DNS query works: {name} {record_type}")
    values = {line.strip().lower() for line in result.stdout.splitlines() if line.strip()}
    print(f"INFO  {name} {record_type}: {', '.join(sorted(values)) or '(empty)'}")
    return values


def fetch(url, expected_final=None, required=()):
    with tempfile.NamedTemporaryFile() as body:
        result = command("curl", "--silent", "--show-error", "--location", "--max-time", "20",
                         "--output", body.name, "--write-out", "%{http_code}\n%{url_effective}\n", url)
        lines = result.stdout.splitlines()
        code = lines[-2] if len(lines) >= 2 else "000"
        final_url = lines[-1] if lines else ""
        check(result.returncode == 0 and code == "200", f"{url} returns 200 (final: {final_url or 'none'})")
        if expected_final:
            check(final_url == expected_final, f"{url} resolves to canonical {expected_final}")
        body.seek(0)
        content = body.read().decode("utf-8", "replace")
        for token in required:
            check(token in content, f"{url} contains {token!r}")
        return content


def local_release_checks():
    check((ROOT / "CNAME").read_text().strip() == APEX, "CNAME selects the apex canonical host")
    pages = list(ROOT.glob("*.html"))
    text = "\n".join(path.read_text(encoding="utf-8") for path in pages)
    check(not re.search(r"localhost|127\.0\.0\.1|staging|canva|editor", text, re.I), "release HTML has no local/staging/editor artifacts")
    check("/privacy-analytics.js" in text, "analytics loader is present")
    analytics = (ROOT / "privacy-analytics.js").read_text(encoding="utf-8")
    placeholder = "REPLACE_WITH_DEPLOYED_COLLECTOR_URL" in analytics
    check((not placeholder) or "if (!/^https:" in analytics, "analytics is configured or safely disabled")
    if placeholder:
        print("WARN  analytics collector remains disabled: no proven production Worker URL is in the repo")


def main():
    check(shutil.which("dig") is not None, "dig is installed")
    check(shutil.which("curl") is not None, "curl is installed")
    local_release_checks()
    if not shutil.which("dig") or not shutil.which("curl"):
        return 1
    check(dns(APEX, "A") == EXPECTED_A, "apex A records match GitHub Pages")
    aaaa = dns(APEX, "AAAA")
    check(not aaaa or aaaa == EXPECTED_AAAA, "apex AAAA records are absent or match GitHub Pages")
    dns(APEX, "NS")
    check(dns(WWW, "CNAME") == {EXPECTED_WWW}, "www CNAME points directly to the GitHub Pages user host")
    fetch(f"http://{APEX}/", CANONICAL + "/")
    fetch(CANONICAL + "/", CANONICAL + "/", ("Red Banana Tech Solutions", "/privacy-analytics.js"))
    fetch(f"http://{WWW}/", CANONICAL + "/")
    fetch(f"https://{WWW}/", CANONICAL + "/")
    fetch(CANONICAL + "/robots.txt", required=("Sitemap: https://redbananatechsolutions.in/sitemap.xml",))
    fetch(CANONICAL + "/sitemap.xml", required=("https://redbananatechsolutions.in/",))
    for page in ("capabilities.html", "work.html", "about.html", "contact.html", "privacy.html", "styles.css", "favicon.svg", "privacy-analytics.js"):
        fetch(f"{CANONICAL}/{page}")
    print(f"\n{'FAIL' if failures else 'PASS'}: {len(failures)} failure(s)")
    return bool(failures)


if __name__ == "__main__":
    sys.exit(main())
