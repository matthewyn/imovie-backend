const express = require("express");
const router = express.Router();
const { getDB } = require("../dbs/mongo");
const { generateStudiosKey } = require("../utils/keys");
const { client } = require("../dbs/redis");

const ALL = "all";

router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const db = getDB();
    const cached = await client.get(generateStudiosKey(ALL));
    if (cached) {
      const studios = JSON.parse(cached);
      return res.status(200).json(studios);
    }
    const studios = await db.collection("studios").find({}).toArray();
    await client.set(generateStudiosKey(ALL), JSON.stringify(studios));
    res.status(200).json(studios);
  } catch (error) {
    console.error("Error fetching studios:", error);
    res.status(500).json({ message: "Failed to fetch studios" });
  }
});

router.post("/", async (req, res) => {
  try {
    const db = getDB();
    let { nama, seats, kapasitas } = req.body;
    kapasitas = parseInt(kapasitas);
    await db.collection("studios").insertOne({ nama, seats, kapasitas });
    return res.status(201).json({ message: "Studio created successfully" });
  } catch (error) {
    console.error("Error creating studio:", error);
    return res.status(500).json({ message: "Failed to create studio" });
  }
});

module.exports = router;
