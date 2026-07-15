"use client";

import { useEffect, useState } from "react";
import { getSocket } from "../lib/socket";
import type { StateChangeEvent } from "./use-monitor";

export function useMonitorAll(centerIds: string[], accessToken: string | null) {
  const [lastEvent, setLastEvent] = useState<StateChangeEvent | null>(null);
  const key = centerIds.join(",");

  useEffect(() => {
    if (!centerIds.length || !accessToken) return;
    const socket = getSocket(accessToken);
    // Re-emit on every (re)connect, not just on mount — room membership does
    // not survive a socket.io reconnect (backend restart, network blip), so
    // without this the user silently stops receiving live updates.
    const subscribe = () => centerIds.forEach((id) => socket.emit("subscribe", { centerId: id }));
    if (socket.connected) subscribe();
    socket.on("connect", subscribe);
    const handler = (evt: StateChangeEvent) => setLastEvent(evt);
    socket.on("state-change", handler);
    return () => {
      socket.off("connect", subscribe);
      socket.off("state-change", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, accessToken]);

  return lastEvent;
}
