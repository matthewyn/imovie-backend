const express = require("express");
const router = express.Router();
const { client } = require("../dbs/redis");
const { getDB } = require("../dbs/mongo");
const { ObjectId } = require("mongodb");
const authMiddleware = require("../middlewares/auth");

router.get("/", authMiddleware, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const id = req.user.userId;
    const db = getDB();
    const wishlists = await db
      .collection("users")
      .aggregate([
        { $match: { _id: new ObjectId(id) } },
        {
          $lookup: {
            from: "movies",
            localField: "wishlists",
            foreignField: "_id",
            as: "wishlists",
            pipeline: [
              {
                $project: {
                  judul: 1,
                  filePath: 1,
                  genre: 1,
                },
              },
            ],
          },
        },
        {
          $project: {
            wishlists: { $slice: ["$wishlists", (page - 1) * limit, limit] },
            totalPages: { $size: "$wishlists" },
            name: 1,
            email: 1,
          },
        },
      ])
      .toArray();
    res.status(200).json({
      totalPages: wishlists[0].totalPages,
      wishlists: wishlists[0].wishlists,
    });
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
    await db.collection("users").updateOne(
      { email },
      {
        $addToSet: { wishlists: new ObjectId(movieId) },
      },
    );
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
    await db.collection("users").updateOne(
      { email },
      {
        $pull: { wishlists: new ObjectId(movieId) },
      },
    );
    res.status(200).json({ message: "Movie removed from wishlist" });
  } catch (error) {
    console.error("Error fetching wishlist:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
