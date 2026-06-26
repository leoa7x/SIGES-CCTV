package config

import (
	"log"
	"os"
	"time"
)

type Config struct {
	APIURL                string
	Token                 string
	SNMPCommunity         string
	ICMPInterval          time.Duration
	SNMPInterval          time.Duration
	ONVIFInterval         time.Duration
	DeviceRefreshInterval time.Duration
}

func Load() Config {
	token := getenv("MONITOR_API_TOKEN", "")
	if token == "" {
		log.Panic("MONITOR_API_TOKEN env var is required")
	}
	return Config{
		APIURL:                getenv("API_URL", "http://localhost:4001"),
		Token:                 token,
		SNMPCommunity:         getenv("SNMP_COMMUNITY", "public"),
		ICMPInterval:          parseDuration("ICMP_INTERVAL", 30*time.Second),
		SNMPInterval:          parseDuration("SNMP_INTERVAL", 5*time.Minute),
		ONVIFInterval:         parseDuration("ONVIF_INTERVAL", 2*time.Minute),
		DeviceRefreshInterval: parseDuration("DEVICE_REFRESH_INTERVAL", 60*time.Second),
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func parseDuration(key string, fallback time.Duration) time.Duration {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		log.Printf("invalid %s=%q, using default %v", key, v, fallback)
		return fallback
	}
	return d
}
