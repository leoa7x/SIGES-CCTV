"use client";

import { useCallback, useEffect, useState } from "react";
import { getSocket } from "../lib/socket";
import type { StateChangeEvent } from "./use-monitor";

// Defensive cap — if a consumer ever stops draining (a bug, or the effect
// simply not mounted yet), don't let the queue grow without bound.
const MAX_QUEUED_EVENTS = 200;

/**
 * Returns every state-change event received since the last `drain()` call,
 * not just the latest one. A single `lastEvent` slot silently drops earlier
 * events whenever two arrive before React gets a chance to render — e.g.
 * two different nodes going OFFLINE within the same tick — which is exactly
 * the kind of event a NOC operator can't afford to miss. The consumer is
 * responsible for calling `drain()` once it has applied every queued event.
 */
export function useMonitorAll(centerIds: string[], accessToken: string | null) {
  const [events, setEvents] = useState<StateChangeEvent[]>([]);
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
    const handler = (evt: StateChangeEvent) =>
      setEvents((prev) => [...prev, evt].slice(-MAX_QUEUED_EVENTS));
    socket.on("state-change", handler);
    return () => {
      socket.off("connect", subscribe);
      socket.off("state-change", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, accessToken]);

  const drain = useCallback(() => setEvents([]), []);

  return { events, drain };
}
