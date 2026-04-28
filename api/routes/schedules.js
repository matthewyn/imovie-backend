const express = require("express");
const router = express.Router();
const { getDB } = require("../dbs/mongo");
const { client } = require("../dbs/redis");
const { generateTimeslotsKey, generateMoviesKey } = require("../utils/keys");
const { DateTime } = require("luxon");
const { ObjectId } = require("mongodb");

router.post("/", async (req, res) => {
  try {
    const db = getDB();
    const { kategoriStudio, kategoriMovie, tanggal, waktu } = req.body;
    const dateTimeString = `${tanggal}T${waktu}`;
    const timeslotMillis = DateTime.fromISO(dateTimeString).toMillis();
    const studio = await db
      .collection("studios")
      .findOne({ _id: new ObjectId(kategoriStudio) });
    await Promise.all([
      db.collection("schedules").insertOne({
        movieId: new ObjectId(kategoriMovie),
        waktu: new Date(dateTimeString).toISOString(),
        studio: {
          _id: new ObjectId(kategoriStudio),
          nama: studio.nama,
          seats: studio.seats,
        },
      }),
      client.hSet(generateTimeslotsKey(timeslotMillis, kategoriMovie), {
        id: kategoriStudio,
        nama: studio.nama,
        seats: JSON.stringify(studio.seats),
      }), // Core operation to add timeslot to Redis
      client.del(generateMoviesKey(kategoriMovie)),
    ]);
    res.status(201).json({ message: "Schedule created successfully" });
  } catch (error) {
    console.error("Error creating schedule:", error);
    return res.status(500).json({ message: "Failed to create schedule" });
  }
});

module.exports = router;
