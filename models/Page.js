const mongoose = require('mongoose');

const pageSchema = new mongoose.Schema({
  id: String,
  name: String,
  slug: String,
  images: [String],
  links: [String],
  events: [String], 
  policy: Boolean,
  owner: String,
  pixel: String,
  bridgeUrl: String
});

// ✅ กัน slug ซ้ำต่อ 1 owner
pageSchema.index({ slug: 1, owner: 1 }, { unique: true });
// ✅ ถ้าอยากกันชื่อซ้ำด้วย
pageSchema.index({ name: 1, owner: 1 }, { unique: true });

module.exports = mongoose.model('Page', pageSchema);
