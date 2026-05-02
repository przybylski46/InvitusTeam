const { Schema, model } = require('mongoose');

const reviewSchema = new Schema({
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

module.exports = model('Review', reviewSchema);