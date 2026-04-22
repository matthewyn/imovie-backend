const express = require("express");
const router = express.Router();
const { getDB } = require("../dbs/mongo");
const { ObjectId } = require("mongodb");
const { client } = require("../dbs/redis");
const {
  generateUsersOrderKey,
  generateOrdersKey,
  generateTimeslotsKey,
  generateOrdersPendingByUserKey,
  generateOrdersCompleteByUserKey,
  generateExpirationKey,
  generateOrdersCancelledByUserKey,
  generateNotifyKey,
  generateUsersNotificationsKey,
  generateNotificationsKey,
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
const EXPIRATION_TIME = 5 * 60 * 1000;
const NOTIFY_TIME = EXPIRATION_TIME - 2 * 60 * 1000;

router.get("/", authMiddleware, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 0;
    const limit = parseInt(req.query.limit) || 10;
    const id = req.user.userId;
    const orderCount = await client.sCard(generateUsersOrderKey(id));
    const totalPages = Math.ceil(orderCount / limit);
    let result = await client.sort(generateUsersOrderKey(id), {
      BY: "nosort",
      GET: [
        "#",
        `${generateOrdersKey("*")}->seats`,
        `${generateOrdersKey("*")}->jam`,
        `${generateOrdersKey("*")}->studio`,
        `${generateOrdersKey("*")}->judul`,
        `${generateOrdersKey("*")}->status`,
        `${generateOrdersKey("*")}->totalPrice`,
        `${generateOrdersKey("*")}->filePath`,
        `${generateOrdersKey("*")}->snacks`,
      ],
      LIMIT: {
        offset: (page - 1) * limit,
        count: limit,
      },
      DIRECTION: "DESC",
    });
    const orders = [];
    while (result.length) {
      const [
        id,
        seats,
        jam,
        studio,
        judul,
        status,
        totalPrice,
        filePath,
        snacks,
        ...rest
      ] = result;
      const item = deserialize(id, {
        seats,
        jam,
        studio,
        judul,
        status,
        totalPrice,
        filePath,
        snacks,
      });
      orders.push(item);
      result = rest;
    }
    res.status(200).json({ orders, totalPages });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/pending-payment", authMiddleware, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 0;
    const limit = parseInt(req.query.limit) || 10;
    const id = req.user.userId;
    const orderCount = await client.sCard(generateOrdersPendingByUserKey(id));
    const totalPages = Math.ceil(orderCount / limit);
    let result = await client.sort(generateOrdersPendingByUserKey(id), {
      BY: "nosort",
      GET: [
        "#",
        `${generateOrdersKey("*")}->seats`,
        `${generateOrdersKey("*")}->jam`,
        `${generateOrdersKey("*")}->studio`,
        `${generateOrdersKey("*")}->judul`,
        `${generateOrdersKey("*")}->status`,
        `${generateOrdersKey("*")}->totalPrice`,
        `${generateOrdersKey("*")}->filePath`,
        `${generateOrdersKey("*")}->snacks`,
      ],
      LIMIT: {
        offset: (page - 1) * limit,
        count: limit,
      },
      DIRECTION: "DESC",
    });
    const orders = [];
    while (result.length) {
      const [
        id,
        seats,
        jam,
        studio,
        judul,
        status,
        totalPrice,
        filePath,
        snacks,
        ...rest
      ] = result;
      const item = deserialize(id, {
        seats,
        jam,
        studio,
        judul,
        status,
        totalPrice,
        filePath,
        snacks,
      });
      orders.push(item);
      result = rest;
    }
    res.status(200).json({ orders, totalPages });
  } catch (error) {
    console.error("Error fetching pending payment orders:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/confirmed", authMiddleware, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 0;
    const limit = parseInt(req.query.limit) || 10;
    const id = req.user.userId;
    const orderCount = await client.sCard(generateOrdersCompleteByUserKey(id));
    const totalPages = Math.ceil(orderCount / limit);
    let result = await client.sort(generateOrdersCompleteByUserKey(id), {
      BY: "nosort",
      GET: [
        "#",
        `${generateOrdersKey("*")}->seats`,
        `${generateOrdersKey("*")}->jam`,
        `${generateOrdersKey("*")}->studio`,
        `${generateOrdersKey("*")}->judul`,
        `${generateOrdersKey("*")}->status`,
        `${generateOrdersKey("*")}->totalPrice`,
        `${generateOrdersKey("*")}->filePath`,
        `${generateOrdersKey("*")}->snacks`,
      ],
      LIMIT: {
        offset: (page - 1) * limit,
        count: limit,
      },
      DIRECTION: "DESC",
    });
    const orders = [];
    while (result.length) {
      const [
        id,
        seats,
        jam,
        studio,
        judul,
        status,
        totalPrice,
        filePath,
        snacks,
        ...rest
      ] = result;
      const item = deserialize(id, {
        seats,
        jam,
        studio,
        judul,
        status,
        totalPrice,
        filePath,
        snacks,
      });
      orders.push(item);
      result = rest;
    }
    res.status(200).json({ orders, totalPages });
  } catch (error) {
    console.error("Error fetching pending payment orders:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/cancelled", authMiddleware, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 0;
    const limit = parseInt(req.query.limit) || 10;
    const id = req.user.userId;
    const orderCount = await client.sCard(generateOrdersCancelledByUserKey(id));
    const totalPages = Math.ceil(orderCount / limit);
    let result = await client.sort(generateOrdersCancelledByUserKey(id), {
      BY: "nosort",
      GET: [
        "#",
        `${generateOrdersKey("*")}->seats`,
        `${generateOrdersKey("*")}->jam`,
        `${generateOrdersKey("*")}->studio`,
        `${generateOrdersKey("*")}->judul`,
        `${generateOrdersKey("*")}->status`,
        `${generateOrdersKey("*")}->totalPrice`,
        `${generateOrdersKey("*")}->filePath`,
        `${generateOrdersKey("*")}->snacks`,
      ],
      LIMIT: {
        offset: (page - 1) * limit,
        count: limit,
      },
      DIRECTION: "DESC",
    });
    const orders = [];
    while (result.length) {
      const [
        id,
        seats,
        jam,
        studio,
        judul,
        status,
        totalPrice,
        filePath,
        snacks,
        ...rest
      ] = result;
      const item = deserialize(id, {
        seats,
        jam,
        studio,
        judul,
        status,
        totalPrice,
        filePath,
        snacks,
      });
      orders.push(item);
      result = rest;
    }
    res.status(200).json({ orders, totalPages });
  } catch (error) {
    console.error("Error fetching pending payment orders:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const orderData = await client.hGetAll(generateOrdersKey(id));
    if (Object.keys(orderData).length === 0) {
      return res.status(404).json({ message: "Order not found" });
    }
    const order = deserialize(id, orderData);
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
      idMovie,
      seats,
      selectedTime,
      studio,
      judul,
      totalPrice,
      filePath,
      token,
    } = req.body;
    const { userId, email } = req.user;
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
        generateTimeslotsKey(selectedTime, idMovie),
        generateExpirationKey(id),
        generateNotifyKey(id),
      ],
      arguments: [
        JSON.stringify(seats),
        EXPIRATION_TIME.toString(),
        NOTIFY_TIME.toString(),
        userId,
        token,
      ],
    });
    if (!result) {
      return res.status(400).json({ message: "Some seats are already booked" });
    }
    const now = DateTime.now().toMillis();
    await Promise.all([
      db.collection("users").updateOne(
        { email: email },
        {
          $push: {
            orders: {
              id,
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
              idMovie,
              snacks: [],
              paymentDeadline: new Date(
                Date.now() + EXPIRATION_TIME,
              ).toISOString(),
            },
            notifications: generateOrderNotification(
              id,
              "order-created",
              `Your order for ${judul} has been created. Please complete the payment before the deadline.`,
              new Date().toISOString(),
              "Order Created",
            ),
          },
        },
      ),
      client.hSet(
        generateOrdersKey(id),
        serialize({
          seats,
          jam: selectedTime,
          studio,
          judul,
          status: JSON.stringify([
            {
              tipe: PENDING_PAYMENT,
              createdAt: DateTime.now().toMillis(),
            },
          ]),
          totalPrice,
          filePath,
          idMovie,
          snacks: [],
          paymentDeadline: DateTime.now()
            .plus({ milliseconds: EXPIRATION_TIME })
            .toMillis(),
        }),
      ),
      client.hSet(
        generateNotificationsKey(`${now}:${id}`),
        generateOrderNotification(
          id,
          "order-created",
          `Your order for ${judul} has been created. Please complete the payment before the deadline.`,
          now,
          "Order Created",
        ),
      ),
      client.sAdd(generateUsersOrderKey(userId), id),
      client.sAdd(generateOrdersPendingByUserKey(userId), id),
      client.zAdd(generateUsersNotificationsKey(userId), {
        score: now,
        value: `${now}:${id}`,
      }),
      db.collection("movies").updateOne(
        {
          _id: new ObjectId(idMovie),
          schedules: {
            $elemMatch: {
              waktu: ISOTime,
            },
          },
        },
        {
          $set: {
            "schedules.$.studio.seats": JSON.parse(result),
          },
        },
      ),
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
    const { idMovie, selectedTime, seats, snacks, totalPrice } = req.body;
    const { userId, email } = req.user;
    const db = getDB();
    await client.eval(confirmPaymentScript, {
      keys: [
        generateTimeslotsKey(selectedTime, idMovie),
        generateOrdersKey(id),
        generateOrdersPendingByUserKey(userId),
        generateOrdersCompleteByUserKey(userId),
        generateExpirationKey(id),
        generateExpirationKey(id) + ":data",
        generateNotifyKey(id),
        generateNotifyKey(id) + ":data",
      ],
      arguments: [
        JSON.stringify(seats),
        id,
        Date.now().toString(),
        JSON.stringify(snacks),
        totalPrice.toString(),
      ],
    });
    await db.collection("users").updateOne(
      { email: email, "orders.id": id },
      {
        $push: {
          "orders.$.status": {
            tipe: CONFIRMED_PAYMENT,
            createdAt: new Date().toISOString(),
          },
        },
        $set: {
          "orders.$.snacks": snacks,
          "orders.$.totalPrice": totalPrice,
        },
      },
    );
    const now = DateTime.now().toMillis();
    await Promise.all([
      db.collection("users").updateOne(
        { email: email },
        {
          $push: {
            notifications: generateOrderNotification(
              id,
              "order-confirmed",
              `Your order for ${judul} has been confirmed.`,
              new Date().toISOString(),
              "Order Confirmed",
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
          "order-confirmed",
          `Your order for ${judul} has been confirmed.`,
          now,
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
