package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"

	"siges-monitor/config"
)

func main() {
	cfg := config.Load()
	log.Printf("SIGES Monitor starting (API: %s)", cfg.APIURL)

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	log.Println("Monitor stopped")
}
