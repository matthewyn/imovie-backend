const { client } = require("../dbs/redis");
const { generateSessionsKey } = require("../utils/keys");

async function authMiddleware(req, res, next) {
  try {
    const sessionId = req.cookies.sessionId;
    if (!sessionId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const session = await client.hGetAll(generateSessionsKey(sessionId));
    if (Object.keys(session).length === 0) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    req.user = deserialize(sessionId, session);
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

function deserialize(id, session) {
  return {
    id,
    ...session,
  };
}

module.exports = authMiddleware;
