const { createClient } = require("redis");
const { releaseSeatsScript } = require("../utils/scripts");
const { generateOrdersPendingByUserKey } = require("../utils/keys");
const { sendPushNotification } = require("../utils/notifications");
const { sendMessage } = require("../../kafka/producer");
const { getDB } = require("../dbs/mongo");
const CANCELLED_PAYMENT = "cancelled";
const { DateTime } = require("luxon");
const { ObjectId } = require("mongodb");
const { seatToIndex } = require("../utils/string");
const { getIO } = require("../services/socket");

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
    const db = getDB();

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

      const { seats, timeslotKey, userId, judul } = JSON.parse(value);
      const millis = parseInt(timeslotKey.split(":")[0]);
      const movieId = timeslotKey.split(":")[1];
      const timeslotDateTime = DateTime.fromMillis(millis).toUTC().toISO();

      for (const seat of seats) {
        const [rowIndex, colIndex] = seatToIndex(seat);
        await db.collection("schedules").updateOne(
          { movieId: new ObjectId(movieId), waktu: timeslotDateTime },
          {
            $inc: { [`studio.seats.${rowIndex}.${colIndex}`]: -1 },
          },
        );
      }

      await Promise.all([
        sendMessage(process.env.KAFKA_TOPIC_RESERVATION, {
          userId,
          id: orderId,
          retryCount: 0,
          judul,
        }),
        db.collection("orders").updateOne(
          { _id: orderId },
          {
            $push: {
              status: {
                tipe: CANCELLED_PAYMENT,
                createdAt: new Date().toISOString(),
              },
            },
          },
        ),
      ]);

      await client.eval(releaseSeatsScript, {
        keys: [timeslotKey, generateOrdersPendingByUserKey(userId)],
        arguments: [JSON.stringify(seats), orderId],
      });

      await client.del(dataKey);

      const io = getIO();
      io.to(userId).emit("reservation_expired", {
        message: "Your reservation has expired. Please try booking again.",
      });
    }
  });
};

module.exports = { client, subscriber, connectRedis };
