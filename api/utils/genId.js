const { randomBytes } = require("crypto");

const genId = () => {
  return randomBytes(3).toString("hex");
};

module.exports = genId;
