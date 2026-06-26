package poller

import (
	"net"
	"time"

	probing "github.com/go-ping/ping"
)

func ProbeICMP(ip string, timeout time.Duration) bool {
	if net.ParseIP(ip) == nil {
		return false
	}
	pinger, err := probing.NewPinger(ip)
	if err != nil {
		return false
	}
	pinger.Count = 1
	pinger.Timeout = timeout
	pinger.SetPrivileged(false)
	if err := pinger.Run(); err != nil {
		return false
	}
	return pinger.Statistics().PacketsRecv > 0
}
