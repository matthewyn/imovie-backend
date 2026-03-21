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
  generateLockTimeslotsKey,
} = require("../utils/keys");
const authMiddleware = require("../middlewares/auth");
const { DateTime } = require("luxon");
const genId = require("../utils/genId");
const { default: Redlock } = require("redlock");

const PENDING_PAYMENT = "pending-payment";
const CONFIRMED_PAYMENT = "confirmed";
const LOCK_TTL = 4000;

const redlock = new Redlock([client], {
  retryCount: 4,
  retryDelay: 200,
});

router.get("/", authMiddleware, async (req, res) => {
  try {
    const offset = parseInt(req.query.offset) || 0;
    const limit = parseInt(req.query.limit) || 10;
    const id = req.user.userId;
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
        offset,
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
    res.status(200).json(orders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/pending-payment", authMiddleware, async (req, res) => {
  try {
    const id = req.user.userId;
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
    res.status(200).json(orders);
  } catch (error) {
    console.error("Error fetching pending payment orders:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/confirmed", authMiddleware, async (req, res) => {
  try {
    const id = req.user.userId;
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
    res.status(200).json(orders);
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
  let lock;
  try {
    const db = getDB();
    let { idMovie, seats, selectedTime, studio, judul, totalPrice, filePath } =
      req.body;
    const { userId, email } = req.user;
    const isPending = await client.sMembers(
      generateOrdersPendingByUserKey(userId),
    );
    if (isPending.length > 0) {
      return res
        .status(400)
        .json({ message: "You have pending payment orders" });
    }
    lock = await redlock.acquire(
      [generateLockTimeslotsKey(selectedTime, idMovie)],
      LOCK_TTL,
    );
    const id = genId();
    const ISOTime = DateTime.fromMillis(selectedTime).toUTC().toISO();
    const currentSeats = JSON.parse(
      await client.hGet(generateTimeslotsKey(selectedTime, idMovie), "seats"),
    );
    seats.forEach((seat) => {
      const [row, col] = seatLabelToIndex(seat);
      if (currentSeats[row][col] === 0) {
        throw new Error(`Seat ${seat} is already booked`);
      }
      currentSeats[row][col] = 0;
    });
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
              snacks: [],
            },
          },
        },
      ),
      client.hSet(
        generateTimeslotsKey(selectedTime, idMovie),
        "seats",
        JSON.stringify(currentSeats),
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
          snacks: [],
        }),
      ),
      client.sAdd(generateUsersOrderKey(userId), id),
      client.sAdd(generateOrdersPendingByUserKey(userId), id),
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
            "schedules.$.studio.seats": currentSeats,
          },
        },
      ),
    ]);
    res.status(201).json({ message: "Order created successfully", id });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    if (lock) {
      await lock.release().catch((err) => {
        console.error("Error releasing lock:", err);
      });
    }
  }
});

router.post("/confirm-payment/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { snacks, totalPrice } = req.body;
    const { userId, email } = req.user;
    const db = getDB();
    let currentStatus = JSON.parse(
      await client.hGet(generateOrdersKey(id), "status"),
    );
    currentStatus.push({
      tipe: CONFIRMED_PAYMENT,
      createdAt: DateTime.now().toMillis(),
    });
    await Promise.all([
      db.collection("users").updateOne(
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
      ),
      client.hSet(generateOrdersKey(id), {
        status: JSON.stringify(currentStatus),
        snacks: JSON.stringify(snacks),
      }),
      client.sRem(generateOrdersPendingByUserKey(userId), id),
      client.sAdd(generateOrdersCompleteByUserKey(userId), id),
    ]);
    res.status(201).json({ message: "Payment confirmed successfully" });
  } catch (error) {
    console.error("Error confirming payment:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

function seatLabelToIndex(label) {
  const [rowLetter, col] = label.split("-");
  const row = rowLetter.charCodeAt(0) - 65;
  const colIndex = parseInt(col) - 1;

  return [row, colIndex];
}

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
    snacks: order.snacks ? JSON.parse(order.snacks) : null,
  };
}

module.exports = router;
