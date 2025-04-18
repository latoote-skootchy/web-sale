const mongoose = require('mongoose');
const PageSchema = new mongoose.Schema({
  name: String,
  slug: String,
  images: [String],
  links: [String],
  policy: Boolean,
}, { timestamps: true });

module.exports = mongoose.model('Page', PageSchema);
