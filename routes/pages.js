const express = require('express');
const router = express.Router();
const Page = require('../models/Page');

// ดึงทั้งหมด
router.get('/', async (req, res) => {
  const pages = await Page.find().sort({ createdAt: -1 });
  res.json(pages);
});

// ดึงตาม slug
router.get('/slug/:slug', async (req, res) => {
  const page = await Page.findOne({ slug: req.params.slug });
  if (!page) return res.status(404).json({ error: 'ไม่พบข้อมูล' });
  res.json(page);
});

// เพิ่มใหม่
router.post('/', async (req, res) => {
  const page = new Page(req.body);
  await page.save();
  res.json(page);
});

// แก้ไข
router.put('/:id', async (req, res) => {
  const updated = await Page.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(updated);
});

// ลบ
router.delete('/:id', async (req, res) => {
  await Page.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

module.exports = router;
