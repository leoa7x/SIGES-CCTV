package device

import (
	"sync"

	"siges-monitor/client"
)

type StateCache struct {
	mu    sync.RWMutex
	state map[string]string
}

func NewStateCache() *StateCache {
	return &StateCache{state: make(map[string]string)}
}

func (c *StateCache) Seed(devices []client.Device) {
	c.mu.Lock()
	defer c.mu.Unlock()
	for _, d := range devices {
		c.state[d.ID] = d.State
	}
}

func (c *StateCache) Get(id string) (string, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	s, ok := c.state[id]
	return s, ok
}

func (c *StateCache) Set(id, state string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.state[id] = state
}

func (c *StateCache) All() map[string]string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	snap := make(map[string]string, len(c.state))
	for k, v := range c.state {
		snap[k] = v
	}
	return snap
}
