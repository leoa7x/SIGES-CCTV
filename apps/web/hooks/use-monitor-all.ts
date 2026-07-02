"use client";

import { useEffect, useState } from "react";
import { getSocket } from "../lib/socket";
import type { StateChangeEvent } from "./use-monitor";

export function useMonitorAll(centerIds: string[]) {
  const [lastEvent, setLastEvent] = useState<StateChangeEvent | null>(null);
  const key = centerIds.join(",");

  useEffect(() => {
    if (!centerIds.length) return;
    const socket = getSocket();
    centerIds.forEach((id) => socket.emit("subscribe", { centerId: id }));
    const handler = (evt: StateChangeEvent) => setLastEvent(evt);
    socket.on("state-change", handler);
    return () => {
      socket.off("state-change", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return lastEvent;
}
