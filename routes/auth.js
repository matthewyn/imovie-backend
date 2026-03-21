const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const { getDB } = require("../dbs/mongo");
const { client } = require("../dbs/redis");
const {
  generateUsersKey,
  generateEmailsKey,
  generateEmailsUniqueKey,
  generateSessionsKey,
} = require("../utils/keys");
const genId = require("../utils/genId");
const authMiddleware = require("../middlewares/auth");

router.get("/me", authMiddleware, async (req, res) => {
  res.json({ user: req.user });
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const decimalId = await client.zScore(generateEmailsKey(), email);
    if (!decimalId) {
      return res.status(400).json({ message: "Invalid email or password" });
    }
    const user = await client.hGetAll(generateUsersKey(decimalId.toString(16)));
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }
    const sessionId = genId();
    await client.hSet(generateSessionsKey(sessionId), {
      userId: decimalId.toString(16),
      username: user.username,
      email: user.email,
    });
    await client.expire(generateSessionsKey(sessionId), 60 * 60 * 24);
    res.cookie("sessionId", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
    res.json({ message: "Login successful" });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res
      .status(400)
      .json({ message: "Username, email, and password are required" });
  }
  try {
    const emailExists = await client.sIsMember(
      generateEmailsUniqueKey(),
      email,
    );
    if (emailExists) {
      return res.status(400).json({ message: "Email already exists" });
    }
    const id = genId();
    const db = getDB();
    const hashedPassword = await bcrypt.hash(password, 10);
    await Promise.all([
      db
        .collection("users")
        .insertOne({ username, email, password: hashedPassword }),
      client.hSet(generateUsersKey(id), {
        username,
        email,
        password: hashedPassword,
      }),
      client.zAdd(generateEmailsKey(), {
        score: parseInt(id, 16),
        value: email,
      }),
      client.sAdd(generateEmailsUniqueKey(), email),
    ]);
    res.status(201).json({ message: "User created successfully", id });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/logout", async (req, res) => {
  try {
    const sessionId = req.cookies.sessionId;
    if (sessionId) {
      await client.del(generateSessionsKey(sessionId));
      res.clearCookie("sessionId");
    }
    res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    console.error("Error during logout:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
