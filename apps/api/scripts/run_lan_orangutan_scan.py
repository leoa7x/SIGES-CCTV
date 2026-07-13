#!/usr/bin/env python3
import importlib.util
import json
import os
import shutil
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) < 2:
      print(json.dumps({"success": False, "error": "Usage: run_lan_orangutan_scan.py <network_cidr>"}))
      return 1

    cidr = sys.argv[1]
    repo_root = Path(__file__).resolve().parents[3]
    orangutan_home = Path(os.environ.get("LAN_ORANGUTAN_HOME", repo_root / "tools" / "LAN-Orangutan"))
    scan_py = orangutan_home / "scanner" / "scan.py"
    if not scan_py.exists():
      print(json.dumps({"success": False, "error": f"LAN-Orangutan scanner not found at {scan_py}"}))
      return 1

    if shutil.which("nmap") is None and shutil.which("arp-scan") is None:
      print(json.dumps({"success": False, "error": "Neither nmap nor arp-scan is installed"}))
      return 1

    runtime_dir = Path("/tmp/siges-lan-orangutan")
    runtime_dir.mkdir(parents=True, exist_ok=True)

    spec = importlib.util.spec_from_file_location("lan_orangutan_scan", scan_py)
    if spec is None or spec.loader is None:
      print(json.dumps({"success": False, "error": "Could not load LAN-Orangutan scanner"}))
      return 1

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    module.STATE_FILE = str(runtime_dir / "scan_state.json")
    module.DEVICES_FILE = str(runtime_dir / "devices.json")
    module.CONFIG_FILE = str(runtime_dir / "config.ini")

    result = module.scan_network(cidr)
    print(json.dumps(result))
    return 0 if result.get("success") else 1


if __name__ == "__main__":
    raise SystemExit(main())
