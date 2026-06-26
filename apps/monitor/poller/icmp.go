package poller

import (
	"net"
	"time"

	probing "github.com/go-ping/ping"
)

func ProbeICMP(ip string, timeout time.Duration) bool {
	// First, validate IP format
	parsed := net.ParseIP(ip)
	if parsed == nil {
		return false
	}

	// Special case: localhost is always reachable
	if parsed.IsLoopback() {
		return true
	}

	// Try unprivileged UDP echo (go-ping mode, no root needed)
	pinger, err := probing.NewPinger(ip)
	if err != nil {
		return probeTCP(ip, timeout)
	}
	pinger.Count = 1
	pinger.Timeout = timeout
	pinger.SetPrivileged(false)

	if err := pinger.Run(); err == nil && pinger.Statistics().PacketsRecv > 0 {
		return true
	}

	// Fallback: TCP dial (works without root, validates connectivity)
	return probeTCP(ip, timeout)
}

func probeTCP(ip string, timeout time.Duration) bool {
	// Try common ports: SSH (22), HTTP (80), HTTPS (443)
	ports := []string{"22", "80", "443"}
	for _, port := range ports {
		addr := net.JoinHostPort(ip, port)
		conn, err := net.DialTimeout("tcp", addr, timeout)
		if err == nil {
			conn.Close()
			return true
		}
	}
	return false
}
