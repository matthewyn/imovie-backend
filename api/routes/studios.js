const express = require("express");
const router = express.Router();
const { getDB } = require("../dbs/mongo");
const { generateStudiosKey } = require("../utils/keys");
const { client } = require("../dbs/redis");

router.get("/", async (req, res) => {
  try {
    const offset = parseInt(req.query.offset) || 0;
    const limit = parseInt(req.query.limit) || 10;
    let result = await client.sort(generateStudiosKey("all"), {
      BY: "nosort",
      GET: [
        "#",
        `${generateStudiosKey("*")}->nama`,
        `${generateStudiosKey("*")}->seats`,
        `${generateStudiosKey("*")}->kapasitas`,
      ],
    });
    const studios = [];
    while (result.length) {
      const [id, nama, seats, kapasitas, ...rest] = result;
      const item = deserialize(id, {
        nama,
        seats,
        kapasitas,
      });
      studios.push(item);
      result = rest;
    }
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
    const result = await db
      .collection("studios")
      .insertOne({ nama, seats, kapasitas });
    const id = result.insertedId.toString();
    await Promise.all([
      client.hSet(
        generateStudiosKey(id),
        serialize({ nama, seats, kapasitas }),
      ),
      client.sAdd(generateStudiosKey("all"), id),
    ]);
    return res.status(201).json({ message: "Studio created successfully" });
  } catch (error) {
    console.error("Error creating studio:", error);
    return res.status(500).json({ message: "Failed to create studio" });
  }
});

function serialize(studio) {
  return {
    nama: studio.nama,
    seats: JSON.stringify(studio.seats),
    kapasitas: studio.kapasitas,
  };
}

function deserialize(id, studio) {
  return {
    id,
    nama: studio.nama,
    seats: JSON.parse(studio.seats),
    kapasitas: parseInt(studio.kapasitas),
  };
}

module.exports = router;
