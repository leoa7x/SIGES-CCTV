#!/usr/bin/env python3
import importlib.util
import ipaddress
import json
import os
import subprocess
import shutil
import sys
from datetime import datetime
from pathlib import Path


def parse_ip_neigh_output(output: str, network: ipaddress.IPv4Network) -> list[dict[str, object]]:
    devices: list[dict[str, object]] = []
    for line in output.splitlines():
        parts = line.split()
        if len(parts) < 5 or parts[1] != "dev":
            continue

        ip = parts[0].strip()
        try:
            ip_obj = ipaddress.ip_address(ip)
        except ValueError:
            continue

        if ip_obj not in network:
            continue

        mac = ""
        if "lladdr" in parts:
            lladdr_index = parts.index("lladdr")
            if lladdr_index + 1 < len(parts):
                mac = parts[lladdr_index + 1].strip().lower()

        devices.append({
            "ip": ip,
            "mac": mac,
            "hostname": "",
            "vendor": "Unknown" if mac else "",
            "last_seen": datetime.now().isoformat(),
            "response_time": None,
        })

    return devices


def merge_devices(primary_devices: list[dict[str, object]], supplemental_devices: list[dict[str, object]]) -> list[dict[str, object]]:
    merged: dict[str, dict[str, object]] = {}

    for device in primary_devices:
        ip = str(device.get("ip", "")).strip()
        if ip:
            merged[ip] = dict(device)

    for device in supplemental_devices:
        ip = str(device.get("ip", "")).strip()
        if not ip:
            continue

        existing = merged.get(ip)
        if not existing:
            merged[ip] = dict(device)
            continue

        existing["mac"] = existing.get("mac") or device.get("mac", "")
        existing["hostname"] = existing.get("hostname") or device.get("hostname", "")
        existing["vendor"] = existing.get("vendor") or device.get("vendor", "")
        existing["response_time"] = existing.get("response_time") or device.get("response_time")
        existing["last_seen"] = device.get("last_seen") or existing.get("last_seen")

    return sorted(merged.values(), key=lambda device: tuple(int(part) for part in str(device["ip"]).split(".")))


def get_missing_ips_for_targeted_probe(primary_devices: list[dict[str, object]], supplemental_devices: list[dict[str, object]]) -> list[str]:
    primary_ips = {str(device.get("ip", "")).strip() for device in primary_devices if str(device.get("ip", "")).strip()}
    missing_ips: list[str] = []

    for device in supplemental_devices:
        ip = str(device.get("ip", "")).strip()
        if ip and ip not in primary_ips and ip not in missing_ips:
            missing_ips.append(ip)

    return missing_ips


def run_ip_neigh_scan(cidr: str) -> list[dict[str, object]]:
    try:
        network = ipaddress.ip_network(cidr, strict=False)
    except ValueError:
        return []

    try:
        result = subprocess.run(["ip", "neigh", "show"], capture_output=True, text=True, check=False)
    except OSError:
        return []

    if result.returncode != 0:
        return []

    return parse_ip_neigh_output(result.stdout, network)


def run_targeted_nmap(ip: str) -> dict[str, object] | None:
    try:
        result = subprocess.run(["nmap", "-Pn", "-oX", "-", ip], capture_output=True, text=True, timeout=60, check=False)
    except (subprocess.TimeoutExpired, OSError):
        return None

    if result.returncode != 0:
        return None

    if '<status state="up"' not in result.stdout:
        return None

    hostname = ""
    marker = '<hostname name="'
    start = result.stdout.find(marker)
    if start != -1:
        start += len(marker)
        end = result.stdout.find('"', start)
        hostname = result.stdout[start:end] if end != -1 else ""

    return {
        "ip": ip,
        "mac": "",
        "hostname": hostname,
        "vendor": "",
        "last_seen": datetime.now().isoformat(),
        "response_time": None,
    }


def enrich_scan_result(cidr: str, result: dict[str, object]) -> dict[str, object]:
    devices = result.get("devices")
    if not isinstance(devices, list):
        return result

    normalized_devices = [device for device in devices if isinstance(device, dict)]
    neigh_devices = run_ip_neigh_scan(cidr)
    merged = merge_devices(normalized_devices, neigh_devices)

    targeted_devices: list[dict[str, object]] = []
    for ip in get_missing_ips_for_targeted_probe(normalized_devices, neigh_devices):
        targeted_device = run_targeted_nmap(ip)
        if targeted_device:
            targeted_devices.append(targeted_device)

    if targeted_devices:
        merged = merge_devices(merged, targeted_devices)
        result["scanner"] = "nmap+neighbor-enrichment+targeted-pn"
    elif neigh_devices:
        result["scanner"] = "nmap+neighbor-enrichment"

    result["devices"] = merged
    result["device_count"] = len(merged)
    return result


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
    if result.get("success"):
      result = enrich_scan_result(cidr, result)
    print(json.dumps(result))
    return 0 if result.get("success") else 1


if __name__ == "__main__":
    raise SystemExit(main())
