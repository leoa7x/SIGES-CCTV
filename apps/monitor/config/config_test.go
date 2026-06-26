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
