const express = require("express");
const authMiddleware = require("../middlewares/auth");
const router = express.Router();
const { generateNotificationsKey } = require("../utils/keys");
const { client } = require("../dbs/redis");
const { DateTime } = require("luxon");
const { getDB } = require("../dbs/mongo");
const { ObjectId } = require("mongodb");

router.get("/", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const db = getDB();
    const notifications = await db
      .collection("notifications")
      .find({ userId: new ObjectId(userId) })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();
    res.status(200).json({ notifications });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// router.put("/", authMiddleware, async (req, res) => {
//   try {
//     const { userId } = req.user;
//     const { notificationIds } = req.body;

//     if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
//       return res.status(400).json({ error: "Invalid notificationIds" });
//     }

//     const pipeline = client.pipeline();
//     notificationIds.forEach((id) => {
//       pipeline.hSet(generateNotificationsKey(id), "isRead", "1");
//     });
//     await pipeline.exec();

//     res.status(200).json({ message: "Notifications marked as read" });
//   } catch (error) {
//     console.error("Error updating notifications:", error);
//     res.status(500).json({ error: "Failed to update notifications" });
//   }
// });

module.exports = router;
