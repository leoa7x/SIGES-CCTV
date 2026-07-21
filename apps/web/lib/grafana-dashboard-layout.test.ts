import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type DashboardPanel = {
  type: string;
  title?: string;
};

type DashboardJson = {
  uid: string;
  panels: DashboardPanel[];
};

function loadDashboardJson(fileName: string): DashboardJson {
  return JSON.parse(
    readFileSync(
      join(process.cwd(), "grafana", "provisioning", "dashboards", "json", fileName),
      "utf8",
    ),
  ) as DashboardJson;
}

function panelCount(dashboard: DashboardJson, type: string) {
  return dashboard.panels.filter((panel) => panel.type === type).length;
}

test("network command dashboard prioritizes live charts over raw stat tiles", () => {
  const dashboard = loadDashboardJson("network-command-view.json");

  const statPanels = panelCount(dashboard, "stat");
  const timeseriesPanels = panelCount(dashboard, "timeseries");
  const gaugePanels = panelCount(dashboard, "gauge");
  const tablePanels = panelCount(dashboard, "table");

  assert.equal(dashboard.uid, "network-command-view");
  assert.equal(statPanels, 4, "expected four KPI tiles in the top summary row");
  assert.ok(timeseriesPanels >= 1, "expected a primary live traffic chart");
  assert.ok(gaugePanels >= 1, "expected an operational health gauge");
  assert.ok(tablePanels >= 1, "expected a bottom operational status table");
});

test("node observability dashboard uses multiple live charts instead of mostly numbers", () => {
  const dashboard = loadDashboardJson("node-observability.json");

  const statPanels = panelCount(dashboard, "stat");
  const timeseriesPanels = panelCount(dashboard, "timeseries");
  const barPanels = panelCount(dashboard, "barchart");

  assert.equal(dashboard.uid, "node-observability");
  assert.ok(timeseriesPanels >= 2, "expected traffic and activity time-series panels");
  assert.ok(barPanels >= 2, "expected ranked protocol/destination bar charts");
  assert.ok(timeseriesPanels + barPanels > statPanels, "expected chart-heavy node observability layout");
});
