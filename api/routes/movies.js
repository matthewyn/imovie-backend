const express = require("express");
const router = express.Router();
const { getDB } = require("../dbs/mongo");
const { uploadToCloudinary } = require("../utils/upload");
const { capitalizeFirstLetter } = require("../utils/string");
const { client } = require("../dbs/redis");
const { generateMoviesKey, generateTimeslotsKey } = require("../utils/keys");
const authMiddleware = require("../middlewares/auth");
const { ObjectId } = require("mongodb");

const NOW_PLAYING = "now-playing";
const UPCOMING = "upcoming";
const ALL = "all";

router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const db = getDB();
    const cached = await client.get(generateMoviesKey(ALL));
    if (cached) {
      const movies = JSON.parse(cached);
      return res.status(200).json(movies);
    }
    const nowPlayingMovies = await db
      .collection("movies")
      .find(
        { runtime: NOW_PLAYING },
        {
          projection: {
            judul: 1,
            genre: 1,
            durasi: 1,
            kategoriUmur: 1,
            filePath: 1,
            videoUrl: 1,
            runtime: 1,
          },
        },
      )
      .toArray();
    const upcomingMovies = await db
      .collection("movies")
      .find(
        { runtime: UPCOMING },
        {
          projection: {
            judul: 1,
            genre: 1,
            durasi: 1,
            kategoriUmur: 1,
            filePath: 1,
            videoUrl: 1,
            runtime: 1,
          },
        },
        {
          limit,
        },
      )
      .toArray();
    await client.set(
      generateMoviesKey(ALL),
      JSON.stringify({
        nowPlaying: nowPlayingMovies,
        upcoming: upcomingMovies,
      }),
    );
    res.status(200).json({
      nowPlaying: nowPlayingMovies,
      upcoming: upcomingMovies,
    });
  } catch (error) {
    console.error("Error fetching movies:", error);
    res.status(500).json({ message: "Failed to fetch movies" });
  }
});

router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const id = req.params.id;
    const { userId } = req.user;
    const db = getDB();
    const isInWishlist = await db.collection("users").findOne({
      _id: new ObjectId(userId),
      wishlists: new ObjectId(id),
    });
    const cached = await client.get(generateMoviesKey(id));
    if (cached) {
      const { movie, schedules } = JSON.parse(cached);
      return res
        .status(200)
        .json({ movie, schedules, isInWishlist: isInWishlist ? true : false });
    }
    const movie = await db
      .collection("movies")
      .findOne({ _id: new ObjectId(id) });
    const schedules = await db
      .collection("schedules")
      .find({ movieId: new ObjectId(id) }, { projection: { waktu: 1 } })
      .toArray();
    await client.set(
      generateMoviesKey(id),
      JSON.stringify({ movie, schedules }),
    );
    res
      .status(200)
      .json({ movie, schedules, isInWishlist: isInWishlist ? true : false });
  } catch (error) {
    console.error("Error fetching movie:", error);
    res.status(500).json({ message: "Failed to fetch movie" });
  }
});

router.get("/:id/schedules/:selectedTime", async (req, res) => {
  try {
    const { id, selectedTime } = req.params;
    const timeslot = await client.hGetAll(
      generateTimeslotsKey(selectedTime, id),
    );
    res.status(200).json({ ...timeslot, seats: JSON.parse(timeslot.seats) });
  } catch (error) {
    console.error("Error fetching schedules:", error);
    res.status(500).json({ message: "Failed to fetch schedules" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { judul, sinopsis, genre, jam, menit, kategoriUmur, runtime, video } =
      req.body;
    const durasi = parseInt(jam) * 60 + parseInt(menit);
    const file = req.file;
    const db = getDB();

    let filePath = null;
    if (file) {
      filePath = await uploadToCloudinary(file);
    }

    const result = await db.collection("movies").insertOne({
      judul,
      sinopsis,
      genre: capitalizeFirstLetter(genre),
      durasi,
      kategoriUmur,
      filePath,
      originalFileName: file ? file.originalname : null,
      runtime,
      videoUrl: video,
      rating: 0,
      ratingCount: 0,
    });
    await client.del(generateMoviesKey(ALL));
    res.status(201).json({ message: "Movie added successfully" });
  } catch (error) {
    console.error("Error adding movie:", error);
    res.status(500).json({ message: "Failed to add movie" });
  }
});

module.exports = router;
