const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  userId: String,
  embedId: String,
  channelId: String,
  reviews: [
    {
      user: String,
      name: String,
      estrellas: Number,
      comentario: String
    }
  ]
});

module.exports = mongoose.model('Review', reviewSchema);