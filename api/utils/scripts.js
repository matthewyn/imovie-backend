const reserveSeatsScript = `
  local seatsJson = redis.call("HGET", KEYS[1], "seats")
  if not seatsJson then
    return {err = "NO_SEATS_DATA"}
  end

  local seats = cjson.decode(seatsJson)
  local requestedSeats = cjson.decode(ARGV[1])
  local ttl = tonumber(ARGV[2])
  local notifyTtl = tonumber(ARGV[3])
  local userId = ARGV[4]
  local token = ARGV[5]
  local judul = ARGV[6]

  local function seatToIndex(label)
    local rowLetter, col = string.match(label, "([A-Z])%-(%d+)")
    local row = string.byte(rowLetter) - 65
    local colIndex = tonumber(col) - 1
    return row, colIndex
  end

  for i, seat in ipairs(requestedSeats) do
    local row, col = seatToIndex(seat)
    if seats[row + 1][col + 1] ~= 1 then
      return 0
    end
  end

  for i, seat in ipairs(requestedSeats) do
    local row, col = seatToIndex(seat)
    seats[row + 1][col + 1] = 2
  end

  redis.call("HSET", KEYS[1], "seats", cjson.encode(seats))

  redis.call("SET", KEYS[2], "1", "PX", ttl)
  redis.call("SET", KEYS[3], "1", "PX", notifyTtl)

  redis.call("SET", KEYS[2] .. ":data", cjson.encode({
    seats = requestedSeats,
    timeslotKey = KEYS[1],
    userId = userId,
    judul = judul,
  }))
  redis.call("SET", KEYS[3] .. ":data", token)

  return cjson.encode(seats)
`;

const releaseSeatsScript = `
  local seatsJson = redis.call("HGET", KEYS[1], "seats")
  if not seatsJson then
    return
  end

  local seats = cjson.decode(seatsJson)
  local requestedSeats = cjson.decode(ARGV[1])

  local function seatToIndex(label)
    local rowLetter, col = string.match(label, "([A-Z])%-(%d+)")
    local row = string.byte(rowLetter) - 65
    local colIndex = tonumber(col) - 1
    return row, colIndex
  end

  for i, seat in ipairs(requestedSeats) do
    local row, col = seatToIndex(seat)
    if seats[row + 1][col + 1] == 2 then
      seats[row + 1][col + 1] = 1
    end
  end

  redis.call("HSET", KEYS[1], "seats", cjson.encode(seats))

  redis.call("SREM", KEYS[2], ARGV[2])

  return cjson.encode(seats)
`;

const confirmPaymentScript = `
  local seatsJson = redis.call("HGET", KEYS[1], "seats")
  if not seatsJson then
    return {err = "NO_SEATS"}
  end

  local seats = cjson.decode(seatsJson)
  local requestedSeats = cjson.decode(ARGV[1])

  local function seatToIndex(label)
    local rowLetter, col = string.match(label, "([A-Z])%-(%d+)")
    local row = string.byte(rowLetter) - 65
    local colIndex = tonumber(col) - 1
    return row, colIndex
  end

  for i, seat in ipairs(requestedSeats) do
    local row, col = seatToIndex(seat)
    if seats[row + 1][col + 1] == 2 then
      seats[row + 1][col + 1] = 0
    end
  end

  redis.call("HSET", KEYS[1], "seats", cjson.encode(seats))

  redis.call("SREM", KEYS[2], ARGV[2])
  redis.call("DEL", KEYS[3])
  redis.call("DEL", KEYS[4])
  redis.call("DEL", KEYS[5])
  redis.call("DEL", KEYS[6])

  return cjson.encode(seats)
`;

const checkUsersAgentUsageScript = `
  local usage = redis.call("INCR", KEYS[1])
  local agentTimeout = tonumber(ARGV[1])

  if usage == 1 then
    redis.call("EXPIRE", KEYS[1], agentTimeout)
  end

  return usage >= 4 and 0 or 1
`;

module.exports = {
  reserveSeatsScript,
  releaseSeatsScript,
  confirmPaymentScript,
  checkUsersAgentUsageScript,
};
