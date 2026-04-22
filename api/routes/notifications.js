const express = require("express");
const authMiddleware = require("../middlewares/auth");
const router = express.Router();
const {
  generateUsersNotificationsKey,
  generateNotificationsKey,
} = require("../utils/keys");
const { client } = require("../dbs/redis");
const { DateTime } = require("luxon");

router.get("/", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user;
    const offset = parseInt(req.query.offset) || 0;
    const limit = parseInt(req.query.limit) || 10;
    let result = await client.sort(generateUsersNotificationsKey(userId), {
      BY: "nosort",
      GET: [
        "#",
        `${generateNotificationsKey("*")}->type`,
        `${generateNotificationsKey("*")}->description`,
        `${generateNotificationsKey("*")}->isRead`,
        `${generateNotificationsKey("*")}->createdAt`,
        `${generateNotificationsKey("*")}->title`,
        `${generateNotificationsKey("*")}->link`,
      ],
      LIMIT: {
        offset,
        count: limit,
      },
    });
    const notifications = [];
    while (result.length) {
      const [id, type, description, isRead, createdAt, title, link, ...rest] =
        result;
      const item = deserialize(id, {
        type,
        description,
        isRead,
        createdAt,
        title,
        link,
      });
      notifications.push(item);
      result = rest;
    }
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

function deserialize(id, data) {
  return {
    id,
    createdAt: DateTime.fromMillis(parseInt(data.createdAt)),
    isRead: data.isRead === "1",
    type: data.type,
    description: data.description,
    title: data.title,
    link: data.link,
  };
}

module.exports = router;
