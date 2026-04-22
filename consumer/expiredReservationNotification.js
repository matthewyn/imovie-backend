require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});

const { Kafka } = require("kafkajs");
const { connectDB, getDB } = require("../api/dbs/mongo");
const { connectRedis, client } = require("../api/dbs/redis");
const {
  generateUsersNotificationsKey,
  generateNotificationsKey,
  generateUsersKey,
  generateOrdersKey,
} = require("../api/utils/keys");
const { connectProducer, sendMessage } = require("../kafka/producer");
const { generateOrderNotification } = require("../api/utils/notifications");
const http = require("http");
const { DateTime } = require("luxon");

// Fake HTTP server for Cloud Run
http
  .createServer((req, res) => {
    res.writeHead(200);
    res.end("OK");
  })
  .listen(3006, () => {
    console.log(`Fake HTTP server running on port 3000`);
  });

MAX_RETRY = 4;

const consumer = new Kafka({
  clientId: "ccloud-nodejs-client-332507ec-da57-4699-a235-71938da0bc49",
  brokers: [process.env.KAFKA_BROKER],
  ssl: "SASL_SSL",
  sasl: {
    mechanism: "plain",
    username: process.env.KAFKA_KEY,
    password: process.env.KAFKA_SECRET,
  },
}).consumer({
  groupId: "expired-reservation-group",
  sessionTimeout: 45000,
});

const run = async () => {
  const disconnect = () => {
    consumer.commitOffsets().finally(() => {
      consumer.disconnect();
    });
  };
  process.on("SIGTERM", disconnect);
  process.on("SIGINT", disconnect);

  // Connect to MongoDB and Redis before starting the consumer
  await connectDB();
  await connectRedis();
  await connectProducer();

  await consumer.connect();
  await consumer.subscribe({
    topics: [process.env.KAFKA_TOPIC_RESERVATION],
  });

  await consumer.run({
    eachMessage: async ({ message }) => {
      console.log("Processing expired reservation...");
      const { id, userId, retryCount } = JSON.parse(message.value.toString());
      try {
        const db = getDB();
        const now = DateTime.now().toMillis();
        const email = await client.hGet(generateUsersKey(userId), "email");
        const judul = await client.hGet(generateOrdersKey(id), "judul");
        await Promise.all([
          db.collection("users").updateOne(
            { email: email },
            {
              $push: {
                notifications: generateOrderNotification(
                  id,
                  "order-cancelled",
                  `Your order for ${judul} has been cancelled.`,
                  new Date().toISOString(),
                  "Order Cancelled",
                ),
              },
            },
          ),
          client.zAdd(generateUsersNotificationsKey(userId), {
            score: now,
            value: `${now}:${id}`,
          }),
          client.hSet(
            generateNotificationsKey(`${now}:${id}`),
            generateOrderNotification(
              id,
              "order-cancelled",
              `Your order for ${judul} has been cancelled.`,
              now,
              "Order Cancelled",
            ),
          ),
        ]);
      } catch (error) {
        console.error("Error processing Kafka reservation:", error);
        if (retryCount < MAX_RETRY) {
          await sendMessage(process.env.KAFKA_RESERVATION, {
            ...JSON.parse(message.value.toString()),
            retryCount: retryCount + 1,
          });
        } else {
          await sendMessage(process.env.KAFKA_RESERVATION_DLQ, {
            ...JSON.parse(message.value.toString()),
            failedAt: new Date(),
            error: error.message,
          });
        }
      }
    },
  });
};

run().catch(console.error);
