require("dotenv").config();

const express = require("express");
const http = require("http");
const admin = require("firebase-admin");
const app = express();
const cors = require("cors");
const multer = require("multer");
const moviesRouter = require("./routes/movies");
const studiosRouter = require("./routes/studios");
const schedulesRouter = require("./routes/schedules");
const authRouter = require("./routes/auth");
const ordersRouter = require("./routes/orders");
const wishlistsRouter = require("./routes/wishlists");
const notificationsRouter = require("./routes/notifications");
const reviewsRouter = require("./routes/reviews");
const accountRouter = require("./routes/account");
const { connectDB } = require("./dbs/mongo");
const { connectRedis } = require("./dbs/redis");
const { connectProducer } = require("../kafka/producer");
const { Server } = require("socket.io");
const { initializeAI, getOpenAI } = require("./services/aiService");
const {
  initializeVectorStore,
  getRetriever,
} = require("./services/vectorStore");
const {
  generateSystemMessage,
  generateRephraseMessage,
} = require("./utils/ai");

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY,
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const server = http.createServer(app);

const upload = multer({ storage: multer.memoryStorage() });

app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? process.env.FRONTEND_URL
        : "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

const io = new Server(server, {
  cors: {
    origin:
      process.env.NODE_ENV === "production"
        ? process.env.FRONTEND_URL
        : "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/movies", upload.single("file"), moviesRouter);
app.use("/api/studios", studiosRouter);
app.use("/api/schedules", schedulesRouter);
app.use("/api/auth", authRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/wishlists", wishlistsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/account", upload.single("file"), accountRouter);

async function startServer() {
  try {
    // Initialize services
    const { embeddings } = await initializeAI();
    await initializeVectorStore(embeddings);

    // Connect to databases
    await Promise.all([connectDB(), connectRedis(), connectProducer()]);

    // Start server
    server.listen(3000, () => {
      console.log("Server is running on port 3000");
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

io.on("connection", (socket) => {
  console.log("A user connected: " + socket.id);

  socket.on("disconnect", () => {
    console.log("User disconnected: " + socket.id);
  });

  socket.on("client_message", async (data) => {
    console.log("Received message from client: ", data);
    let results = "";
    const openai = getOpenAI();
    const retriever = getRetriever();
    const rephraseMessage = generateRephraseMessage(
      JSON.stringify(data.history),
      data.text,
    );
    const rephraseResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "system", content: rephraseMessage }],
    });
    const docs = await retriever.invoke(data.text);
    const messages = [
      { role: "system", content: generateSystemMessage(docs) },
      { role: "user", content: rephraseResponse.choices[0].message.content },
    ];
    const stream = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: messages,
      stream: true,
    });
    for await (const part of stream) {
      const content = part.choices[0].delta.content || "";
      results += content;
      if (results.length > 0) {
        socket.emit("assistant_message_complete", { completed: true });
      }
      socket.emit("assistant_message", { text: content });
    }
  });
});

startServer();

module.exports = app;
