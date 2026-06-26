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
