package poller

import "sync"

// forEachConcurrent runs fn for every item in items, capped at `limit`
// concurrent goroutines. A fully serial loop over devices means a handful of
// unreachable/firewalled targets serialize and delay detection for every
// other device behind them in the slice — this bounds that blast radius
// without spawning one goroutine per device (which would be unbounded at
// fleet scale).
func forEachConcurrent[T any](items []T, limit int, fn func(T)) {
	if limit < 1 {
		limit = 1
	}
	if len(items) == 0 {
		return
	}

	sem := make(chan struct{}, limit)
	var wg sync.WaitGroup
	for _, item := range items {
		wg.Add(1)
		sem <- struct{}{}
		go func(it T) {
			defer wg.Done()
			defer func() { <-sem }()
			fn(it)
		}(item)
	}
	wg.Wait()
}
