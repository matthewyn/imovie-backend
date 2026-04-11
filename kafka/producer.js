const { Kafka } = require("@confluentinc/kafka-javascript").KafkaJS;

const config = {
  "bootstrap.servers": process.env.KAFKA_BROKER || "localhost:9092",
  "client.id": "ccloud-nodejs-client-332507ec-da57-4699-a235-71938da0bc49",
  "security.protocol": "SASL_SSL",
  "sasl.mechanism": "PLAIN",
  "sasl.username": process.env.KAFKA_KEY,
  "sasl.password": process.env.KAFKA_SECRET,
};

const producer = new Kafka().producer(config);

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
