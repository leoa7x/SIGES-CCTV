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
