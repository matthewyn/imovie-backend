const express = require("express");
const router = express.Router();
const { getDB } = require("../dbs/mongo");
const { ObjectId } = require("mongodb");
const { client } = require("../dbs/redis");
const {
  generateTimeslotsKey,
  generateOrdersPendingByUserKey,
  generateExpirationKey,
  generateNotifyKey,
} = require("../utils/keys");
const authMiddleware = require("../middlewares/auth");
const { DateTime } = require("luxon");
const genId = require("../utils/genId");
const {
  reserveSeatsScript,
  confirmPaymentScript,
} = require("../utils/scripts");
const { generateOrderNotification } = require("../utils/notifications");

const PENDING_PAYMENT = "pending-payment";
const CONFIRMED_PAYMENT = "confirmed";
const CANCELLED_PAYMENT = "cancelled";
const EXPIRATION_TIME = 15 * 60 * 1000;
const NOTIFY_TIME = EXPIRATION_TIME - 5 * 60 * 1000;

router.get("/", authMiddleware, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const db = getDB();
    const id = req.user.userId;
    const orderCount = await db
      .collection("orders")
      .countDocuments({ userId: new ObjectId(id) });
    const totalPages = Math.ceil(orderCount / limit);
    const orders = await db
      .collection("orders")
      .find({ userId: new ObjectId(id) })
      .project({ userId: 0, movieId: 0 })
      .sort({ paymentDeadline: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();
    res.status(200).json({ orders, totalPages });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/pending-payment", authMiddleware, async (req, res) => {
  try {
    const db = getDB();
    const id = req.user.userId;
    const orders = await db
      .collection("orders")
      .find({
        userId: new ObjectId(id),
        status: {
          $size: 1,
        },
      })
      .project({ userId: 0, movieId: 0 })
      .sort({ paymentDeadline: -1 })
      .toArray();
    res.status(200).json({ orders, totalPages: 1 });
  } catch (error) {
    console.error("Error fetching pending payment orders:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/confirmed", authMiddleware, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const id = req.user.userId;
    const db = getDB();
    const orderCount = await db.collection("orders").countDocuments({
      userId: new ObjectId(id),
      $expr: {
        $eq: [{ $arrayElemAt: ["$status.tipe", -1] }, CONFIRMED_PAYMENT],
      },
    });
    const totalPages = Math.ceil(orderCount / limit);
    const orders = await db
      .collection("orders")
      .find({
        userId: new ObjectId(id),
        $expr: {
          $eq: [{ $arrayElemAt: ["$status.tipe", -1] }, CONFIRMED_PAYMENT],
        },
      })
      .project({ userId: 0, movieId: 0 })
      .sort({ paymentDeadline: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();
    res.status(200).json({ orders, totalPages });
  } catch (error) {
    console.error("Error fetching confirmed orders:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/cancelled", authMiddleware, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const id = req.user.userId;
    const db = getDB();
    const orderCount = await db.collection("orders").countDocuments({
      userId: new ObjectId(id),
      $expr: {
        $eq: [{ $arrayElemAt: ["$status.tipe", -1] }, CANCELLED_PAYMENT],
      },
    });
    const totalPages = Math.ceil(orderCount / limit);
    const orders = await db
      .collection("orders")
      .find({
        userId: new ObjectId(id),
        $expr: {
          $eq: [{ $arrayElemAt: ["$status.tipe", -1] }, CANCELLED_PAYMENT],
        },
      })
      .project({ userId: 0, movieId: 0 })
      .sort({ paymentDeadline: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();
    res.status(200).json({ orders, totalPages });
  } catch (error) {
    console.error("Error fetching cancelled orders:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDB();
    const order = await db
      .collection("orders")
      .findOne({ _id: id }, { projection: { userId: 0 } });
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    res.status(200).json(order);
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/", authMiddleware, async (req, res) => {
  try {
    const db = getDB();
    let {
      movieId,
      seats,
      selectedTime,
      studio,
      judul,
      totalPrice,
      filePath,
      token,
    } = req.body;
    const { userId } = req.user;
    const hasPending = await client.exists(
      generateOrdersPendingByUserKey(userId),
    );
    if (hasPending) {
      return res
        .status(400)
        .json({ message: "You have pending payment orders" });
    }
    const id = genId();
    const ISOTime = DateTime.fromMillis(selectedTime).toUTC().toISO();
    const result = await client.eval(reserveSeatsScript, {
      keys: [
        generateTimeslotsKey(selectedTime, movieId),
        generateExpirationKey(id),
        generateNotifyKey(id),
      ],
      arguments: [
        JSON.stringify(seats),
        EXPIRATION_TIME.toString(),
        NOTIFY_TIME.toString(),
        userId,
        token,
        judul,
      ],
    });
    if (!result) {
      return res.status(400).json({ message: "Some seats are already booked" });
    }
    await Promise.all([
      db.collection("orders").insertOne({
        _id: id,
        userId: new ObjectId(userId),
        movieId: new ObjectId(movieId),
        seats,
        jam: ISOTime,
        studio,
        judul,
        status: [
          {
            tipe: PENDING_PAYMENT,
            createdAt: new Date().toISOString(),
          },
        ],
        totalPrice,
        filePath,
        snacks: [],
        paymentDeadline: new Date(Date.now() + EXPIRATION_TIME).toISOString(),
      }),
      db
        .collection("notifications")
        .insertOne(
          generateOrderNotification(
            id,
            userId,
            "order-created",
            `Your order for ${judul} has been created. Please complete the payment before the deadline.`,
            new Date().toISOString(),
            "Order Created",
          ),
        ),
      db.collection("schedules").updateOne(
        {
          movieId: new ObjectId(movieId),
          waktu: ISOTime,
        },
        {
          $set: {
            "studio.seats": JSON.parse(result),
          },
        },
      ),
      client.sAdd(generateOrdersPendingByUserKey(userId), id),
    ]);
    res.status(201).json({ message: "Order created successfully", id });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/confirm-payment/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { movieId, selectedTime, seats, snacks, totalPrice, judul } =
      req.body;
    const { userId } = req.user;
    const db = getDB();
    const millis = DateTime.fromISO(selectedTime).toMillis();
    await client.eval(confirmPaymentScript, {
      keys: [
        generateTimeslotsKey(millis, movieId),
        generateOrdersPendingByUserKey(userId),
        generateExpirationKey(id),
        generateExpirationKey(id) + ":data",
        generateNotifyKey(id),
        generateNotifyKey(id) + ":data",
      ],
      arguments: [JSON.stringify(seats), id],
    });
    await Promise.all([
      db.collection("orders").updateOne(
        { _id: id },
        {
          $push: {
            status: {
              tipe: CONFIRMED_PAYMENT,
              createdAt: new Date().toISOString(),
            },
          },
          $set: {
            snacks: snacks,
            totalPrice: totalPrice,
          },
        },
      ),
      db
        .collection("notifications")
        .insertOne(
          generateOrderNotification(
            id,
            userId,
            "order-confirmed",
            `Your order for ${judul} has been confirmed.`,
            new Date().toISOString(),
            "Order Confirmed",
          ),
        ),
    ]);
    res.status(201).json({ message: "Payment confirmed successfully" });
  } catch (error) {
    console.error("Error confirming payment:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

function serialize(order) {
  return {
    ...order,
    seats: JSON.stringify(order.seats),
    snacks: JSON.stringify(order.snacks),
  };
}

function deserialize(id, order) {
  return {
    id,
    ...order,
    seats: JSON.parse(order.seats),
    jam: parseInt(order.jam),
    totalPrice: parseFloat(order.totalPrice),
    status: JSON.parse(order.status),
    snacks: JSON.parse(order.snacks),
    paymentDeadline: parseInt(order.paymentDeadline),
    rating: order.rating ? parseInt(order.rating) : null,
  };
}

module.exports = router;
