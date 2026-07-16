import json
import os
import subprocess
import sys
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("run_whosthere_scan.py")


class WhosThereWrapperTests(unittest.TestCase):
    def run_wrapper(self, node_env: str) -> dict:
        environment = os.environ.copy()
        environment["NODE_ENV"] = node_env
        environment.pop("WHOSTHERE_CMD", None)
        result = subprocess.run(
            [sys.executable, str(SCRIPT), "10.10.0.0/24", "10.10.0.1"],
            capture_output=True,
            check=True,
            env=environment,
            text=True,
        )
        return json.loads(result.stdout)

    def test_production_requires_a_whosthere_command(self) -> None:
        result = self.run_wrapper("production")

        self.assertEqual(result["success"], False)
        self.assertIn("WHOSTHERE_CMD", result["error"])

    def test_non_production_uses_the_development_fallback(self) -> None:
        result = self.run_wrapper("development")

        self.assertEqual(result["success"], True)
        self.assertEqual(len(result["devices"]), 1)


if __name__ == "__main__":
    unittest.main()
