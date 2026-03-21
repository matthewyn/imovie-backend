const reserveSeatsScript = `
  local seatsJson = redis.call("HGET", KEYS[1], "seats")
  if not seatsJson then
    return {err = "NO_SEATS_DATA"}
  end

  local seats = cjson.decode(seatsJson)
  local requestedSeats = cjson.decode(ARGV[1])
  local ttl = tonumber(ARGV[2])
  local userId = ARGV[3]

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

  redis.call("SET", KEYS[2], "1", "PX", ARGV[2])

  redis.call("SET", KEYS[2] .. ":data", cjson.encode({
    seats = requestedSeats,
    timeslotKey = KEYS[1],
    userId = userId,
  }))

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

  local statusJson = redis.call("HGET", KEYS[3], "status")

  if statusJson then
    local status = cjson.decode(statusJson)

    table.insert(status, {
      tipe = "cancelled",
      createdAt = tonumber(ARGV[3])
    })

    redis.call("HSET", KEYS[3], "status", cjson.encode(status))
  end

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

  local statusJson = redis.call("HGET", KEYS[2], "status")

  if statusJson then
    local status = cjson.decode(statusJson)

    local alreadyConfirmed = false
    for i, s in ipairs(status) do
      if s.tipe == "confirmed" then
        alreadyConfirmed = true
        break
      end
    end

    if not alreadyConfirmed then
      table.insert(status, {
        tipe = "confirmed",
        createdAt = tonumber(ARGV[3])
      })

      redis.call("HSET", KEYS[2], "status", cjson.encode(status))
    end
  end

  redis.call("HSET", KEYS[2], "snacks", ARGV[4])
  redis.call("HSET", KEYS[2], "totalPrice", ARGV[5])

  redis.call("SREM", KEYS[3], ARGV[2])
  redis.call("SADD", KEYS[4], ARGV[2])
  redis.call("DEL", KEYS[5])
  redis.call("DEL", KEYS[6])

  return cjson.encode(seats)
`;

module.exports = {
  reserveSeatsScript,
  releaseSeatsScript,
  confirmPaymentScript,
};
