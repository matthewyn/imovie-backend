const { createClient } = require("redis");
const { releaseSeatsScript } = require("../utils/scripts");
const {
  generateOrdersPendingByUserKey,
  generateOrdersKey,
} = require("../utils/keys");

const client = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});
const subscriber = client.duplicate();

client.on("error", (err) => console.log("Redis Client Error", err));
subscriber.on("error", (err) => console.log("Redis Subscriber Error", err));

client.on("connect", () => console.log("Connected to Redis"));
subscriber.on("connect", () => console.log("Connected to Redis Subscriber"));

const connectRedis = async () => {
  await client.connect();
  await subscriber.connect();

  await subscriber.subscribe("__keyevent@0__:expired", async (key) => {
    if (!key.startsWith("reservation:")) return;

    const dataKey = `${key}:data`;
    const orderId = key.split(":")[1];

    const value = await client.get(dataKey);

    if (!value) return;

    const { seats, timeslotKey, userId } = JSON.parse(value);

    await client.eval(releaseSeatsScript, {
      keys: [
        timeslotKey,
        generateOrdersPendingByUserKey(userId),
        generateOrdersKey(orderId),
      ],
      arguments: [JSON.stringify(seats), orderId, Date.now().toString()],
    });

    await client.del(dataKey);
  });
};

module.exports = { client, subscriber, connectRedis };
