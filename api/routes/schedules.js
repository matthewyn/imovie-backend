const express = require("express");
const router = express.Router();
const { getDB } = require("../dbs/mongo");
const { client } = require("../dbs/redis");
const {
  generateTimeslotsKey,
  generateStudiosKey,
  generateSchedulesKey,
} = require("../utils/keys");
const genId = require("../utils/genId");
const { DateTime } = require("luxon");
const { ObjectId } = require("mongodb");

router.get("/", async (req, res) => {
  res.status(200).json({ message: "Schedules endpoint is working" });
});

router.post("/", async (req, res) => {
  try {
    const db = getDB();
    const { kategoriStudio, kategoriMovie, tanggal, waktu } = req.body;
    const dateTimeString = `${tanggal}T${waktu}`;
    const timeslotMillis = DateTime.fromISO(dateTimeString).toMillis();
    const studio = await client.hGetAll(generateStudiosKey(kategoriStudio));
    const id = genId();
    await Promise.all([
      db.collection("movies").updateOne(
        { _id: new ObjectId(kategoriMovie) },
        {
          $push: {
            schedules: {
              waktu: new Date(dateTimeString).toISOString(),
              studio: {
                _id: kategoriStudio,
                nama: studio.nama,
                seats: JSON.parse(studio.seats),
              },
            },
          },
        },
      ),
      client.hSet(generateTimeslotsKey(timeslotMillis, kategoriMovie), {
        id: kategoriStudio,
        nama: studio.nama,
        seats: studio.seats,
      }),
      client.zAdd(generateSchedulesKey(kategoriMovie), {
        score: timeslotMillis,
        value: id,
      }),
    ]);
    res.status(201).json({ message: "Schedule created successfully" });
  } catch (error) {
    console.error("Error creating schedule:", error);
    return res.status(500).json({ message: "Failed to create schedule" });
  }
});

module.exports = router;
