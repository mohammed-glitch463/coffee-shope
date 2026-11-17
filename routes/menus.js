const express = require('express');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const multer = require('multer');
const router = express.Router();
const { requireAuth } = require('../middleware');

const uploadsDirectory = path.join(__dirname, '..', 'public', 'uploads');
fs.mkdirSync(uploadsDirectory, { recursive: true });

const imageStorage = multer.diskStorage({
  destination: (req, file, callback) => callback(null, uploadsDirectory),
  filename: (req, file, callback) => {
    const extensionByType = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
    const extension = extensionByType[file.mimetype];
    callback(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extension}`);
  }
});
const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.mimetype)) {
      return callback(new Error('Only JPG, PNG, WEBP or GIF images are allowed.'));
    }
    callback(null, true);
  }
});

// Admin-only product image upload. Returns a path the menu item can store.
router.post('/upload-image', requireAuth, (req, res, next) => {
  imageUpload.single('image')(req, res, error => {
    if (error) return next(error);
    if (!req.file) return res.status(400).json({ success: false, error: { message: 'Choose an image file first.' } });
    res.status(201).json({
      success: true,
      message: 'Image uploaded successfully.',
      image: `/uploads/${req.file.filename}`
    });
  });
});

// In-memory data: no database is used, as required by the assignment.
let menus = [
  { id: 1, name: 'Caramel Macchiato', category: 'Coffee', price: 32000, stock: 18, description: 'Espresso, silky milk and buttery caramel.', image: '/images/caramel-macchiato.jpg' },
  { id: 2, name: 'Iced Vanilla Latte', category: 'Coffee', price: 28000, stock: 22, description: 'Chilled espresso with milk and vanilla.', image: '/images/iced-latte.jpg' },
  { id: 3, name: 'Iced Matcha Latte', category: 'Tea', price: 30000, stock: 14, description: 'Earthy Japanese matcha blended with fresh milk.', image: '/images/matcha-latte.jpg' },
  { id: 4, name: 'Chocolate Mocha Frappe', category: 'Non-Coffee', price: 35000, stock: 12, description: 'A creamy chocolate drink finished with whipped cream.', image: '/images/mocha-frappe.jpg' },
  { id: 5, name: 'Classic Cappuccino', category: 'Coffee', price: 26000, stock: 20, description: 'A balanced espresso with velvety steamed milk.', image: '/images/cappuccino.jpg' },
  { id: 6, name: 'Butter Croissant', category: 'Snacks', price: 22000, stock: 10, description: 'A golden, flaky pastry baked until crisp.', image: '/images/croissant.jpg' }
];

const nextId = () => menus.length ? Math.max(...menus.map(item => item.id)) + 1 : 1;

// BONUS: search with a query string, e.g. /menus/search?name=latte
router.get('/search', (req, res) => {
  const searchTerm = String(req.query.name || '').toLowerCase();
  const results = menus.filter(item => item.name.toLowerCase().includes(searchTerm));
  res.status(200).json({ success: true, count: results.length, data: results });
});

// Specific optional route must be placed before /:id.
router.get('/category{/:name}', (req, res) => {
  const category = req.params.name;
  if (!category) return res.status(200).json({ success: true, count: menus.length, data: menus });
  const results = menus.filter(item => item.category.toLowerCase() === category.toLowerCase());
  res.status(200).json({ success: true, count: results.length, data: results });
});

router.route('/')
  .get((req, res) => {
    res.status(200).json({ success: true, count: menus.length, data: menus });
  })
  .post(requireAuth, (req, res) => {
    const { name, category, price, stock, description, image } = req.body;
    if (!name || !category || price === undefined || stock === undefined) {
      return res.status(400).json({
        success: false,
        error: { message: 'name, category, price, and stock are required.' }
      });
    }
    if (typeof name !== 'string' || typeof category !== 'string' ||
        !Number.isFinite(Number(price)) || !Number.isFinite(Number(stock)) ||
        Number(price) < 0 || Number(stock) < 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'name/category must be text; price/stock must be non-negative numbers.' }
      });
    }
    const newMenu = {
      id: nextId(), name: name.trim(), category: category.trim(),
      price: Number(price), stock: Number(stock),
      description: description || 'Freshly prepared at our coffee shop.',
      image: image || '/images/cafe-hero.jpg'
    };
    menus.push(newMenu);
    res.status(201).json({ success: true, data: newMenu });
  });

router.route('/:id')
  .get(async (req, res) => {
    const menu = menus.find(item => item.id === Number(req.params.id));
    if (!menu) {
      const error = new Error(`Menu item with id ${req.params.id} was not found.`);
      error.status = 404;
      throw error;
    }
    res.status(200).json({ success: true, data: menu });
  })
  .put(requireAuth, async (req, res) => {
    const index = menus.findIndex(item => item.id === Number(req.params.id));
    if (index === -1) {
      const error = new Error(`Menu item with id ${req.params.id} was not found.`);
      error.status = 404;
      throw error;
    }
    const { name, category, price, stock, description, image } = req.body;
    if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
      return res.status(400).json({ success: false, error: { message: 'name must be a non-empty string.' } });
    }
    if (price !== undefined && (!Number.isFinite(Number(price)) || Number(price) < 0)) {
      return res.status(400).json({ success: false, error: { message: 'price must be a non-negative number.' } });
    }
    if (stock !== undefined && (!Number.isFinite(Number(stock)) || Number(stock) < 0)) {
      return res.status(400).json({ success: false, error: { message: 'stock must be a non-negative number.' } });
    }
    menus[index] = {
      ...menus[index],
      ...(name !== undefined && { name: name.trim() }),
      ...(category !== undefined && { category }),
      ...(price !== undefined && { price: Number(price) }),
      ...(stock !== undefined && { stock: Number(stock) }),
      ...(description !== undefined && { description }),
      ...(image !== undefined && { image })
    };
    res.status(200).json({ success: true, data: menus[index] });
  })
  .delete(requireAuth, async (req, res) => {
    const index = menus.findIndex(item => item.id === Number(req.params.id));
    if (index === -1) {
      const error = new Error(`Menu item with id ${req.params.id} was not found.`);
      error.status = 404;
      throw error;
    }
    const deleted = menus.splice(index, 1)[0];
    res.status(200).json({ success: true, message: 'Menu item deleted.', data: deleted });
  });

module.exports = router;
