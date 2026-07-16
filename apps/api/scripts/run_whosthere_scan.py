#!/usr/bin/env python3
import json
import os
import subprocess
import sys


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Usage: run_whosthere_scan.py <network_cidr> [primary_ip]"}))
        return 0

    target = sys.argv[1]
    primary_ip = sys.argv[2] if len(sys.argv) > 2 else ""
    command_template = os.environ.get("WHOSTHERE_CMD", "").strip()
    if not command_template:
        if os.environ.get("NODE_ENV") == "production":
            print(json.dumps({"success": False, "error": "WHOSTHERE_CMD must be configured in production"}))
            return 0
        prefix = target.split("/")[0].rsplit(".", 1)[0]
        print(json.dumps({
            "success": True,
            "devices": [
                {
                    "ipAddress": f"{prefix}.10",
                    "macAddress": "AA:00:00:00:10:10",
                    "manufacturer": "Cisco",
                    "deviceModel": "CBS250-24P-4G",
                    "hostName": "core-cmc",
                    "category": "switch",
                    "score": 82,
                    "target": target,
                    "primaryIp": primary_ip,
                }
            ],
        }))
        return 0

    parts = [part for part in command_template.split() if part]
    command = parts[0]
    args = [part.replace("{target}", target).replace("{ip}", primary_ip) for part in parts[1:]]
    try:
        result = subprocess.run([command, *args], capture_output=True, text=True, check=False, env=os.environ.copy())
    except OSError as error:
        print(json.dumps({"success": False, "error": str(error)}))
        return 0
    if result.returncode != 0:
        print(json.dumps({"success": False, "error": result.stderr.strip() or "whosthere failed"}))
        return 0
    print(result.stdout)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
