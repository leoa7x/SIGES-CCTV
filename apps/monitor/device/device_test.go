package device_test

import (
	"sync"
	"testing"

	"siges-monitor/client"
	"siges-monitor/device"
)

func TestStateCache_SeedAndGet(t *testing.T) {
	cache := device.NewStateCache()
	cache.Seed([]client.Device{
		{ID: "n1", State: "ONLINE"},
		{ID: "cam1", State: "OFFLINE"},
	})

	state, ok := cache.Get("n1")
	if !ok || state != "ONLINE" {
		t.Errorf("Get(n1) = %q, %v; want ONLINE true", state, ok)
	}
	state, ok = cache.Get("cam1")
	if !ok || state != "OFFLINE" {
		t.Errorf("Get(cam1) = %q, %v; want OFFLINE true", state, ok)
	}
	_, ok = cache.Get("missing")
	if ok {
		t.Error("Get(missing) should return ok=false")
	}
}

func TestStateCache_Set(t *testing.T) {
	cache := device.NewStateCache()
	cache.Set("n1", "ONLINE")
	state, ok := cache.Get("n1")
	if !ok || state != "ONLINE" {
		t.Errorf("after Set: Get(n1) = %q, %v", state, ok)
	}
	cache.Set("n1", "OFFLINE")
	state, _ = cache.Get("n1")
	if state != "OFFLINE" {
		t.Errorf("after second Set: Get(n1) = %q, want OFFLINE", state)
	}
}

func TestStateCache_All(t *testing.T) {
	cache := device.NewStateCache()
	cache.Seed([]client.Device{
		{ID: "n1", State: "ONLINE"},
		{ID: "n2", State: "DEGRADED"},
	})
	snap := cache.All()
	if len(snap) != 2 {
		t.Errorf("All() len = %d, want 2", len(snap))
	}
	if snap["n1"] != "ONLINE" {
		t.Errorf("snap[n1] = %q, want ONLINE", snap["n1"])
	}
}

func TestStateCache_Concurrent(t *testing.T) {
	cache := device.NewStateCache()
	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(2)
		go func() {
			defer wg.Done()
			cache.Set("x", "ONLINE")
		}()
		go func() {
			defer wg.Done()
			cache.Get("x")
		}()
	}
	wg.Wait()
}
