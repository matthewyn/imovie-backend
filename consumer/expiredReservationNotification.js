require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});

const { Kafka } = require("kafkajs");
const { connectDB, getDB } = require("../api/dbs/mongo");
const { connectRedis, client } = require("../api/dbs/redis");
const { connectProducer, sendMessage } = require("../kafka/producer");
const { generateOrderNotification } = require("../api/utils/notifications");
const http = require("http");
const { ObjectId } = require("mongodb");
const CANCELLED_PAYMENT = "cancelled";

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

  await connectDB();
  await connectRedis();
  await connectProducer();

  await consumer.connect();
  await consumer.subscribe({
    topics: [process.env.KAFKA_TOPIC_RESERVATION],
  });

  await consumer.run({
    eachMessage: async ({ message }) => {
      console.log("Consumer processing expired reservation...");
      const { id, userId, retryCount, judul } = JSON.parse(
        message.value.toString(),
      );
      try {
        const db = getDB();
        await db
          .collection("notifications")
          .insertOne(
            generateOrderNotification(
              id,
              userId,
              "order-cancelled",
              `Your order for ${judul} has been cancelled.`,
              new Date().toISOString(),
              "Order Cancelled",
            ),
          );
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
