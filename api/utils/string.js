function capitalizeFirstLetter(string) {
  if (!string) return "";
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function seatToIndex(label) {
  const [rowLetter, col] = label.match(/([A-Z])-(\d+)/).slice(1);
  const row = rowLetter.charCodeAt(0) - 65;
  const colIndex = parseInt(col) - 1;
  return [row, colIndex];
}

module.exports = { capitalizeFirstLetter, seatToIndex };
