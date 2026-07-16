#!/usr/bin/env python3
import csv
import json
import sys
from pathlib import Path
from urllib.request import urlopen

SOURCE_URLS = [
    "https://raw.githubusercontent.com/uxmansarwar/mac-address-vendor-database/master/data/raw/ma-l.csv",
    "https://raw.githubusercontent.com/uxmansarwar/mac-address-vendor-database/master/data/raw/ma-m.csv",
    "https://raw.githubusercontent.com/uxmansarwar/mac-address-vendor-database/master/data/raw/ma-s.csv",
    "https://raw.githubusercontent.com/uxmansarwar/mac-address-vendor-database/master/data/raw/cid.csv",
    "https://raw.githubusercontent.com/uxmansarwar/mac-address-vendor-database/master/data/raw/iab.csv",
]


def normalize_prefix(prefix: str) -> str:
    return "".join(character for character in prefix.upper() if character in "0123456789ABCDEF")


def read_rows(url: str) -> list[dict[str, str]]:
    with urlopen(url) as response:
        text = response.read().decode("utf-8-sig")
    return list(csv.DictReader(text.splitlines()))


def build_index() -> dict[str, str]:
    index: dict[str, str] = {}
    for url in SOURCE_URLS:
        for row in read_rows(url):
            prefix = normalize_prefix(row.get("Assignment", ""))
            vendor = (row.get("Organization Name") or "").strip()
            if not prefix or not vendor:
                continue
            index[prefix] = vendor
    return dict(sorted(index.items()))


def main() -> int:
    output_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent / "data" / "mac_vendor_index.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(build_index(), ensure_ascii=True, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(output_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
