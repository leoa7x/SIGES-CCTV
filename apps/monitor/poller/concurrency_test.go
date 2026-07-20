package poller

import (
	"sync"
	"sync/atomic"
	"testing"
)

func TestForEachConcurrent_respectsLimit(t *testing.T) {
	items := make([]int, 50)
	for i := range items {
		items[i] = i
	}

	var current int32
	var maxSeen int32
	var mu sync.Mutex

	forEachConcurrent(items, 5, func(_ int) {
		n := atomic.AddInt32(&current, 1)
		mu.Lock()
		if n > maxSeen {
			maxSeen = n
		}
		mu.Unlock()
		atomic.AddInt32(&current, -1)
	})

	if maxSeen > 5 {
		t.Errorf("max concurrent = %d, want <= 5", maxSeen)
	}
}

func TestForEachConcurrent_processesEveryItem(t *testing.T) {
	items := make([]int, 37)
	for i := range items {
		items[i] = i
	}

	var mu sync.Mutex
	seen := make(map[int]bool, len(items))

	forEachConcurrent(items, 8, func(item int) {
		mu.Lock()
		seen[item] = true
		mu.Unlock()
	})

	if len(seen) != len(items) {
		t.Errorf("processed %d items, want %d", len(seen), len(items))
	}
}

func TestForEachConcurrent_zeroLimitFallsBackToSerial(t *testing.T) {
	items := []int{1, 2, 3}
	var count int32

	forEachConcurrent(items, 0, func(_ int) {
		atomic.AddInt32(&count, 1)
	})

	if count != 3 {
		t.Errorf("processed %d items, want 3", count)
	}
}

func TestForEachConcurrent_emptySlice(t *testing.T) {
	forEachConcurrent([]int{}, 5, func(_ int) {
		t.Error("fn should not be called for an empty slice")
	})
}
