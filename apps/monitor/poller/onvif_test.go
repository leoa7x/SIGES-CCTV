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
