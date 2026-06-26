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
