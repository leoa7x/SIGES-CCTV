"use client";

import { useEffect, useState } from "react";
import { getSocket } from "../lib/socket";

export interface StateChangeEvent {
  entityType: "node" | "camera";
  entityId: string;
  oldState: string;
  newState: string;
  centerId: string;
  timestamp: string;
}

export function useMonitor(centerId: string | null, accessToken: string | null) {
  const [lastEvent, setLastEvent] = useState<StateChangeEvent | null>(null);

  useEffect(() => {
    if (!centerId || !accessToken) return;
    const socket = getSocket(accessToken);
    // Re-emit on every (re)connect, not just on mount — the socket.io client
    // reconnects automatically after a backend restart or network blip, but
    // room membership does not survive a reconnect, so without this the user
    // silently stops receiving live updates with no error or indicator.
    const subscribe = () => socket.emit("subscribe", { centerId });
    if (socket.connected) subscribe();
    socket.on("connect", subscribe);
    const handler = (evt: StateChangeEvent) => {
      if (evt.centerId === centerId) setLastEvent(evt);
    };
    socket.on("state-change", handler);
    return () => {
      socket.off("connect", subscribe);
      socket.off("state-change", handler);
    };
  }, [centerId, accessToken]);

  return lastEvent;
}
