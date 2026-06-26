import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (typeof window === "undefined") {
    throw new Error("getSocket can only be called in browser context");
  }
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4001", {
      transports: ["websocket"],
      autoConnect: true,
    });
  }
  return socket;
}
