package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"siges-monitor/client"
	"siges-monitor/config"
	"siges-monitor/poller"
)

func main() {
	cfg := config.Load()
	log.Printf("SIGES Monitor starting (API: %s)", cfg.APIURL)

	api := client.NewClient(cfg.APIURL, cfg.Token)
	runner := poller.NewRunner(cfg, api)

	ctx, cancel := context.WithCancel(context.Background())

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-stop
		log.Println("Monitor shutting down...")
		cancel()
	}()

	runner.Run(ctx)
	log.Println("Monitor stopped")
}
