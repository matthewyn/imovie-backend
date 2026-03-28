const express = require("express");
const http = require("http");
const app = express();
const cors = require("cors");
const multer = require("multer");
const moviesRouter = require("./routes/movies");
const studiosRouter = require("./routes/studios");
const schedulesRouter = require("./routes/schedules");
const authRouter = require("./routes/auth");
const ordersRouter = require("./routes/orders");
const wishlistsRouter = require("./routes/wishlists");
const { connectDB } = require("./dbs/mongo");
const { connectRedis } = require("./dbs/redis");

server = http.createServer(app);

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/movies", upload.single("file"), moviesRouter);
app.use("/api/studios", studiosRouter);
app.use("/api/schedules", schedulesRouter);
app.use("/api/auth", authRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/wishlists", wishlistsRouter);

Promise.all([connectDB(), connectRedis()]).then(() => {
  server.listen(3000, () => {
    console.log("Server is running on port 3000");
  });
});

module.exports = app;
