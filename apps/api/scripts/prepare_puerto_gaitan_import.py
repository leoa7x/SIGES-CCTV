#!/usr/bin/env python3
"""Create a non-destructive, reviewable staging manifest for Puerto Gaitán.

The script reads the source folder but never connects to SIGES/PostgreSQL. It
also intentionally excludes camera passwords: production import will receive
the declared credential through a protected environment variable and encrypt it
through the API's CameraSecretService.
"""

from __future__ import annotations

import argparse
import csv
import ipaddress
import json
import re
import sys
from collections import Counter
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
REL_NS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
CAMERA_SPEAKERS = {"172.16.45.199", "172.16.45.102", "172.16.45.108"}
CMC_BIOMETRICS = {"172.16.45.205", "172.16.45.206"}
KNOWN_OFFLINE = {"172.16.45.109", "172.16.45.110", "172.16.45.111"}


def cell_column(reference: str) -> int:
    value = 0
    for letter in "".join(char for char in reference if char.isalpha()):
        value = value * 26 + ord(letter) - 64
    return value - 1


def xlsx_sheets(path: Path) -> dict[str, list[dict[int, str]]]:
    """Read the small source workbook without adding an Excel dependency."""
    with ZipFile(path) as workbook:
        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in workbook.namelist():
            root = ET.fromstring(workbook.read("xl/sharedStrings.xml"))
            shared_strings = [
                "".join(node.text or "" for node in item.iter(NS + "t"))
                for item in root.findall(NS + "si")
            ]
        rels = ET.fromstring(workbook.read("xl/_rels/workbook.xml.rels"))
        targets = {item.attrib["Id"]: item.attrib["Target"] for item in rels}
        root = ET.fromstring(workbook.read("xl/workbook.xml"))
        result: dict[str, list[dict[int, str]]] = {}
        for sheet in root.findall(NS + "sheets/" + NS + "sheet"):
            target = targets[sheet.attrib[REL_NS + "id"]]
            xml = ET.fromstring(workbook.read("xl/" + target))
            rows: list[dict[int, str]] = []
            for row in xml.findall(".//" + NS + "sheetData/" + NS + "row"):
                output: dict[int, str] = {}
                for cell in row.findall(NS + "c"):
                    raw = cell.find(NS + "v")
                    value = "" if raw is None else raw.text or ""
                    if cell.attrib.get("t") == "s" and value:
                        value = shared_strings[int(value)]
                    output[cell_column(cell.attrib["r"])] = value.strip()
                rows.append(output)
            result[sheet.attrib["name"]] = rows
    return result


def valid_ip(value: str) -> bool:
    try:
        ipaddress.ip_address(value.strip())
        return True
    except ValueError:
        return False


def post_number(value: str) -> int | None:
    match = re.search(r"(?:poste|post|p)\s*#?\s*(\d{1,2})\b", value, re.I)
    return int(match.group(1)) if match else None


def load_coordinates(path: Path) -> tuple[dict[int, dict], dict]:
    coordinates: dict[int, dict] = {}
    cmc: dict | None = None
    with path.open(encoding="utf-8-sig", newline="") as source:
        for row in csv.DictReader(source):
            label = row["Poste"].strip()
            point = {"label": label, "lng": float(row["Longitud"]), "lat": float(row["Latitud"])}
            number = post_number(label)
            if number is None and "centro de mando" in label.lower():
                cmc = point
            elif number is not None:
                coordinates[number] = point
    if cmc is None:
        raise ValueError("No CMC coordinate found")
    return coordinates, cmc


def load_evs(path: Path) -> dict[str, dict]:
    entries: dict[str, dict] = {}
    with path.open(encoding="utf-8-sig", newline="") as source:
        for row in csv.DictReader(source):
            ip = row.get("Dirección", "").strip()
            if valid_ip(ip):
                entries[ip] = {
                    "model": row.get("Tipo de Producto", "").strip() or None,
                    "serial": row.get("SN", "").strip() or None,
                    "displayName": row.get("Nom. Cámara", "").strip() or None,
                    "servicePort": row.get("Puerto", "").strip() or None,
                }
    return entries


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=Path("DATOS CCTV PUERTO GAITAN SIGES LAN"))
    parser.add_argument("--output", type=Path, default=Path("import-staging/puerto-gaitan-preflight.json"))
    arguments = parser.parse_args()
    source = arguments.source
    sheets = xlsx_sheets(source / "Listado de direccionamiento IP equipos puntos de camaras CCTV Gaitan.xlsx")
    coordinates, cmc_coordinate = load_coordinates(source / "postes_coordenadas_decimal.csv")
    evs = load_evs(source / "EVS.csv")

    current_post: int | None = None
    current_location = ""
    nodes: dict[int, dict] = {}
    cameras: list[dict] = []
    assets: list[dict] = []
    seen_ips: set[str] = set()
    exceptions: list[dict] = []

    for row in sheets["IP CAMARAS"][2:]:
        item, point, location, equipment, ip = (row.get(index, "").strip() for index in range(5))
        if item:
            current_post = post_number(point) or int(item)
            current_location = location
        if not valid_ip(ip):
            continue
        if ip in seen_ips:
            exceptions.append({"type": "DUPLICATE_IP", "ip": ip, "detail": "Repeated in IP CAMARAS"})
            continue
        seen_ips.add(ip)
        if current_post is None:
            exceptions.append({"type": "MISSING_POST", "ip": ip, "detail": equipment})
            continue
        coordinate = coordinates.get(current_post)
        if coordinate is None:
            exceptions.append({"type": "MISSING_COORDINATE", "ip": ip, "post": current_post})
            continue
        node = nodes.setdefault(current_post, {
            "code": f"PG-POSTE-{current_post:03d}",
            "name": f"Poste {current_post} — {current_location.title()}",
            "lat": coordinate["lat"], "lng": coordinate["lng"],
            "sourceLabel": coordinate["label"], "switch": None,
        })
        if equipment.lower() == "switch":
            node["switch"] = {"ip": ip, "sourceType": "NETWORK_SWITCH"}
            continue
        if ip in CAMERA_SPEAKERS or "altavoz" in equipment.lower():
            assets.append({"scope": "NODE", "post": current_post, "ip": ip, "assetType": "IP_SPEAKER", "name": f"Altavoz IP — Poste {current_post}"})
            if not ip.startswith("172.16.45."):
                exceptions.append({"type": "ASSET_OUTSIDE_CMC_SUBNET", "ip": ip, "post": current_post, "detail": "IP speaker is outside 172.16.45.0/24; retain it but validate routing during commissioning"})
            continue

        inventory = evs.get(ip, {})
        camera = {
            "code": f"PG-CAM-{len(cameras) + 1:03d}",
            "post": current_post,
            "nodeCode": node["code"],
            "name": f"Poste {current_post} — {current_location.title()} — {equipment}",
            "ip": ip,
            "cameraType": equipment,
            "model": inventory.get("model"),
            "serial": inventory.get("serial"),
            "servicePort": inventory.get("servicePort"),
            "operativeState": "OFFLINE" if ip in KNOWN_OFFLINE else "PENDING_MONITORING",
            "streamPolicy": "DISCOVER_ONVIF_THEN_USE_LOW_SUBSTREAM",
            "previewEnabled": False,
            "credentialSource": "SIGES_CAMERA_DEFAULT_PASSWORD",
        }
        cameras.append(camera)
        if not camera["model"]:
            exceptions.append({"type": "MISSING_EVS_MODEL", "ip": ip, "post": current_post, "detail": "Needs ONVIF discovery during commissioning"})

    # Assets supplied outside the pole workbook; user classified them explicitly.
    for ip, label in (("172.16.45.205", "Lector biométrico entrada CMC"), ("172.16.45.206", "Lector biométrico rack CMC")):
        inventory = evs.get(ip, {})
        assets.append({"scope": "CMC", "ip": ip, "assetType": "BIOMETRIC_READER", "name": label, "model": inventory.get("model"), "serial": inventory.get("serial")})

    expected_posts = set(range(1, 49))
    missing_posts = sorted(expected_posts - set(nodes))
    if missing_posts:
        exceptions.append({"type": "MISSING_POSTS", "detail": missing_posts})
    if len(cameras) != 121:
        exceptions.append({"type": "UNEXPECTED_CAMERA_COUNT", "detail": f"Expected 121 after approved classifications; found {len(cameras)}"})

    manifest = {
        "mode": "PREVIEW_ONLY_NO_DATABASE_WRITE",
        "project": {"name": "CONTRATO 1445 DE 2024", "client": "ALCALDIA PUERTO GAITAN", "startDate": "2026-09-01"},
        "monitoringCenter": {
            "name": "CCTV ALCALDIA PUERTO GAITAN", "scanSubnetCidr": "172.16.45.0/24",
            "lat": cmc_coordinate["lat"], "lng": cmc_coordinate["lng"],
        },
        "deployment": {"sigesServerIp": "172.16.45.212"},
        "nodes": [nodes[number] for number in sorted(nodes)],
        "cameras": cameras,
        "assets": assets,
        "summary": {
            "nodes": len(nodes), "switches": sum(node["switch"] is not None for node in nodes.values()),
            "cameras": len(cameras), "knownOfflineCameras": sum(camera["operativeState"] == "OFFLINE" for camera in cameras),
            "nodeSpeakers": sum(asset["assetType"] == "IP_SPEAKER" for asset in assets),
            "cmcBiometrics": sum(asset["assetType"] == "BIOMETRIC_READER" for asset in assets),
            "cameraModelsMissingFromEVS": sum(camera["model"] is None for camera in cameras),
            "exceptions": len(exceptions),
        },
        "exceptions": exceptions,
        "security": {"passwordsStored": False, "cameraCredentialInput": "SIGES_CAMERA_DEFAULT_PASSWORD at import time only"},
    }
    arguments.output.parent.mkdir(parents=True, exist_ok=True)
    arguments.output.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(manifest["summary"], ensure_ascii=False))
    print(f"Preview written to {arguments.output}")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Preflight failed: {error}", file=sys.stderr)
        raise SystemExit(1)
