const express = require("express");
const admin = require("firebase-admin");
const router = express.Router();

router.post("/test", async (req, res) => {
  try {
    const { token, title, body, data } = req.body; // ✅ Extract variables!

    const message = {
      token,
      notification: {
        title: title || "Test Notification",
        body: body || "This is a test notification from iMovie",
      },
      data: data || { type: "test" },
      webpush: {
        fcmOptions: {
          link: data?.url || "/",
        },
      },
    };
    const response = await admin.messaging().send(message);
    console.log("Successfully sent message:", response);
    res.status(200).json({ message: "Notification sent successfully" });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
