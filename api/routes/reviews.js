const express = require("express");
const router = express.Router();
const { getDB } = require("../dbs/mongo");
const { ObjectId } = require("mongodb");
const authMiddleware = require("../middlewares/auth");
const { client } = require("../dbs/redis");

router.post("/:id", authMiddleware, async (req, res) => {
  try {
    const db = getDB();
    const { movieId, rating, review } = req.body;
    const { id } = req.params;
    const { userId } = req.user;
    await Promise.all([
      db.collection("movies").updateOne(
        { _id: new ObjectId(movieId) },
        {
          $inc: {
            rating: rating,
            ratingCount: 1,
          },
        },
      ),
      db.collection("orders").updateOne(
        { _id: id },
        {
          $set: {
            review: review,
            rating: rating,
          },
        },
      ),
    ]);
    res.status(201).json({ message: "Review submitted successfully" });
  } catch (error) {
    console.error("Error processing review:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
