import Redis from "ioredis";

// Create client with enableOfflineQueue: false so commands fail immediately instead of hanging when offline
const client = new Redis(
    process.env.REDIS_URL,
    {
        maxRetriesPerRequest: null,
        enableOfflineQueue: false, // CRITICAL: Prevents Redis connection loss from hanging backend code
        retryStrategy(times) {
            return Math.min(
                times * 50,
                2000
            );
        },
        enableReadyCheck: false,
    }
);

client.on(
    "connect",
    () => {
        console.log("✅ Redis Server Connected");
    }
);

client.on(
    "ready",
    () => {
        console.log("✅ Redis Server Ready");
    }
);

client.on(
    "error",
    (err) => {
        console.log("⚠️ Redis Server Connection Error (Memory Fallback Active):", err.message);
    }
);

// High-speed local in-memory fallback stores
const memoryStore = new Map();
const memorySets = new Map();

export const redis = {
    async set(key, value) {
        try {
            return await client.set(key, value);
        } catch (err) {
            memoryStore.set(key, value);
            return "OK";
        }
    },

    async get(key) {
        try {
            return await client.get(key);
        } catch (err) {
            return memoryStore.get(key) || null;
        }
    },

    async del(key) {
        try {
            return await client.del(key);
        } catch (err) {
            memoryStore.delete(key);
            return 1;
        }
    },

    async sadd(key, value) {
        try {
            return await client.sadd(key, value);
        } catch (err) {
            if (!memorySets.has(key)) {
                memorySets.set(key, new Set());
            }
            memorySets.get(key).add(value);
            return 1;
        }
    },

    async srem(key, value) {
        try {
            return await client.srem(key, value);
        } catch (err) {
            if (memorySets.has(key)) {
                memorySets.get(key).delete(value);
            }
            return 1;
        }
    },

    async smembers(key) {
        try {
            return await client.smembers(key);
        } catch (err) {
            if (!memorySets.has(key)) {
                return [];
            }
            return Array.from(memorySets.get(key));
        }
    },

    async ping() {
        try {
            return await client.ping();
        } catch (err) {
            return "PONG (In-Memory Fallback Active)";
        }
    }
};