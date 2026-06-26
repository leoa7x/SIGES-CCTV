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
