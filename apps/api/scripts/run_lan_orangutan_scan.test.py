import ipaddress
import json
import tempfile
import unittest
from pathlib import Path

import run_lan_orangutan_scan as script


class LanOrangutanWrapperTests(unittest.TestCase):
    def test_parse_ip_neigh_output_filters_to_target_subnet(self) -> None:
        devices = script.parse_ip_neigh_output(
            "\n".join([
                "172.16.45.200 dev eth0 lladdr d4:f5:ef:8a:9d:e4 REACHABLE",
                "172.16.45.209 dev eth0 lladdr d8:43:ae:e2:6f:7a REACHABLE",
                "192.168.1.1 dev wlan0 lladdr 74:24:9f:cc:3b:61 REACHABLE",
            ]),
            ipaddress.ip_network("172.16.45.0/24"),
        )

        self.assertEqual([device["ip"] for device in devices], ["172.16.45.200", "172.16.45.209"])
        self.assertEqual(devices[0]["mac"], "d4:f5:ef:8a:9d:e4")

    def test_merge_devices_prefers_existing_hostname_and_new_mac(self) -> None:
        merged = script.merge_devices(
            [
                {
                    "ip": "172.16.45.1",
                    "mac": "",
                    "hostname": "_gateway",
                    "vendor": "",
                    "last_seen": "2026-07-16T00:00:00",
                    "response_time": None,
                },
            ],
            [
                {
                    "ip": "172.16.45.1",
                    "mac": "04:f4:1c:85:f5:2a",
                    "hostname": "",
                    "vendor": "Unknown",
                    "last_seen": "2026-07-16T00:00:01",
                    "response_time": None,
                },
                {
                    "ip": "172.16.45.200",
                    "mac": "d4:f5:ef:8a:9d:e4",
                    "hostname": "",
                    "vendor": "Unknown",
                    "last_seen": "2026-07-16T00:00:02",
                    "response_time": None,
                },
            ],
        )

        self.assertEqual([device["ip"] for device in merged], ["172.16.45.1", "172.16.45.200"])
        self.assertEqual(merged[0]["hostname"], "_gateway")
        self.assertEqual(merged[0]["mac"], "04:f4:1c:85:f5:2a")

    def test_enrich_scan_result_only_targets_neighbor_ips_missing_from_primary_scan(self) -> None:
        calls: list[str] = []
        original_run_ip_neigh_scan = script.run_ip_neigh_scan
        original_run_targeted_nmap = script.run_targeted_nmap
        try:
            script.run_ip_neigh_scan = lambda _cidr: [  # type: ignore[assignment]
                {
                    "ip": "172.16.45.1",
                    "mac": "04:f4:1c:85:f5:2a",
                    "hostname": "",
                    "vendor": "Unknown",
                    "last_seen": "2026-07-16T00:00:01",
                    "response_time": None,
                },
                {
                    "ip": "172.16.45.200",
                    "mac": "d4:f5:ef:8a:9d:e4",
                    "hostname": "",
                    "vendor": "Unknown",
                    "last_seen": "2026-07-16T00:00:02",
                    "response_time": None,
                },
            ]

            def fake_targeted_nmap(ip: str) -> dict[str, object] | None:
                calls.append(ip)
                return {
                    "ip": ip,
                    "mac": "",
                    "hostname": "rdp-host",
                    "vendor": "",
                    "last_seen": "2026-07-16T00:00:03",
                    "response_time": None,
                }

            script.run_targeted_nmap = fake_targeted_nmap  # type: ignore[assignment]

            result = script.enrich_scan_result(
                "172.16.45.0/24",
                {
                    "success": True,
                    "scanner": "nmap",
                    "device_count": 1,
                    "devices": [
                        {
                            "ip": "172.16.45.1",
                            "mac": "",
                            "hostname": "_gateway",
                            "vendor": "",
                            "last_seen": "2026-07-16T00:00:00",
                            "response_time": None,
                        },
                    ],
                },
            )
        finally:
            script.run_ip_neigh_scan = original_run_ip_neigh_scan  # type: ignore[assignment]
            script.run_targeted_nmap = original_run_targeted_nmap  # type: ignore[assignment]

        self.assertEqual(calls, ["172.16.45.200"])
        self.assertEqual(result["device_count"], 2)
        self.assertEqual(result["scanner"], "nmap+neighbor-enrichment+targeted-pn")
        self.assertEqual([device["ip"] for device in result["devices"]], ["172.16.45.1", "172.16.45.200"])
        self.assertEqual(result["devices"][1]["hostname"], "rdp-host")

    def test_lookup_vendor_by_mac_prefers_longest_prefix_from_local_index(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            index_path = Path(tmpdir) / "mac_vendor_index.json"
            index_path.write_text(json.dumps({
                "D4F5EF": "Generic Vendor",
                "D4F5EF8A9": "Specific Vendor",
            }), encoding="utf-8")

            vendor = script.lookup_vendor_by_mac("d4:f5:ef:8a:9d:e4", script.load_vendor_index(index_path))

        self.assertEqual(vendor, "Specific Vendor")

    def test_enrich_scan_result_populates_vendor_from_local_index(self) -> None:
        original_run_ip_neigh_scan = script.run_ip_neigh_scan
        original_load_vendor_index = script.load_vendor_index
        try:
            script.run_ip_neigh_scan = lambda _cidr: [  # type: ignore[assignment]
                {
                    "ip": "172.16.45.200",
                    "mac": "d4:f5:ef:8a:9d:e4",
                    "hostname": "",
                    "vendor": "",
                    "last_seen": "2026-07-16T00:00:02",
                    "response_time": None,
                },
            ]
            script.load_vendor_index = lambda _path=None: {"D4F5EF": "Test Vendor"}  # type: ignore[assignment]

            result = script.enrich_scan_result(
                "172.16.45.0/24",
                {
                    "success": True,
                    "scanner": "nmap",
                    "device_count": 0,
                    "devices": [],
                },
            )
        finally:
            script.run_ip_neigh_scan = original_run_ip_neigh_scan  # type: ignore[assignment]
            script.load_vendor_index = original_load_vendor_index  # type: ignore[assignment]

        self.assertEqual(result["devices"][0]["vendor"], "Test Vendor")


if __name__ == "__main__":
    unittest.main()
