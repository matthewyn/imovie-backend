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

function generateNotifyKey(orderId) {
  return `notify:${orderId}`;
}

function generateUsersNotificationsKey(userId) {
  return `users:${userId}:notifications`;
}

function generateNotificationsKey(notificationId) {
  return `notifications:${notificationId}`;
}

function generateUsersAgentUsageKey(userId) {
  return `users:${userId}:agent_usage`;
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
  generateUsersOrderKey,
  generateOrdersKey,
  generateOrdersPendingByUserKey,
  generateOrdersCompleteByUserKey,
  generateUsersWishlistKey,
  generateExpirationKey,
  generateOrdersCancelledByUserKey,
  generateNotifyKey,
  generateUsersNotificationsKey,
  generateNotificationsKey,
  generateUsersAgentUsageKey,
};
