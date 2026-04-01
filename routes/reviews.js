const express = require("express");
const router = express.Router();
const { getDB } = require("../dbs/mongo");
const { ObjectId } = require("mongodb");
const authMiddleware = require("../middlewares/auth");
const { client } = require("../dbs/redis");
const { generateMoviesKey, generateOrdersKey } = require("../utils/keys");

router.post("/:id", authMiddleware, async (req, res) => {
  try {
    const db = getDB();
    const { idMovie, rating, review } = req.body;
    const { id } = req.params;
    const { email } = req.user;
    await Promise.all([
      db.collection("movies").updateOne(
        { _id: new ObjectId(idMovie) },
        {
          $inc: {
            rating: rating,
            ratingCount: 1,
          },
        },
      ),
      client.hIncrBy(generateMoviesKey(idMovie), "rating", rating),
      client.hIncrBy(generateMoviesKey(idMovie), "ratingCount", 1),
      db.collection("users").updateOne(
        { email: email, "orders.id": id },
        {
          $set: {
            "orders.$.review": review,
            "orders.$.rating": rating,
          },
        },
      ),
      client.hSet(generateOrdersKey(id), {
        review: review,
        rating: rating,
      }),
    ]);
    res.status(201).json({ message: "Review submitted successfully" });
  } catch (error) {
    console.error("Error processing review:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
