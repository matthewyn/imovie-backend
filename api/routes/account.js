const express = require("express");
const { sendMessage } = require("../../kafka/producer");
const authMiddleware = require("../middlewares/auth");
const { uploadToCloudinary } = require("../utils/upload");
const z = require("zod");
const { getDB } = require("../dbs/mongo");
const { client } = require("../dbs/redis");
const jwt = require("jsonwebtoken");
const { ObjectId } = require("mongodb");

const router = express.Router();

const updateProfileSchema = z.object({
  name: z.string().min(2),
  bio: z.string().max(160),
  phone: z.string().min(10),
  country: z.string().min(2),
});

const updateAddressSchema = z.object({
  country: z.string().min(2),
  state: z.string().max(25),
  city: z.string().max(30),
  postalCode: z.string().max(10),
});

router.post("/upload-photo", authMiddleware, async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ message: "No file uploaded" });
  }
  const { userId } = req.user;
  try {
    const fileUrl = await uploadToCloudinary(file);
    await sendMessage(process.env.KAFKA_TOPIC, {
      fileUrl,
      userId,
      retryCount: 0,
    });
    const token = jwt.sign(
      {
        userId,
        email: req.user.email,
        role: req.user.role,
        name: req.user.name,
        profileUrl: fileUrl,
        bio: req.user.bio,
        phone: req.user.phone,
        country: req.user.country,
        state: req.user.state,
        city: req.user.city,
        postalCode: req.user.postalCode,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" },
    );
    res.status(200).json({
      message: "File uploaded and message sent to Kafka successfully",
      token,
    });
  } catch (error) {
    console.error("Error sending message to Kafka:", error);
    return res.status(500).json({ message: "Failed to process the file" });
  }
});

router.put("/update-profile", authMiddleware, async (req, res) => {
  let { name, bio, phone, country } = req.body;
  const { userId } = req.user;
  const { success } = updateProfileSchema.safeParse({
    name,
    bio,
    phone,
    country,
  });
  if (!success) {
    return res.status(400).json({ message: "Invalid input format" });
  }
  if (!name || !phone || !country) {
    return res.status(400).json({ message: "All fields are required" });
  }
  phone = phone.replace(/\D/g, "");
  try {
    const db = getDB();
    await db.collection("users").updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          name,
          bio,
          phone,
          country,
        },
      },
    );
    const token = jwt.sign(
      {
        userId,
        email: req.user.email,
        role: req.user.role,
        name,
        profileUrl: req.user.profileUrl,
        bio,
        phone,
        country,
        state: req.user.state,
        city: req.user.city,
        postalCode: req.user.postalCode,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" },
    );
    res.status(200).json({ message: "Profile updated successfully", token });
  } catch (error) {
    console.error("Error updating profile:", error);
    return res.status(500).json({ message: "Failed to update profile" });
  }
});

router.put("/update-address", authMiddleware, async (req, res) => {
  const { country, state, city, postalCode } = req.body;
  const { userId } = req.user;
  const { success } = updateAddressSchema.safeParse({
    country,
    state,
    city,
    postalCode,
  });
  if (!success) {
    return res.status(400).json({ message: "Invalid input format" });
  }
  try {
    const db = getDB();
    await db.collection("users").updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          country,
          state,
          city,
          postalCode,
        },
      },
    );
    const token = jwt.sign(
      {
        userId,
        email: req.user.email,
        role: req.user.role,
        name: req.user.name,
        profileUrl: req.user.profileUrl,
        bio: req.user.bio,
        phone: req.user.phone,
        country: req.user.country,
        state,
        city,
        postalCode,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" },
    );
    res.status(200).json({ message: "Address updated successfully", token });
  } catch (error) {
    console.error("Error updating address:", error);
    return res.status(500).json({ message: "Failed to update address" });
  }
});

module.exports = router;
