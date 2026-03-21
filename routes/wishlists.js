const express = require("express");
const router = express.Router();
const { client } = require("../dbs/redis");
const { getDB } = require("../dbs/mongo");
const { ObjectId } = require("mongodb");
const {
  generateUsersWishlistKey,
  generateMoviesKey,
} = require("../utils/keys");
const authMiddleware = require("../middlewares/auth");

router.get("/", authMiddleware, async (req, res) => {
  try {
    const offset = parseInt(req.query.offset) || 0;
    const limit = parseInt(req.query.limit) || 10;
    const id = req.user.userId;
    let result = await client.sort(generateUsersWishlistKey(id), {
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
    const wishlists = [];
    while (result.length) {
      const [
        id,
        judul,
        genre,
        durasi,
        kategoriUmur,
        filePath,
        videoUrl,
        ...rest
      ] = result;
      const item = deserialize(id, {
        judul,
        genre,
        durasi,
        kategoriUmur,
        filePath,
        videoUrl,
      });
      wishlists.push(item);
      result = rest;
    }
    res.status(200).json(wishlists);
  } catch (error) {
    console.error("Error fetching wishlists:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/add", authMiddleware, async (req, res) => {
  try {
    const { userId, email } = req.user;
    const { movieId } = req.body;
    const db = getDB();
    await Promise.all([
      db.collection("users").updateOne(
        { email },
        {
          $addToSet: { wishlists: new ObjectId(movieId) },
        },
      ),
      client.sAdd(generateUsersWishlistKey(userId), movieId),
    ]);
    res.status(201).json({ message: "Movie added to wishlist" });
  } catch (error) {
    console.error("Error fetching wishlist:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/remove", authMiddleware, async (req, res) => {
  try {
    const { userId, email } = req.user;
    const { movieId } = req.body;
    const db = getDB();
    await Promise.all([
      db.collection("users").updateOne(
        { email },
        {
          $pull: { wishlists: new ObjectId(movieId) },
        },
      ),
      client.sRem(generateUsersWishlistKey(userId), movieId),
    ]);
    res.status(200).json({ message: "Movie removed from wishlist" });
  } catch (error) {
    console.error("Error fetching wishlist:", error);
    res.status(500).json({ message: "Internal server error" });
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
