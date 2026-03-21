function generateMoviesKey(id) {
  return `movies:${id}`;
}

function generateMoviesByRatingKey() {
  return "movies:rating";
}

function generateStudiosKey(id) {
  return `studios:${id}`;
}

function generateTimeslotsKey(millis, movieId) {
  return `${millis}:${movieId}`;
}

function generateSchedulesKey(movieId) {
  return `schedules:${movieId}`;
}

function generateUsersKey(id) {
  return `users:${id}`;
}

function generateEmailsKey() {
  return "emails";
}

function generateEmailsUniqueKey() {
  return `emails:unique`;
}

function generateSessionsKey(sessionId) {
  return `sessions:${sessionId}`;
}

function generateUsersOrderKey(id) {
  return `users:${id}:orders`;
}

function generateOrdersKey(id) {
  return `orders:${id}`;
}

function generateOrdersPendingByUserKey(userId) {
  return `users:${userId}:orders:pending`;
}

function generateOrdersCompleteByUserKey(userId) {
  return `users:${userId}:orders:complete`;
}

function generateOrdersCancelledByUserKey(userId) {
  return `users:${userId}:orders:cancelled`;
}

function generateUsersWishlistKey(userId) {
  return `users:${userId}:wishlist`;
}

function generateExpirationKey(orderId) {
  return `reservation:${orderId}`;
}

module.exports = {
  generateMoviesKey,
  generateMoviesByRatingKey,
  generateStudiosKey,
  generateTimeslotsKey,
  generateSchedulesKey,
  generateUsersKey,
  generateEmailsKey,
  generateEmailsUniqueKey,
  generateSessionsKey,
  generateUsersOrderKey,
  generateOrdersKey,
  generateOrdersPendingByUserKey,
  generateOrdersCompleteByUserKey,
  generateUsersWishlistKey,
  generateExpirationKey,
  generateOrdersCancelledByUserKey,
};
