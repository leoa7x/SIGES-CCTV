package poller

import (
	"context"
	"log"
	"time"

	"siges-monitor/client"
	"siges-monitor/config"
	"siges-monitor/device"
)

type Runner struct {
	cfg     config.Config
	api     *client.Client
	cache   *device.StateCache
	devices []client.Device
}

func NewRunner(cfg config.Config, api *client.Client) *Runner {
	return &Runner{
		cfg:   cfg,
		api:   api,
		cache: device.NewStateCache(),
	}
}

func (r *Runner) Run(ctx context.Context) {
	devs, err := r.api.GetDevices()
	if err != nil {
		log.Printf("[runner] initial GetDevices failed: %v", err)
	} else {
		r.devices = devs
		r.cache.Seed(devs)
		log.Printf("[runner] seeded %d devices", len(devs))
	}

	icmpTicker := time.NewTicker(r.cfg.ICMPInterval)
	snmpTicker := time.NewTicker(r.cfg.SNMPInterval)
	onvifTicker := time.NewTicker(r.cfg.ONVIFInterval)
	refreshTicker := time.NewTicker(r.cfg.DeviceRefreshInterval)
	defer icmpTicker.Stop()
	defer snmpTicker.Stop()
	defer onvifTicker.Stop()
	defer refreshTicker.Stop()

	// Run one immediate ICMP pass before entering tick loop
	r.runICMP()

	for {
		select {
		case <-ctx.Done():
			return
		case <-icmpTicker.C:
			r.runICMP()
		case <-snmpTicker.C:
			r.runSNMP()
		case <-onvifTicker.C:
			r.runONVIF()
		case <-refreshTicker.C:
			r.refreshDevices()
		}
	}
}

func (r *Runner) runICMP() {
	forEachConcurrent(r.devices, r.cfg.ProbeConcurrency, func(d client.Device) {
		if d.IP == "" {
			return
		}
		online := ProbeICMP(d.IP, 2*time.Second)
		newState := stateFromBool(online)
		r.maybePost(d, newState)
	})
}

func (r *Runner) runSNMP() {
	forEachConcurrent(r.devices, r.cfg.ProbeConcurrency, func(d client.Device) {
		if d.Type != "node" || d.NodeType != "SWITCH" || d.IP == "" {
			return
		}
		community := r.cfg.SNMPCommunity
		if d.SNMPCommunity != "" {
			community = d.SNMPCommunity
		}
		ok := ProbeSNMP(d.IP, community, 3*time.Second)
		current, exists := r.cache.Get(d.ID)
		if !exists {
			log.Printf("[runner] SNMP: %s not in cache, skipping", d.ID)
			return
		}
		var newState string
		if !ok && current == "ONLINE" {
			newState = "DEGRADED"
		} else if ok && current == "DEGRADED" {
			newState = "ONLINE"
		}
		if newState != "" {
			r.postStateChange(d, current, newState)
		}
	})
}

func (r *Runner) runONVIF() {
	forEachConcurrent(r.devices, r.cfg.ProbeConcurrency, func(d client.Device) {
		if d.Type != "camera" || d.IP == "" {
			return
		}
		ok := ProbeONVIF(d.IP, 5*time.Second)
		newState := stateFromBool(ok)
		r.maybePost(d, newState)
	})
}

func (r *Runner) refreshDevices() {
	devs, err := r.api.GetDevices()
	if err != nil {
		log.Printf("[runner] device refresh failed: %v", err)
		return
	}
	r.devices = devs
	// Only seed IDs not already in cache (don't overwrite live state)
	for _, d := range devs {
		if _, ok := r.cache.Get(d.ID); !ok {
			r.cache.Set(d.ID, d.State)
		}
	}
	log.Printf("[runner] refreshed device list: %d devices", len(devs))
}

func (r *Runner) maybePost(d client.Device, newState string) {
	current, ok := r.cache.Get(d.ID)
	if !ok {
		log.Printf("[runner] %s %s not in cache, seeding as %s", d.Type, d.ID, newState)
		r.cache.Set(d.ID, newState)
		return
	}
	if current == newState {
		return
	}
	r.postStateChange(d, current, newState)
}

func (r *Runner) postStateChange(d client.Device, oldState, newState string) {
	if !r.cfg.StateTransitionsEnabled {
		log.Printf("[runner] supplemental observation %s %s: %s → %s (state unchanged)", d.Type, d.ID, oldState, newState)
		return
	}
	entityType := d.Type
	if err := r.api.PostStateChange(entityType, d.ID, oldState, newState); err != nil {
		log.Printf("[runner] PostStateChange %s %s %s→%s: %v", entityType, d.ID, oldState, newState, err)
		return
	}
	r.cache.Set(d.ID, newState)
	log.Printf("[runner] %s %s: %s → %s", entityType, d.ID, oldState, newState)
}

func stateFromBool(ok bool) string {
	if ok {
		return "ONLINE"
	}
	return "OFFLINE"
}
