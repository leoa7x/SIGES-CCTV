# Grafana NOC Dashboard Redesign Design

Date: 2026-07-20
Owner: Codex
Status: Draft for review

## Goal

Convert the current Grafana embeds from number-heavy operational summaries into visually active NOC dashboards that feel live, while keeping SIGES itself sober and action-oriented.

This redesign covers only the two existing provisioned Grafana dashboards:

- `network-command-view`
- `node-observability`

and the two current SIGES views that embed them:

- `/dashboard`
- `/monitoring/network`

## Desired User Experience

SIGES should remain the place where operators:

- see current operational state
- read alerts
- trigger actions
- navigate nodes, CMCs, routes, and reports

Grafana should become the place where operators:

- watch traffic move over time
- see outages and recoveries in time windows
- inspect protocol and destination distribution
- identify which node or route is currently noisier or riskier

The target visual result is a real NOC feel:

- one main Grafana canvas per view
- line and area charts
- bar panels
- ranked tables only where they add operational value
- live refresh cadence
- dark, dense, operator-oriented layout

## Scope

### In scope

- Redesign `grafana/provisioning/dashboards/json/network-command-view.json`
- Redesign `grafana/provisioning/dashboards/json/node-observability.json`
- Keep one Grafana embed in `/dashboard`
- Keep one Grafana embed in `/monitoring/network`
- Pass dashboard variables cleanly from SIGES to Grafana
- Preserve the existing backend embed descriptor pattern

### Out of scope

- Creating brand-new backend observability endpoints
- Replacing SIGES live state logic with Grafana
- Changing alert generation rules
- Introducing extra dashboards beyond the two existing ones
- Moving historical reports into Grafana

## Approaches Considered

### Approach 1: Keep multiple small embeds in each page

Pros:

- easy to compose from SIGES
- granular per-section loading

Cons:

- feels fragmented
- looks more like an executive dashboard than a NOC
- duplicates chrome and iframe overhead

### Approach 2: One large Grafana dashboard per page

Pros:

- strongest NOC feel
- centralizes visual logic in Grafana
- reduces fragmentation
- easier to tune as an operational surface

Cons:

- requires more careful dashboard composition
- more dependence on Grafana JSON quality

### Approach 3: Build custom animated charts in React instead of Grafana

Pros:

- full control over look and motion

Cons:

- duplicates Grafana capability
- more code, more maintenance
- weaker reuse of current observability stack

## Recommendation

Use Approach 2.

SIGES should embed one strong dashboard per context:

- `/dashboard` gets the global NOC dashboard
- `/monitoring/network` gets the contextual node dashboard

This best matches the user goal of “a real NOC, not a panel with numbers”.

## Target Dashboard Designs

## 1. Global NOC Dashboard (`network-command-view`)

Purpose:
Show operational health and traffic behavior for the whole monitored network in a single live canvas.

Layout:

- Top row:
  - nodes currently represented in observability
  - active alerts
  - pending discovery backlog
  - active hosts or flows
- Main middle row:
  - global traffic timeseries (`bytes in/out`) with visually dominant line or area chart
- Secondary middle row:
  - outages / alert volume by time bucket as bar chart
  - protocol distribution or destination ranking
- Bottom row:
  - operational priority table for nodes with highest alert pressure

Expected panel types:

- `stat` only for a compact top strip
- `timeseries` for traffic and availability trend
- `barchart` or `timeseries` in bar mode for alert/outage movement
- `table` only for ranked operator focus

What should feel “alive”:

- traffic line/area movement
- alert volume bars changing with refresh
- clear ranking of affected nodes

## 2. Node Observability Dashboard (`node-observability`)

Purpose:
Show the selected node as a live operational asset, not just a static summary.

Layout:

- Top row:
  - node identity
  - active alerts
  - latest active hosts / active flows
- Main middle row:
  - node traffic timeseries (`bytes in/out`)
- Secondary middle row:
  - active hosts over time
  - active flows over time
- Lower row:
  - top protocols by byte volume
  - top destinations by byte volume
- Bottom row:
  - active alerts table

Expected panel types:

- compact `stat` strip
- multiple `timeseries` panels
- `barchart` for protocol and destination ranking
- `table` for current active alerts

What should feel “alive”:

- traffic changing in lines
- host/flow activity moving in time
- distributions changing as snapshots update

## SIGES Embedding Changes

### `/dashboard`

Keep:

- top KPI cards in SIGES
- incident list in SIGES

Change:

- replace the current simple Grafana section with a single global NOC embed that occupies more visual weight

### `/monitoring/network`

Keep:

- current operational controls
- node selection and inventory sections
- alerts and discovery actions

Change:

- use only one main Grafana embed in the observability section
- when a node is selected, that embed should point to `node-observability`
- if a future “no node selected” state is desired, it can fall back to the global view, but for the current page flow the selected node is the primary context

## Data and Variables

The redesign should stay within the current data contract:

- `network-command-view` can already receive `centerId` and `routeId`
- `node-observability` already receives `nodeId`

No new variable protocol is required for the first pass.

Queries should be adjusted only inside the dashboard JSON definitions, using the already provisioned PostgreSQL datasource and the existing views such as:

- `telemetry_global_health_view`
- `telemetry_node_timeseries_view`
- `telemetry_node_summary_view`
- `telemetry_alerts_view`

If a desired panel cannot be produced from current views, the panel should be omitted from this pass rather than inventing fake or placeholder visuals.

## Refresh and Motion

Grafana should supply the “movement” through:

- dashboard refresh cadence
- timeseries redraw
- bar updates
- hover tooltips and crosshair behavior

SIGES itself should remain visually restrained:

- no heavy custom charting
- no competing animated widgets
- only light state emphasis where needed

Recommended refresh:

- `15s` to `30s` depending on panel cost

## Risks

### Risk: not enough time-series richness in current SQL views

Mitigation:

- prioritize traffic, active hosts, active flows, and ranked alerts first
- avoid decorative panels with weak signal

### Risk: overloading the screen

Mitigation:

- use one dominant traffic panel
- limit top strip stats
- keep one ranked table only where operationally necessary

### Risk: duplicated visual meaning between SIGES and Grafana

Mitigation:

- SIGES = current state and actions
- Grafana = trends, motion, distributions

## Verification

Success means:

- `/dashboard` feels like a global NOC console instead of a KPI board
- `/monitoring/network` feels like a live technical observability view for the selected node
- users can see movement through lines, bars, and changing ranked panels
- no mock or placeholder charts are introduced
- embed routing remains stable and current pages continue to load cleanly

