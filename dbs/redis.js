const { createClient } = require("redis");

const client = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});
const subscriber = client.duplicate();

client.on("error", (err) => console.log("Redis Client Error", err));

client.on("connect", () => console.log("Connected to Redis"));

const connectRedis = async () => {
  await client.connect();
};

module.exports = { client, subscriber, connectRedis };
