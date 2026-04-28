const admin = require("firebase-admin");
const { ObjectId } = require("mongodb");

async function sendPushNotification(userToken, title, body, link) {
  const response = await admin.messaging().send({
    token: userToken,
    notification: {
      title: title,
      body: body,
    },
    webpush: {
      notification: {
        icon: "https://res.cloudinary.com/dfzbnd3qk/image/upload/v1775017796/favicon_dzxsbj.png",
        badge:
          "https://res.cloudinary.com/dfzbnd3qk/image/upload/v1775017796/favicon_dzxsbj.png",
        title: title,
        body: body,
      },
      fcmOptions: {
        link: link || "https://your-domain.com",
      },
    },
  });
  console.log("Successfully sent message:", response);
}

function generateOrderNotification(
  orderId,
  userId,
  type,
  description,
  createdAt,
  title,
) {
  return {
    orderId: orderId,
    userId: new ObjectId(userId),
    type: type,
    description: description,
    createdAt: createdAt,
    isRead: 0,
    title: title,
    link: `/account/orders/${orderId}`,
  };
}

module.exports = { sendPushNotification, generateOrderNotification };
