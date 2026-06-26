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
	ok := poller.ProbeICMP("not-an-ip", 100*time.Millisecond)
	if ok {
		t.Error("ProbeICMP(invalid) should return false")
	}
}
