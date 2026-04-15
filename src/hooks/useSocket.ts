"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

interface BotStatusEvent {
  botRunId: string;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  progress?: number;
  message?: string;
}

interface UseSocketReturn {
  socket: Socket | null;
  connected: boolean;
  botStatus: Record<string, BotStatusEvent>;
}

export function useSocket(): UseSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [botStatus, setBotStatus] = useState<Record<string, BotStatusEvent>>({});

  useEffect(() => {
    // Connect to the Socket.io server (same Next.js origin, /api/socket)
    const socket = io({ path: "/api/socket", transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("bot:status", (event: BotStatusEvent) => {
      setBotStatus((prev) => ({ ...prev, [event.botRunId]: event }));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return { socket: socketRef.current, connected, botStatus };
}
