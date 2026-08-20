import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(accessToken: string): Socket {
  if (typeof window === "undefined") {
    throw new Error("getSocket can only be called in browser context");
  }
  if (!socket) {
    const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL;
    const options = {
      transports: ["websocket"],
      autoConnect: true,
      auth: { token: accessToken },
    };
    // Production is served through Caddy. A relative API path must use the
    // browser origin for Socket.IO too (passing "/api" to io() would select a
    // namespace instead of an HTTP origin).
    socket = configuredApiUrl?.startsWith("http")
      ? io(configuredApiUrl, options)
      : io(options);
  } else {
    socket.auth = { token: accessToken };
  }
  return socket;
}
