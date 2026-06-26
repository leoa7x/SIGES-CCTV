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

export function useMonitor(centerId: string | null) {
  const [lastEvent, setLastEvent] = useState<StateChangeEvent | null>(null);

  useEffect(() => {
    if (!centerId) return;
    const socket = getSocket();
    socket.emit("subscribe", { centerId });
    const handler = (evt: StateChangeEvent) => {
      if (evt.centerId === centerId) setLastEvent(evt);
    };
    socket.on("state-change", handler);
    return () => {
      socket.off("state-change", handler);
    };
  }, [centerId]);

  return lastEvent;
}
