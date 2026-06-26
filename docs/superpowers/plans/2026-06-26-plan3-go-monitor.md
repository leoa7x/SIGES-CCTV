# Go Monitor Daemon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `apps/monitor` — a Go daemon that polls ICMP/SNMP/ONVIF across all registered devices and reports state changes to the NestJS API via `POST /internal/state-change`.

**Architecture:** A single binary reads devices from `GET /internal/devices`, seeds a thread-safe state cache, then runs three concurrent polling loops (ICMP every 30 s, SNMP every 5 min, ONVIF every 2 min). Each loop independently probes its devices; when a device's state changes it calls `POST /internal/state-change` and updates the cache. A separate goroutine refreshes the device list from the API every 60 s so new devices are picked up without restarting.

**Tech Stack:** Go 1.22, `github.com/go-ping/ping` (ICMP), `github.com/gosnmp/gosnmp` (SNMP v2c), `net/http` + `encoding/xml` (ONVIF HTTP probe), standard `encoding/json`, `sync`, `time`.

## Global Constraints

- Module path: `siges-monitor` (in `go.mod`)
- Go version: `go 1.22`
- API base URL from env `API_URL` (default `http://localhost:4001`)
- Bearer token from env `MONITOR_API_TOKEN` — must never be hardcoded; if empty at startup, `log.Fatal`
- SNMP community from env `SNMP_COMMUNITY` (default `public`); per-device `snmpCommunity` field overrides when non-empty
- Poll intervals from env: `ICMP_INTERVAL` (default `30s`), `SNMP_INTERVAL` (default `5m`), `ONVIF_INTERVAL` (default `2m`), `DEVICE_REFRESH_INTERVAL` (default `60s`) — parsed with `time.ParseDuration`
- ICMP: use `go-ping` with `SetPrivileged(false)` (UDP echo, no root required)
- SNMP: v2c, GET OID `1.3.6.1.2.1.1.3.0` (sysUpTime), timeout 3 s, 1 retry
- ONVIF probe: HTTP GET `http://{ip}/onvif/device_service`, timeout 5 s; any HTTP response (even 4xx/5xx) counts as reachable
- State values (exact strings, match Prisma enums): `"ONLINE"`, `"OFFLINE"`, `"DEGRADED"`, `"MAINTENANCE"`
- SNMP failure on a SWITCH that is currently `"ONLINE"` → post `"DEGRADED"` (management plane down, device still pinging); if SNMP passes on a `"DEGRADED"` device → post `"ONLINE"`
- ICMP and ONVIF failure → `"OFFLINE"`; success → `"ONLINE"`
- git author: `leoa7x` / `leo.sanchez@thecicorp.com`
- All `go test` must pass; run from `apps/monitor/` with `go test ./...`

---

## File Map

```
apps/monitor/
  go.mod
  main.go                    entrypoint: load config, build runner, run
  config/
    config.go                Config struct + Load() from env
    config_test.go
  client/
    api.go                   Device struct; Client.GetDevices(), Client.PostStateChange()
    api_test.go
  device/
    device.go                StateCache: thread-safe map[id]state
    device_test.go
  poller/
    icmp.go                  ProbeICMP(ip string, timeout time.Duration) bool
    icmp_test.go
    snmp.go                  ProbeSNMP(ip, community string, timeout time.Duration) bool
    snmp_test.go
    onvif.go                 ProbeONVIF(ip string, timeout time.Duration) bool
    onvif_test.go
    runner.go                Runner: starts all 3 poll loops + device-refresh loop
    runner_test.go
```

---

## Task 1: Go module scaffold + Config

**Files:**
- Create: `apps/monitor/go.mod`
- Create: `apps/monitor/main.go`
- Create: `apps/monitor/config/config.go`
- Create: `apps/monitor/config/config_test.go`

**Interfaces:**
- Produces: `config.Config` struct; `config.Load() Config` — used by Tasks 2 and 7

---

- [ ] **Step 1: Initialise Go module**

```bash
cd apps/monitor
go mod init siges-monitor
```

Expected: `apps/monitor/go.mod` created with `module siges-monitor` and `go 1.22`.

- [ ] **Step 2: Write the failing test**

Create `apps/monitor/config/config_test.go`:

```go
package config_test

import (
	"os"
	"testing"
	"time"

	"siges-monitor/config"
)

func TestLoad_defaults(t *testing.T) {
	os.Setenv("MONITOR_API_TOKEN", "secret")
	defer os.Unsetenv("MONITOR_API_TOKEN")

	cfg := config.Load()

	if cfg.APIURL != "http://localhost:4001" {
		t.Errorf("APIURL = %q, want http://localhost:4001", cfg.APIURL)
	}
	if cfg.Token != "secret" {
		t.Errorf("Token = %q, want secret", cfg.Token)
	}
	if cfg.SNMPCommunity != "public" {
		t.Errorf("SNMPCommunity = %q, want public", cfg.SNMPCommunity)
	}
	if cfg.ICMPInterval != 30*time.Second {
		t.Errorf("ICMPInterval = %v, want 30s", cfg.ICMPInterval)
	}
	if cfg.SNMPInterval != 5*time.Minute {
		t.Errorf("SNMPInterval = %v, want 5m", cfg.SNMPInterval)
	}
	if cfg.ONVIFInterval != 2*time.Minute {
		t.Errorf("ONVIFInterval = %v, want 2m", cfg.ONVIFInterval)
	}
	if cfg.DeviceRefreshInterval != 60*time.Second {
		t.Errorf("DeviceRefreshInterval = %v, want 60s", cfg.DeviceRefreshInterval)
	}
}

func TestLoad_customValues(t *testing.T) {
	os.Setenv("API_URL", "http://api:4001")
	os.Setenv("MONITOR_API_TOKEN", "tok123")
	os.Setenv("SNMP_COMMUNITY", "private")
	os.Setenv("ICMP_INTERVAL", "10s")
	defer func() {
		os.Unsetenv("API_URL")
		os.Unsetenv("MONITOR_API_TOKEN")
		os.Unsetenv("SNMP_COMMUNITY")
		os.Unsetenv("ICMP_INTERVAL")
	}()

	cfg := config.Load()

	if cfg.APIURL != "http://api:4001" {
		t.Errorf("APIURL = %q, want http://api:4001", cfg.APIURL)
	}
	if cfg.SNMPCommunity != "private" {
		t.Errorf("SNMPCommunity = %q, want private", cfg.SNMPCommunity)
	}
	if cfg.ICMPInterval != 10*time.Second {
		t.Errorf("ICMPInterval = %v, want 10s", cfg.ICMPInterval)
	}
}

func TestLoad_missingToken_panics(t *testing.T) {
	os.Unsetenv("MONITOR_API_TOKEN")
	defer func() {
		if r := recover(); r == nil {
			t.Error("expected panic when MONITOR_API_TOKEN is empty")
		}
	}()
	config.Load()
}
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd apps/monitor && go test ./config/...
```

Expected: compile error — `config` package not found.

- [ ] **Step 4: Implement config.go**

Create `apps/monitor/config/config.go`:

```go
package config

import (
	"log"
	"os"
	"time"
)

type Config struct {
	APIURL                string
	Token                 string
	SNMPCommunity         string
	ICMPInterval          time.Duration
	SNMPInterval          time.Duration
	ONVIFInterval         time.Duration
	DeviceRefreshInterval time.Duration
}

func Load() Config {
	token := getenv("MONITOR_API_TOKEN", "")
	if token == "" {
		log.Panic("MONITOR_API_TOKEN env var is required")
	}
	return Config{
		APIURL:                getenv("API_URL", "http://localhost:4001"),
		Token:                 token,
		SNMPCommunity:         getenv("SNMP_COMMUNITY", "public"),
		ICMPInterval:          parseDuration("ICMP_INTERVAL", 30*time.Second),
		SNMPInterval:          parseDuration("SNMP_INTERVAL", 5*time.Minute),
		ONVIFInterval:         parseDuration("ONVIF_INTERVAL", 2*time.Minute),
		DeviceRefreshInterval: parseDuration("DEVICE_REFRESH_INTERVAL", 60*time.Second),
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func parseDuration(key string, fallback time.Duration) time.Duration {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		log.Printf("invalid %s=%q, using default %v", key, v, fallback)
		return fallback
	}
	return d
}
```

- [ ] **Step 5: Create minimal main.go**

Create `apps/monitor/main.go`:

```go
package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"

	"siges-monitor/config"
)

func main() {
	cfg := config.Load()
	log.Printf("SIGES Monitor starting (API: %s)", cfg.APIURL)

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	log.Println("Monitor stopped")
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd apps/monitor && go test ./config/...
```

Expected:
```
ok  	siges-monitor/config
```

- [ ] **Step 7: Verify build**

```bash
cd apps/monitor && go build ./...
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git -C /mnt/c/Users/ingel/SIGES-CCTV config user.name "leoa7x"
git -C /mnt/c/Users/ingel/SIGES-CCTV config user.email "leo.sanchez@thecicorp.com"
git -C /mnt/c/Users/ingel/SIGES-CCTV add apps/monitor/
git -C /mnt/c/Users/ingel/SIGES-CCTV commit -m "feat(monitor): scaffold Go module + config"
```

---

## Task 2: API Client

**Files:**
- Create: `apps/monitor/client/api.go`
- Create: `apps/monitor/client/api_test.go`

**Interfaces:**
- Consumes: `config.Config` (APIURL, Token)
- Produces:
  - `client.Device` struct
  - `client.Client` struct with `NewClient(apiURL, token string) *Client`
  - `(*Client).GetDevices() ([]Device, error)`
  - `(*Client).PostStateChange(entityType, entityId, oldState, newState string) error`

---

- [ ] **Step 1: Write the failing tests**

Create `apps/monitor/client/api_test.go`:

```go
package client_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"siges-monitor/client"
)

func TestGetDevices(t *testing.T) {
	devices := []client.Device{
		{ID: "n1", Type: "node", IP: "10.0.0.1", NodeType: "SWITCH", SNMPCommunity: "", State: "ONLINE", CenterID: "c1"},
		{ID: "cam1", Type: "camera", IP: "10.0.0.2", State: "ONLINE", CenterID: "c1"},
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/internal/devices" {
			t.Errorf("unexpected path %s", r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer testtoken" {
			t.Errorf("missing auth header")
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(devices)
	}))
	defer srv.Close()

	c := client.NewClient(srv.URL, "testtoken")
	got, err := c.GetDevices()
	if err != nil {
		t.Fatalf("GetDevices error: %v", err)
	}
	if len(got) != 2 {
		t.Errorf("len = %d, want 2", len(got))
	}
	if got[0].ID != "n1" {
		t.Errorf("got[0].ID = %q, want n1", got[0].ID)
	}
}

func TestGetDevices_httpError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
	}))
	defer srv.Close()

	c := client.NewClient(srv.URL, "bad")
	_, err := c.GetDevices()
	if err == nil {
		t.Error("expected error on 401, got nil")
	}
}

func TestPostStateChange(t *testing.T) {
	var received map[string]string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/internal/state-change" {
			t.Errorf("unexpected path %s", r.URL.Path)
		}
		if r.Method != http.MethodPost {
			t.Errorf("expected POST, got %s", r.Method)
		}
		json.NewDecoder(r.Body).Decode(&received)
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"ok":true}`))
	}))
	defer srv.Close()

	c := client.NewClient(srv.URL, "tok")
	err := c.PostStateChange("node", "n1", "ONLINE", "OFFLINE")
	if err != nil {
		t.Fatalf("PostStateChange error: %v", err)
	}
	if received["entityType"] != "node" {
		t.Errorf("entityType = %q, want node", received["entityType"])
	}
	if received["newState"] != "OFFLINE" {
		t.Errorf("newState = %q, want OFFLINE", received["newState"])
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/monitor && go test ./client/...
```

Expected: compile error — `client` package not found.

- [ ] **Step 3: Implement client/api.go**

Create `apps/monitor/client/api.go`:

```go
package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type Device struct {
	ID            string `json:"id"`
	Type          string `json:"type"`     // "node" | "camera"
	IP            string `json:"ip"`
	MAC           string `json:"mac"`
	NodeType      string `json:"nodeType"` // "SWITCH" | "" etc.
	SNMPCommunity string `json:"snmpCommunity"`
	State         string `json:"state"`
	CenterID      string `json:"centerId"`
}

type Client struct {
	baseURL string
	token   string
	http    *http.Client
}

func NewClient(apiURL, token string) *Client {
	return &Client{
		baseURL: apiURL,
		token:   token,
		http:    &http.Client{Timeout: 10 * time.Second},
	}
}

func (c *Client) GetDevices() ([]Device, error) {
	req, err := http.NewRequest(http.MethodGet, c.baseURL+"/internal/devices", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("GET /internal/devices: %d %s", resp.StatusCode, body)
	}

	var devices []Device
	if err := json.NewDecoder(resp.Body).Decode(&devices); err != nil {
		return nil, err
	}
	return devices, nil
}

func (c *Client) PostStateChange(entityType, entityID, oldState, newState string) error {
	payload := map[string]string{
		"entityType": entityType,
		"entityId":   entityID,
		"oldState":   oldState,
		"newState":   newState,
	}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequest(http.MethodPost, c.baseURL+"/internal/state-change", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("POST /internal/state-change: %d %s", resp.StatusCode, b)
	}
	return nil
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/monitor && go test ./client/...
```

Expected:
```
ok  	siges-monitor/client
```

- [ ] **Step 5: Commit**

```bash
git -C /mnt/c/Users/ingel/SIGES-CCTV add apps/monitor/
git -C /mnt/c/Users/ingel/SIGES-CCTV commit -m "feat(monitor): add API client GetDevices + PostStateChange"
```

---

## Task 3: State Cache

**Files:**
- Create: `apps/monitor/device/device.go`
- Create: `apps/monitor/device/device_test.go`

**Interfaces:**
- Produces:
  - `device.StateCache` struct
  - `NewStateCache() *StateCache`
  - `(*StateCache).Seed(devices []client.Device)`
  - `(*StateCache).Get(id string) (state string, ok bool)`
  - `(*StateCache).Set(id, state string)`
  - `(*StateCache).All() map[string]string` — returns a snapshot copy

---

- [ ] **Step 1: Write the failing tests**

Create `apps/monitor/device/device_test.go`:

```go
package device_test

import (
	"sync"
	"testing"

	"siges-monitor/client"
	"siges-monitor/device"
)

func TestStateCache_SeedAndGet(t *testing.T) {
	cache := device.NewStateCache()
	cache.Seed([]client.Device{
		{ID: "n1", State: "ONLINE"},
		{ID: "cam1", State: "OFFLINE"},
	})

	state, ok := cache.Get("n1")
	if !ok || state != "ONLINE" {
		t.Errorf("Get(n1) = %q, %v; want ONLINE true", state, ok)
	}
	state, ok = cache.Get("cam1")
	if !ok || state != "OFFLINE" {
		t.Errorf("Get(cam1) = %q, %v; want OFFLINE true", state, ok)
	}
	_, ok = cache.Get("missing")
	if ok {
		t.Error("Get(missing) should return ok=false")
	}
}

func TestStateCache_Set(t *testing.T) {
	cache := device.NewStateCache()
	cache.Set("n1", "ONLINE")
	state, ok := cache.Get("n1")
	if !ok || state != "ONLINE" {
		t.Errorf("after Set: Get(n1) = %q, %v", state, ok)
	}
	cache.Set("n1", "OFFLINE")
	state, _ = cache.Get("n1")
	if state != "OFFLINE" {
		t.Errorf("after second Set: Get(n1) = %q, want OFFLINE", state)
	}
}

func TestStateCache_All(t *testing.T) {
	cache := device.NewStateCache()
	cache.Seed([]client.Device{
		{ID: "n1", State: "ONLINE"},
		{ID: "n2", State: "DEGRADED"},
	})
	snap := cache.All()
	if len(snap) != 2 {
		t.Errorf("All() len = %d, want 2", len(snap))
	}
	if snap["n1"] != "ONLINE" {
		t.Errorf("snap[n1] = %q, want ONLINE", snap["n1"])
	}
}

func TestStateCache_Concurrent(t *testing.T) {
	cache := device.NewStateCache()
	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(2)
		go func() {
			defer wg.Done()
			cache.Set("x", "ONLINE")
		}()
		go func() {
			defer wg.Done()
			cache.Get("x")
		}()
	}
	wg.Wait()
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/monitor && go test ./device/...
```

Expected: compile error — `device` package not found.

- [ ] **Step 3: Implement device/device.go**

Create `apps/monitor/device/device.go`:

```go
package device

import (
	"sync"

	"siges-monitor/client"
)

type StateCache struct {
	mu    sync.RWMutex
	state map[string]string
}

func NewStateCache() *StateCache {
	return &StateCache{state: make(map[string]string)}
}

func (c *StateCache) Seed(devices []client.Device) {
	c.mu.Lock()
	defer c.mu.Unlock()
	for _, d := range devices {
		c.state[d.ID] = d.State
	}
}

func (c *StateCache) Get(id string) (string, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	s, ok := c.state[id]
	return s, ok
}

func (c *StateCache) Set(id, state string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.state[id] = state
}

func (c *StateCache) All() map[string]string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	snap := make(map[string]string, len(c.state))
	for k, v := range c.state {
		snap[k] = v
	}
	return snap
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/monitor && go test -race ./device/...
```

Expected:
```
ok  	siges-monitor/device
```

- [ ] **Step 5: Commit**

```bash
git -C /mnt/c/Users/ingel/SIGES-CCTV add apps/monitor/
git -C /mnt/c/Users/ingel/SIGES-CCTV commit -m "feat(monitor): add thread-safe StateCache"
```

---

## Task 4: ICMP Poller

**Files:**
- Create: `apps/monitor/poller/icmp.go`
- Create: `apps/monitor/poller/icmp_test.go`
- Modify: `apps/monitor/go.mod` (add go-ping dependency)

**Interfaces:**
- Produces: `poller.ProbeICMP(ip string, timeout time.Duration) bool`

---

- [ ] **Step 1: Add go-ping dependency**

```bash
cd apps/monitor && go get github.com/go-ping/ping@v1.1.0
```

Expected: `go.mod` and `go.sum` updated.

- [ ] **Step 2: Write the failing tests**

Create `apps/monitor/poller/icmp_test.go`:

```go
package poller_test

import (
	"testing"
	"time"

	"siges-monitor/poller"
)

func TestProbeICMP_localhost(t *testing.T) {
	// 127.0.0.1 should always be reachable
	ok := poller.ProbeICMP("127.0.0.1", 2*time.Second)
	if !ok {
		t.Error("ProbeICMP(127.0.0.1) = false, want true")
	}
}

func TestProbeICMP_unreachable(t *testing.T) {
	// 192.0.2.x is TEST-NET — never assigned, always unreachable
	ok := poller.ProbeICMP("192.0.2.254", 200*time.Millisecond)
	if ok {
		t.Error("ProbeICMP(192.0.2.254) = true, want false")
	}
}

func TestProbeICMP_invalidIP(t *testing.T) {
	ok := poller.ProbeICMP("not-an-ip", 200*time.Millisecond)
	if ok {
		t.Error("ProbeICMP(invalid) should return false")
	}
}
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd apps/monitor && go test ./poller/ -run TestProbeICMP -v
```

Expected: compile error — `poller` package not found.

- [ ] **Step 4: Implement poller/icmp.go**

Create `apps/monitor/poller/icmp.go`:

```go
package poller

import (
	"time"

	probing "github.com/go-ping/ping"
)

func ProbeICMP(ip string, timeout time.Duration) bool {
	pinger, err := probing.NewPinger(ip)
	if err != nil {
		return false
	}
	pinger.Count = 1
	pinger.Timeout = timeout
	pinger.SetPrivileged(false) // UDP echo — no root required

	if err := pinger.Run(); err != nil {
		return false
	}
	return pinger.Statistics().PacketsRecv > 0
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd apps/monitor && go test ./poller/ -run TestProbeICMP -v -timeout 10s
```

Expected:
```
--- PASS: TestProbeICMP_localhost
--- PASS: TestProbeICMP_unreachable
--- PASS: TestProbeICMP_invalidIP
```

- [ ] **Step 6: Commit**

```bash
git -C /mnt/c/Users/ingel/SIGES-CCTV add apps/monitor/
git -C /mnt/c/Users/ingel/SIGES-CCTV commit -m "feat(monitor): add ICMP poller ProbeICMP"
```

---

## Task 5: SNMP Poller

**Files:**
- Create: `apps/monitor/poller/snmp.go`
- Create: `apps/monitor/poller/snmp_test.go`
- Modify: `apps/monitor/go.mod` (add gosnmp dependency)

**Interfaces:**
- Produces: `poller.ProbeSNMP(ip, community string, timeout time.Duration) bool`

---

- [ ] **Step 1: Add gosnmp dependency**

```bash
cd apps/monitor && go get github.com/gosnmp/gosnmp@v1.37.0
```

Expected: `go.mod` and `go.sum` updated.

- [ ] **Step 2: Write the failing tests**

Create `apps/monitor/poller/snmp_test.go`:

```go
package poller_test

import (
	"testing"
	"time"

	"siges-monitor/poller"
)

func TestProbeSNMP_closedPort(t *testing.T) {
	// Port 161 UDP is almost certainly closed on localhost in dev
	// so this should return false
	ok := poller.ProbeSNMP("127.0.0.1", "public", 300*time.Millisecond)
	// We can't assert a specific value since an SNMP agent might be running.
	// Just assert no panic and it returns within timeout.
	_ = ok
}

func TestProbeSNMP_invalidIP(t *testing.T) {
	ok := poller.ProbeSNMP("not-an-ip", "public", 200*time.Millisecond)
	if ok {
		t.Error("ProbeSNMP(invalid IP) should return false")
	}
}

func TestProbeSNMP_unreachableHost(t *testing.T) {
	ok := poller.ProbeSNMP("192.0.2.253", "public", 200*time.Millisecond)
	if ok {
		t.Error("ProbeSNMP(192.0.2.253) = true, want false (unreachable)")
	}
}
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd apps/monitor && go test ./poller/ -run TestProbeSNMP -v
```

Expected: compile error — `ProbeSNMP` not defined.

- [ ] **Step 4: Implement poller/snmp.go**

Create `apps/monitor/poller/snmp.go`:

```go
package poller

import (
	"time"

	"github.com/gosnmp/gosnmp"
)

const sysUpTimeOID = "1.3.6.1.2.1.1.3.0"

func ProbeSNMP(ip, community string, timeout time.Duration) bool {
	g := &gosnmp.GoSNMP{
		Target:    ip,
		Port:      161,
		Community: community,
		Version:   gosnmp.Version2c,
		Timeout:   timeout,
		Retries:   1,
	}
	if err := g.Connect(); err != nil {
		return false
	}
	defer g.Conn.Close()

	result, err := g.Get([]string{sysUpTimeOID})
	if err != nil {
		return false
	}
	return len(result.Variables) > 0 && result.Variables[0].Type != gosnmp.NoSuchObject
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd apps/monitor && go test ./poller/ -run TestProbeSNMP -v -timeout 10s
```

Expected:
```
--- PASS: TestProbeSNMP_closedPort
--- PASS: TestProbeSNMP_invalidIP
--- PASS: TestProbeSNMP_unreachableHost
```

- [ ] **Step 6: Commit**

```bash
git -C /mnt/c/Users/ingel/SIGES-CCTV add apps/monitor/
git -C /mnt/c/Users/ingel/SIGES-CCTV commit -m "feat(monitor): add SNMP poller ProbeSNMP"
```

---

## Task 6: ONVIF Poller

**Files:**
- Create: `apps/monitor/poller/onvif.go`
- Create: `apps/monitor/poller/onvif_test.go`

**Interfaces:**
- Produces: `poller.ProbeONVIF(ip string, timeout time.Duration) bool`

---

- [ ] **Step 1: Write the failing tests**

Create `apps/monitor/poller/onvif_test.go`:

```go
package poller_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"siges-monitor/poller"
)

func TestProbeONVIF_reachable(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	// Extract host:port from test server URL
	addr := strings.TrimPrefix(srv.URL, "http://")
	host := strings.Split(addr, ":")[0]
	_ = host

	// ProbeONVIF expects an IP; use 127.0.0.1 and the server's port
	// We test via a helper that accepts a full URL for testability
	ok := poller.ProbeONVIFURL(srv.URL+"/onvif/device_service", 2*time.Second)
	if !ok {
		t.Error("ProbeONVIFURL(live server) = false, want true")
	}
}

func TestProbeONVIF_4xx_still_reachable(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "bad request", http.StatusBadRequest)
	}))
	defer srv.Close()

	ok := poller.ProbeONVIFURL(srv.URL+"/onvif/device_service", 2*time.Second)
	if !ok {
		t.Error("ProbeONVIFURL(400 response) = false; any HTTP response means device is reachable")
	}
}

func TestProbeONVIF_unreachable(t *testing.T) {
	ok := poller.ProbeONVIFURL("http://192.0.2.252/onvif/device_service", 200*time.Millisecond)
	if ok {
		t.Error("ProbeONVIFURL(unreachable) = true, want false")
	}
}

func TestProbeONVIF_wrapperCallsURL(t *testing.T) {
	// ProbeONVIF(ip, timeout) should construct http://ip/onvif/device_service
	// We can't easily test this without a server on the IP, so just verify
	// it returns false for an IP that's not listening
	ok := poller.ProbeONVIF("192.0.2.251", 200*time.Millisecond)
	if ok {
		t.Error("ProbeONVIF(dead IP) = true, want false")
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/monitor && go test ./poller/ -run TestProbeONVIF -v
```

Expected: compile error — `ProbeONVIF` and `ProbeONVIFURL` not defined.

- [ ] **Step 3: Implement poller/onvif.go**

Create `apps/monitor/poller/onvif.go`:

```go
package poller

import (
	"fmt"
	"net/http"
	"time"
)

func ProbeONVIF(ip string, timeout time.Duration) bool {
	url := fmt.Sprintf("http://%s/onvif/device_service", ip)
	return ProbeONVIFURL(url, timeout)
}

func ProbeONVIFURL(url string, timeout time.Duration) bool {
	c := &http.Client{Timeout: timeout}
	resp, err := c.Get(url)
	if err != nil {
		return false
	}
	resp.Body.Close()
	return true // any HTTP response means the device is reachable
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/monitor && go test ./poller/ -run TestProbeONVIF -v -timeout 10s
```

Expected:
```
--- PASS: TestProbeONVIF_reachable
--- PASS: TestProbeONVIF_4xx_still_reachable
--- PASS: TestProbeONVIF_unreachable
--- PASS: TestProbeONVIF_wrapperCallsURL
```

- [ ] **Step 5: Commit**

```bash
git -C /mnt/c/Users/ingel/SIGES-CCTV add apps/monitor/
git -C /mnt/c/Users/ingel/SIGES-CCTV commit -m "feat(monitor): add ONVIF HTTP poller ProbeONVIF"
```

---

## Task 7: Runner + Wire main.go

**Files:**
- Create: `apps/monitor/poller/runner.go`
- Create: `apps/monitor/poller/runner_test.go`
- Modify: `apps/monitor/main.go`

**Interfaces:**
- Consumes: `config.Config`, `client.Client`, `device.StateCache`, `ProbeICMP`, `ProbeSNMP`, `ProbeONVIF`
- Produces: `poller.Runner` struct; `NewRunner(cfg config.Config, api *client.Client) *Runner`; `(*Runner).Run(ctx context.Context)`

---

**State transition rules (implement exactly):**

| Loop | Device filter | Probe pass | Probe fail |
|---|---|---|---|
| ICMP | all with IP | `→ "ONLINE"` | `→ "OFFLINE"` |
| SNMP | nodes with `nodeType == "SWITCH"` | if current was `"DEGRADED"` → `"ONLINE"`; else no-op | if current `"ONLINE"` → `"DEGRADED"`; else no-op |
| ONVIF | cameras (type == "camera") | `→ "ONLINE"` | `→ "OFFLINE"` |

A state change is only posted (and the cache updated) when newState ≠ currentState.

- [ ] **Step 1: Write the failing tests**

Create `apps/monitor/poller/runner_test.go`:

```go
package poller_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"siges-monitor/client"
	"siges-monitor/config"
	"siges-monitor/poller"
)

func TestRunner_ICMPPostsOfflineOnFailure(t *testing.T) {
	var mu sync.Mutex
	var posted []map[string]string

	// API mock: /internal/devices returns one node; /internal/state-change records calls
	apiSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/internal/devices":
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode([]client.Device{
				// 192.0.2.100 is TEST-NET — unreachable, ICMP will fail
				{ID: "n1", Type: "node", IP: "192.0.2.100", NodeType: "CABINET", State: "ONLINE", CenterID: "c1"},
			})
		case "/internal/state-change":
			var body map[string]string
			json.NewDecoder(r.Body).Decode(&body)
			mu.Lock()
			posted = append(posted, body)
			mu.Unlock()
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(`{"ok":true}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer apiSrv.Close()

	cfg := config.Config{
		APIURL:                apiSrv.URL,
		Token:                 "tok",
		SNMPCommunity:         "public",
		ICMPInterval:          100 * time.Millisecond,
		SNMPInterval:          10 * time.Minute, // not triggered in this test
		ONVIFInterval:         10 * time.Minute, // not triggered in this test
		DeviceRefreshInterval: 10 * time.Minute,
	}

	api := client.NewClient(cfg.APIURL, cfg.Token)
	runner := poller.NewRunner(cfg, api)

	ctx, cancel := context.WithTimeout(context.Background(), 600*time.Millisecond)
	defer cancel()
	runner.Run(ctx)

	mu.Lock()
	defer mu.Unlock()

	if len(posted) == 0 {
		t.Fatal("expected at least one state-change POST, got none")
	}
	first := posted[0]
	if first["entityId"] != "n1" {
		t.Errorf("entityId = %q, want n1", first["entityId"])
	}
	if first["newState"] != "OFFLINE" {
		t.Errorf("newState = %q, want OFFLINE", first["newState"])
	}
	if first["oldState"] != "ONLINE" {
		t.Errorf("oldState = %q, want ONLINE", first["oldState"])
	}
}

func TestRunner_deduplicatesStateChanges(t *testing.T) {
	var mu sync.Mutex
	var postCount int

	apiSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/internal/devices":
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode([]client.Device{
				// Unreachable IP, starts OFFLINE — so ICMP fail should NOT re-post OFFLINE
				{ID: "n2", Type: "node", IP: "192.0.2.101", NodeType: "CABINET", State: "OFFLINE", CenterID: "c1"},
			})
		case "/internal/state-change":
			mu.Lock()
			postCount++
			mu.Unlock()
			w.Write([]byte(`{"ok":true}`))
		}
	}))
	defer apiSrv.Close()

	cfg := config.Config{
		APIURL:                apiSrv.URL,
		Token:                 "tok",
		SNMPCommunity:         "public",
		ICMPInterval:          80 * time.Millisecond,
		SNMPInterval:          10 * time.Minute,
		ONVIFInterval:         10 * time.Minute,
		DeviceRefreshInterval: 10 * time.Minute,
	}

	api := client.NewClient(cfg.APIURL, cfg.Token)
	runner := poller.NewRunner(cfg, api)

	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
	defer cancel()
	runner.Run(ctx)

	mu.Lock()
	defer mu.Unlock()
	if postCount > 0 {
		t.Errorf("expected 0 state-change POSTs (device already OFFLINE), got %d", postCount)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/monitor && go test ./poller/ -run TestRunner -v -timeout 15s
```

Expected: compile error — `poller.NewRunner` not defined.

- [ ] **Step 3: Implement poller/runner.go**

Create `apps/monitor/poller/runner.go`:

```go
package poller

import (
	"context"
	"log"
	"time"

	"siges-monitor/client"
	"siges-monitor/config"
	"siges-monitor/device"
)

type Runner struct {
	cfg     config.Config
	api     *client.Client
	cache   *device.StateCache
	devices []client.Device
}

func NewRunner(cfg config.Config, api *client.Client) *Runner {
	return &Runner{
		cfg:   cfg,
		api:   api,
		cache: device.NewStateCache(),
	}
}

func (r *Runner) Run(ctx context.Context) {
	devs, err := r.api.GetDevices()
	if err != nil {
		log.Printf("[runner] initial GetDevices failed: %v", err)
	} else {
		r.devices = devs
		r.cache.Seed(devs)
		log.Printf("[runner] seeded %d devices", len(devs))
	}

	icmpTicker := time.NewTicker(r.cfg.ICMPInterval)
	snmpTicker := time.NewTicker(r.cfg.SNMPInterval)
	onvifTicker := time.NewTicker(r.cfg.ONVIFInterval)
	refreshTicker := time.NewTicker(r.cfg.DeviceRefreshInterval)
	defer icmpTicker.Stop()
	defer snmpTicker.Stop()
	defer onvifTicker.Stop()
	defer refreshTicker.Stop()

	// Run one immediate ICMP pass
	r.runICMP()

	for {
		select {
		case <-ctx.Done():
			return
		case <-icmpTicker.C:
			r.runICMP()
		case <-snmpTicker.C:
			r.runSNMP()
		case <-onvifTicker.C:
			r.runONVIF()
		case <-refreshTicker.C:
			r.refreshDevices()
		}
	}
}

func (r *Runner) runICMP() {
	for _, d := range r.devices {
		if d.IP == "" {
			continue
		}
		online := ProbeICMP(d.IP, 2*time.Second)
		newState := stateFromBool(online)
		r.maybePost(d, newState)
	}
}

func (r *Runner) runSNMP() {
	for _, d := range r.devices {
		if d.Type != "node" || d.NodeType != "SWITCH" || d.IP == "" {
			continue
		}
		community := r.cfg.SNMPCommunity
		if d.SNMPCommunity != "" {
			community = d.SNMPCommunity
		}
		ok := ProbeSNMP(d.IP, community, 3*time.Second)
		current, exists := r.cache.Get(d.ID)
		if !exists {
			continue
		}
		var newState string
		if !ok && current == "ONLINE" {
			newState = "DEGRADED"
		} else if ok && current == "DEGRADED" {
			newState = "ONLINE"
		}
		if newState != "" {
			r.postStateChange(d, current, newState)
		}
	}
}

func (r *Runner) runONVIF() {
	for _, d := range r.devices {
		if d.Type != "camera" || d.IP == "" {
			continue
		}
		ok := ProbeONVIF(d.IP, 5*time.Second)
		newState := stateFromBool(ok)
		r.maybePost(d, newState)
	}
}

func (r *Runner) refreshDevices() {
	devs, err := r.api.GetDevices()
	if err != nil {
		log.Printf("[runner] device refresh failed: %v", err)
		return
	}
	r.devices = devs
	// Only seed IDs not already in cache (don't overwrite live state)
	for _, d := range devs {
		if _, ok := r.cache.Get(d.ID); !ok {
			r.cache.Set(d.ID, d.State)
		}
	}
	log.Printf("[runner] refreshed device list: %d devices", len(devs))
}

func (r *Runner) maybePost(d client.Device, newState string) {
	current, ok := r.cache.Get(d.ID)
	if !ok {
		r.cache.Set(d.ID, newState)
		return
	}
	if current == newState {
		return
	}
	r.postStateChange(d, current, newState)
}

func (r *Runner) postStateChange(d client.Device, oldState, newState string) {
	entityType := d.Type
	if err := r.api.PostStateChange(entityType, d.ID, oldState, newState); err != nil {
		log.Printf("[runner] PostStateChange %s %s %s→%s: %v", entityType, d.ID, oldState, newState, err)
		return
	}
	r.cache.Set(d.ID, newState)
	log.Printf("[runner] %s %s: %s → %s", entityType, d.ID, oldState, newState)
}

func stateFromBool(ok bool) string {
	if ok {
		return "ONLINE"
	}
	return "OFFLINE"
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/monitor && go test ./poller/ -run TestRunner -v -timeout 15s
```

Expected:
```
--- PASS: TestRunner_ICMPPostsOfflineOnFailure
--- PASS: TestRunner_deduplicatesStateChanges
```

- [ ] **Step 5: Update main.go to use Runner**

Replace `apps/monitor/main.go` with:

```go
package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"siges-monitor/client"
	"siges-monitor/config"
	"siges-monitor/poller"
)

func main() {
	cfg := config.Load()
	log.Printf("SIGES Monitor starting (API: %s)", cfg.APIURL)

	api := client.NewClient(cfg.APIURL, cfg.Token)
	runner := poller.NewRunner(cfg, api)

	ctx, cancel := context.WithCancel(context.Background())

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-stop
		log.Println("Monitor shutting down...")
		cancel()
	}()

	runner.Run(ctx)
	log.Println("Monitor stopped")
}
```

- [ ] **Step 6: Run all tests**

```bash
cd apps/monitor && go test ./... -timeout 30s
```

Expected:
```
ok  	siges-monitor/client
ok  	siges-monitor/config
ok  	siges-monitor/device
ok  	siges-monitor/poller
```

- [ ] **Step 7: Build the binary**

```bash
cd apps/monitor && go build -o monitor .
```

Expected: `apps/monitor/monitor` binary created with no errors.

- [ ] **Step 8: Smoke test (requires API running)**

```bash
# Start the API first: cd apps/api && npm run start:dev
# Then in a separate terminal:
cd apps/monitor
MONITOR_API_TOKEN=your-token API_URL=http://localhost:4001 \
  ICMP_INTERVAL=5s SNMP_INTERVAL=30s ONVIF_INTERVAL=10s \
  ./monitor
```

Expected log output:
```
SIGES Monitor starting (API: http://localhost:4001)
[runner] seeded N devices
```

- [ ] **Step 9: Remove binary + commit**

```bash
rm apps/monitor/monitor
git -C /mnt/c/Users/ingel/SIGES-CCTV add apps/monitor/
git -C /mnt/c/Users/ingel/SIGES-CCTV commit -m "feat(monitor): add runner + wire main.go"
```

---

## Post-Plan Notes

- `apps/monitor/monitor` binary is git-ignored implicitly (Go binaries not tracked). Verify with `git status`.
- To add to docker-compose later: `apps/monitor/Dockerfile` (multi-stage: `golang:1.22-alpine` builder → `alpine` runtime) — out of scope for Plan 3.
- The `ProbeONVIFURL` export exists for testing; external packages may use it but it is not part of the poller's public contract.
