const express = require("express");
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
const z = require("zod");
const jwt = require("jsonwebtoken");

const router = express.Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const signupSchema = z.object({
  username: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(6),
});

router.get("/me", authMiddleware, async (req, res) => {
  res.json({ user: req.user });
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const { success } = loginSchema.safeParse({ email, password });
    if (!success) {
      return res.status(400).json({ message: "Invalid input data" });
    }
    const decimalId = await client.zScore(generateEmailsKey(), email);
    if (!decimalId) {
      return res.status(400).json({ message: "Invalid email or password" });
    }
    const user = await client.hGetAll(generateUsersKey(decimalId.toString(16)));
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }
    const token = jwt.sign(
      {
        userId: decimalId.toString(16),
        username: user.username,
        email: user.email,
        role: user.role,
        name: user.name,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" },
    );
    res.json({ message: "Login successful", token });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;

  const { success } = signupSchema.safeParse({ username, email, password });
  if (!success) {
    return res.status(400).json({ message: "Invalid input data" });
  }

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
        .insertOne({ username, email, password: hashedPassword, role: "user" }),
      client.hSet(generateUsersKey(id), {
        username,
        email,
        password: hashedPassword,
        role: "user",
      }),
      client.zAdd(generateEmailsKey(), {
        score: parseInt(id, 16),
        value: email,
      }),
      client.sAdd(generateEmailsUniqueKey(), email),
    ]);
    const token = jwt.sign(
      {
        userId: id,
        username,
        email,
        role: "user",
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" },
    );
    res.status(201).json({ message: "User created successfully", token });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/logout", authMiddleware, (req, res) => {
  res.json({
    message: "Logout successful. Please discard the token on the client side.",
  });
});

module.exports = router;
