const express = require("express");
const router = express.Router();
const { getDB } = require("../dbs/mongo");
const { uploadToCloudinary } = require("../utils/upload");
const { capitalizeFirstLetter } = require("../utils/string");
const { client } = require("../dbs/redis");
const {
  generateMoviesKey,
  generateMoviesByRatingKey,
  generateSchedulesKey,
  generateTimeslotsKey,
  generateUsersWishlistKey,
} = require("../utils/keys");
const authMiddleware = require("../middlewares/auth");

const NOW_PLAYING = "now-playing";
const UPCOMING = "upcoming";

router.get("/", async (req, res) => {
  try {
    const offset = parseInt(req.query.offset) || 0;
    const limit = parseInt(req.query.limit) || 10;
    let nowPlaying = await client.sort(generateMoviesKey(NOW_PLAYING), {
      BY: "nosort",
      GET: [
        "#",
        `${generateMoviesKey("*")}->judul`,
        `${generateMoviesKey("*")}->genre`,
        `${generateMoviesKey("*")}->durasi`,
        `${generateMoviesKey("*")}->kategoriUmur`,
        `${generateMoviesKey("*")}->filePath`,
        `${generateMoviesKey("*")}->videoUrl`,
      ],
    });
    let upcoming = await client.sort(generateMoviesKey(UPCOMING), {
      BY: "nosort",
      GET: [
        "#",
        `${generateMoviesKey("*")}->judul`,
        `${generateMoviesKey("*")}->genre`,
        `${generateMoviesKey("*")}->durasi`,
        `${generateMoviesKey("*")}->kategoriUmur`,
        `${generateMoviesKey("*")}->filePath`,
        `${generateMoviesKey("*")}->videoUrl`,
      ],
      LIMIT: {
        offset,
        count: limit,
      },
    });
    const nowPlayingMovies = [];
    const upcomingMovies = [];
    while (nowPlaying.length) {
      const [
        id,
        judul,
        genre,
        durasi,
        kategoriUmur,
        filePath,
        videoUrl,
        ...rest
      ] = nowPlaying;
      const item = deserialize(id, {
        judul,
        genre,
        durasi,
        kategoriUmur,
        filePath,
        videoUrl,
      });
      nowPlayingMovies.push(item);
      nowPlaying = rest;
    }
    while (upcoming.length) {
      const [
        id,
        judul,
        genre,
        durasi,
        kategoriUmur,
        filePath,
        videoUrl,
        ...rest
      ] = upcoming;
      const item = deserialize(id, {
        judul,
        genre,
        durasi,
        kategoriUmur,
        filePath,
        videoUrl,
      });
      upcomingMovies.push(item);
      upcoming = rest;
    }
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
    const movie = await client.hGetAll(generateMoviesKey(id));
    const { userId } = req.user;
    const schedules = await client.zRangeWithScores(
      generateSchedulesKey(id),
      0,
      -1,
    );
    if (Object.keys(movie).length === 0) {
      return res.status(404).json({ message: "Movie not found" });
    }
    const isInWishlist = await client.sIsMember(
      generateUsersWishlistKey(userId),
      id,
    );
    res
      .status(200)
      .json({ movie: deserialize(id, movie), schedules, isInWishlist });
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
      schedules: [],
      videoUrl: video,
    });
    const id = result.insertedId.toString();

    await Promise.all([
      client.hSet(generateMoviesKey(id), {
        judul,
        sinopsis,
        genre: capitalizeFirstLetter(genre),
        durasi,
        kategoriUmur,
        filePath,
        originalFileName: file ? file.originalname : null,
        runtime,
        videoUrl: video,
      }),
      client.zAdd(generateMoviesByRatingKey(), {
        score: 0,
        value: id,
      }),
    ]);
    if (runtime == NOW_PLAYING) {
      await client.sAdd(generateMoviesKey(NOW_PLAYING), id);
    } else {
      await client.sAdd(generateMoviesKey(UPCOMING), id);
    }
    res.status(201).json({ message: "Movie added successfully" });
  } catch (error) {
    console.error("Error adding movie:", error);
    res.status(500).json({ message: "Failed to add movie" });
  }
});

function deserialize(id, movie) {
  return {
    id,
    judul: movie.judul,
    sinopsis: movie.sinopsis,
    genre: movie.genre,
    durasi: parseInt(movie.durasi),
    kategoriUmur: movie.kategoriUmur,
    filePath: movie.filePath,
    videoUrl: movie.videoUrl,
  };
}

module.exports = router;
