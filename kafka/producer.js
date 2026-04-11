const { Kafka } = require("kafkajs");

const producer = new Kafka({
  clientId: "ccloud-nodejs-client-332507ec-da57-4699-a235-71938da0bc49",
  brokers: [process.env.KAFKA_BROKER],
  ssl: "SASL_SSL",
  sasl: {
    mechanism: "plain",
    username: process.env.KAFKA_KEY,
    password: process.env.KAFKA_SECRET,
  },
}).producer();

const connectProducer = async () => {
  await producer.connect();
  console.log("Kafka Producer connected");
};

const sendMessage = async (topic, message) => {
  await producer.send({
    topic,
    messages: [{ value: JSON.stringify(message) }],
  });
};

module.exports = { connectProducer, sendMessage };
