require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});

const { Kafka } = require("@confluentinc/kafka-javascript").KafkaJS;
const { connectDB, getDB } = require("../api/dbs/mongo");
const { connectRedis, client } = require("../api/dbs/redis");
const { generateUsersKey } = require("../api/utils/keys");
const { connectProducer, sendMessage } = require("../kafka/producer");

MAX_RETRY = 4;

const config = {
  "bootstrap.servers": process.env.KAFKA_BROKER || "localhost:9092",
  "client.id": "ccloud-nodejs-client-332507ec-da57-4699-a235-71938da0bc49",
  "group.id": "profile-photo-group",
  "security.protocol": "SASL_SSL",
  "sasl.mechanism": "PLAIN",
  "sasl.username": process.env.KAFKA_KEY,
  "sasl.password": process.env.KAFKA_SECRET,
  "auto.offset.reset": "earliest",
  "session.timeout.ms": 45000,
};

const consumer = new Kafka().consumer(config);

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
    topics: [process.env.KAFKA_TOPIC],
  });

  await consumer.run({
    eachMessage: async ({ message }) => {
      console.log("Processing message...");
      const { email, fileUrl, userId, retryCount } = JSON.parse(
        message.value.toString(),
      );
      try {
        const db = getDB();
        await db.collection("users").updateOne(
          { email: email },
          {
            $set: {
              profileUrl: fileUrl,
            },
          },
        );
        await client.hSet(generateUsersKey(userId), {
          profileUrl: fileUrl,
        });
      } catch (error) {
        console.error("Error processing Kafka message:", error);
        if (retryCount < MAX_RETRY) {
          await sendMessage(process.env.KAFKA_TOPIC_RETRY, {
            ...JSON.parse(message.value.toString()),
            retryCount: retryCount + 1,
          });
        } else {
          await sendMessage(process.env.KAFKA_TOPIC_DLQ, {
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
