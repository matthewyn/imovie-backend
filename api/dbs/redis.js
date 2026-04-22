const { createClient } = require("redis");
const { releaseSeatsScript } = require("../utils/scripts");
const {
  generateOrdersPendingByUserKey,
  generateOrdersKey,
  generateOrdersCancelledByUserKey,
  generateUsersKey,
} = require("../utils/keys");
const { sendPushNotification } = require("../utils/notifications");
const { sendMessage } = require("../../kafka/producer");

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
    if (key.startsWith("notify:")) {
      const dataKey = `${key}:data`;
      const userDeviceToken = await client.get(dataKey);

      await sendPushNotification(
        userDeviceToken,
        "⏰ Payment Reminder",
        "You have 5 minutes left to complete your booking",
        process.env.NODE_ENV === "production"
          ? `${process.env.FRONTEND_URL}/account/orders/${key.split(":")[1]}`
          : `http://localhost:5173/account/orders/${key.split(":")[1]}`,
      );

      await client.del(dataKey);

      return;
    }

    if (key.startsWith("reservation:")) {
      const dataKey = `${key}:data`;
      const orderId = key.split(":")[1];

      const value = await client.get(dataKey);

      if (!value) return;

      const { seats, timeslotKey, userId } = JSON.parse(value);

      await sendMessage(process.env.KAFKA_TOPIC_RESERVATION, {
        userId,
        id: orderId,
        retryCount: 0,
      });

      await client.eval(releaseSeatsScript, {
        keys: [
          timeslotKey,
          generateOrdersPendingByUserKey(userId),
          generateOrdersKey(orderId),
          generateOrdersCancelledByUserKey(userId),
        ],
        arguments: [JSON.stringify(seats), orderId, Date.now().toString()],
      });

      await client.del(dataKey);
    }
  });
};

module.exports = { client, subscriber, connectRedis };
