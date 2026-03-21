function generateUploadURL(fileName) {
  return `/uploads/${fileName}`;
}

module.exports = { generateUploadURL };
