import Redis from "ioredis";

export const redis = new Redis(
    process.env.REDIS_URL,
    {

        maxRetriesPerRequest: null,

        retryStrategy(times) {

            return Math.min(
                times * 50,
                2000
            );
        },

        enableReadyCheck: false,
    }
);

redis.on(
    "connect",
    () => {

        console.log(
            "Redis Connected"
        );
    }
);

redis.on(
    "ready",
    () => {

        console.log(
            "Redis Ready"
        );
    }
);

redis.on(
    "error",
    (err) => {

        console.log(
            "Redis Error:",
            err
        );
    }
);