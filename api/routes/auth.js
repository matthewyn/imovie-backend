const express = require("express");
const bcrypt = require("bcrypt");
const { getDB } = require("../dbs/mongo");
const { client } = require("../dbs/redis");
const { generateEmailsUniqueKey } = require("../utils/keys");
const authMiddleware = require("../middlewares/auth");
const z = require("zod");
const jwt = require("jsonwebtoken");

const router = express.Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const signupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().min(10),
  country: z.string().min(2),
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
    const db = getDB();
    const user = await db.collection("users").findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
        name: user.name,
        profileUrl: user.profileUrl,
        bio: user.bio,
        phone: user.phone,
        country: user.country,
        state: user.state,
        city: user.city,
        postalCode: user.postalCode,
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
  let { name, email, password, phone, country } = req.body;
  const { success } = signupSchema.safeParse({
    name,
    email,
    password,
    phone,
    country,
  });
  if (!success) {
    return res.status(400).json({ message: "Invalid input data" });
  }
  if (!name || !email || !password || !phone || !country) {
    return res.status(400).json({ message: "All fields are required" });
  }
  phone = phone.replace(/\D/g, "");
  try {
    const emailExists = await client.sIsMember(
      generateEmailsUniqueKey(),
      email,
    );
    if (emailExists) {
      return res.status(400).json({ message: "Email already exists" });
    }
    const db = getDB();
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await db.collection("users").insertOne({
      name,
      email,
      password: hashedPassword,
      phone,
      country,
      state: "",
      city: "",
      postalCode: "",
      bio: "",
      role: "user",
    });
    await client.sAdd(generateEmailsUniqueKey(), email);
    const token = jwt.sign(
      {
        userId: user.insertedId.toString(),
        name,
        email,
        role: "user",
        phone,
        country,
        state: "",
        city: "",
        postalCode: "",
        bio: "",
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
