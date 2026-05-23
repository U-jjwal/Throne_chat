import Redis from "ioredis";

// Autodetect if a valid production Redis URL is supplied (bypasses placeholders like 'host' or 'placeholder')
const useRedis = process.env.REDIS_URL && 
                 !process.env.REDIS_URL.includes("host") && 
                 !process.env.REDIS_URL.includes("placeholder") &&
                 process.env.REDIS_URL !== "undefined";

const client = useRedis ? new Redis(
    process.env.REDIS_URL,
    {
        maxRetriesPerRequest: null,
        enableOfflineQueue: false, // Prevents queuing/hanging
        retryStrategy(times) {
            // Keep retry intervals high (5-10 seconds) to completely avoid DNS lookup congestion
            return Math.min(
                times * 1000,
                10000
            );
        },
        enableReadyCheck: false,
    }
) : null;

if (client) {
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
            console.log("⚠️ Redis Server Connection Error:", err.message);
        }
    );
} else {
    console.log("ℹ️ Redis URL not set or placeholder detected. Safe In-Memory coordination active from startup!");
}

// Local in-memory fallback stores (Used when Redis is disabled or connection fails)
const memoryStore = new Map();
const memorySets = new Map();

export const redis = {
    async set(key, value) {
        if (!client) {
            memoryStore.set(key, value);
            return "OK";
        }
        try {
            return await client.set(key, value);
        } catch (err) {
            memoryStore.set(key, value);
            return "OK";
        }
    },

    async get(key) {
        if (!client) {
            return memoryStore.get(key) || null;
        }
        try {
            return await client.get(key);
        } catch (err) {
            return memoryStore.get(key) || null;
        }
    },

    async del(key) {
        if (!client) {
            memoryStore.delete(key);
            return 1;
        }
        try {
            return await client.del(key);
        } catch (err) {
            memoryStore.delete(key);
            return 1;
        }
    },

    async sadd(key, value) {
        if (!client) {
            if (!memorySets.has(key)) {
                memorySets.set(key, new Set());
            }
            memorySets.get(key).add(value);
            return 1;
        }
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
        if (!client) {
            if (memorySets.has(key)) {
                memorySets.get(key).delete(value);
            }
            return 1;
        }
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
        if (!client) {
            if (!memorySets.has(key)) {
                return [];
            }
            return Array.from(memorySets.get(key));
        }
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
        if (!client) {
            return "PONG (In-Memory Fallback Active)";
        }
        try {
            return await client.ping();
        } catch (err) {
            return "PONG (In-Memory Fallback Active)";
        }
    }
};