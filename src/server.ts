/**
 * Custom Next.js server with Socket.io for real-time bot status updates.
 * Subscribes to Redis pub/sub and emits events to browser rooms.
 */

import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import Redis from "ioredis";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT ?? "6015", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

async function main() {
  await app.prepare();

  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "/", true);
    void handle(req, res, parsedUrl);
  });

  // Initialize Socket.io
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:6015",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    // Join provider room for real-time bot updates
    socket.on("subscribe:provider", (providerId: string) => {
      void socket.join(`provider:${providerId}`);
      console.log(`[Socket.io] Socket ${socket.id} joined room provider:${providerId}`);
    });

    socket.on("unsubscribe:provider", (providerId: string) => {
      void socket.leave(`provider:${providerId}`);
    });

    socket.on("disconnect", () => {
      console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    });
  });

  // Subscribe to Redis pub/sub for bot events
  const redisHost = process.env.REDIS_HOST ?? "localhost";
  const redisPort = parseInt(process.env.REDIS_PORT ?? "6379", 10);

  const subscriber = new Redis({
    host: redisHost,
    port: redisPort,
    lazyConnect: true,
  });

  await subscriber.connect();

  // Subscribe to all provider bot channels
  await subscriber.psubscribe("provider:*:bots");

  subscriber.on("pmessage", (_pattern: string, channel: string, message: string) => {
    // Extract providerId from channel name: "provider:{id}:bots"
    const parts = channel.split(":");
    if (parts.length < 2) return;
    const providerId = parts[1];

    try {
      const data: unknown = JSON.parse(message);
      // Emit to all sockets in the provider room
      io.to(`provider:${providerId}`).emit("bot:update", data);
    } catch (error) {
      console.error("[Socket.io] Failed to parse Redis message:", error);
    }
  });

  console.log(`[Redis Subscriber] Subscribed to provider bot channels`);

  httpServer.listen(port, hostname, () => {
    console.log(`[Server] Ready on http://${hostname}:${port}`);
    console.log(`[Server] Socket.io active`);
  });
}

main().catch(console.error);
