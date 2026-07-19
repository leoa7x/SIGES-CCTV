import assert from "node:assert/strict";
import test from "node:test";

import { normalizeDiscoveryCommandTemplate } from "./discovery-command";

test("normalizeDiscoveryCommandTemplate rewrites vendored host script paths to the container path when needed", () => {
  const template = "python3 /home/ingleonardosanchez/SIGES-CCTV/apps/api/scripts/run_lan_orangutan_scan.py {target} {ip}";

  const normalized = normalizeDiscoveryCommandTemplate(template, (path) =>
    path === "/app/apps/api/scripts/run_lan_orangutan_scan.py",
  );

  assert.equal(
    normalized,
    "python3 /app/apps/api/scripts/run_lan_orangutan_scan.py {target} {ip}",
  );
});

test("normalizeDiscoveryCommandTemplate leaves the configured path alone when it already exists", () => {
  const template = "python3 /home/ingleonardosanchez/SIGES-CCTV/apps/api/scripts/run_lan_orangutan_scan.py {target}";

  const normalized = normalizeDiscoveryCommandTemplate(template, (path) =>
    path === "/home/ingleonardosanchez/SIGES-CCTV/apps/api/scripts/run_lan_orangutan_scan.py",
  );

  assert.equal(normalized, template);
});
