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
