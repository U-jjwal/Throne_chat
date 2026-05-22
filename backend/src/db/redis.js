import Redis from "ioredis";

export const redis = new Redis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT || 6379,
});

// Handle Redis errors
redis.on("error", (error) => {
  console.error("Redis connection error:", error);
});