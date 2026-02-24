const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { body, validationResult } = require('express-validator');
const { isAuthenticated } = require('./auth');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Fetch all products with optional filters
router.get('/', async (req, res) => {
    try {
        const { category, brand } = req.query;
        let query = {};
        if (category) query.category = category;
        if (brand) query.brand = brand;

        const products = await Product.find(query).sort({ createdAt: -1 });
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// Smart Search with Text Indexing
router.get('/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.json([]);

        const products = await Product.find(
            { $text: { $search: q } },
            { score: { $meta: "textScore" } }
        ).sort({ score: { $meta: "textScore" } });

        res.json(products);
    } catch (err) {
        logger.error('Search Error:', err);
        res.status(500).json({ error: 'Search failed' });
    }
});

// Auto-suggest API
router.get('/suggestions', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 2) return res.json([]);

        const regex = new RegExp(`^${q}`, 'i');
        const suggestions = await Product.find({
            $or: [{ name: regex }, { brand: regex }, { tags: regex }]
        }).limit(10).select('name brand');

        const uniqueSuggestions = [...new Set([
            ...suggestions.map(p => p.name),
            ...suggestions.map(p => p.brand)
        ])].slice(0, 5);

        res.json(uniqueSuggestions);
    } catch (err) {
        res.status(500).json({ error: 'Suggestion failed' });
    }
});

// Add Product
router.post('/', isAuthenticated, [
    body('name').notEmpty().withMessage('اسم المنتج مطلوب').trim().escape(),
    body('price').isNumeric().withMessage('السعر يجب أن يكون رقماً'),
    body('category').isIn(['Wheels', 'Tires', 'Accessories']).withMessage('فئة غير صحيحة'),
    body('image').isURL().withMessage('رابط الصورة غير صحيح')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
        const { name, brand, price, image, category, description, condition, warranty, compatibility, stockQuantity, tags } = req.body;
        const newProduct = new Product({
            name, brand, price, image, category, description,
            vendorId: req.user._id,
            vendorName: req.user.name,
            condition, warranty,
            stockQuantity: stockQuantity || 0,
            tags: tags || [],
            compatibility: compatibility || []
        });
        await newProduct.save();
        res.status(201).json(newProduct);
    } catch (err) {
        logger.error('Add Product Error:', err);
        res.status(500).json({ error: 'Failed to add product' });
    }
});

// Vendor-specific Products
router.get('/vendor', isAuthenticated, async (req, res) => {
    try {
        const products = await Product.find({ vendorId: req.user._id }).sort({ createdAt: -1 });
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch vendor products' });
    }
});

// Delete Product
router.delete('/:id', isAuthenticated, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ error: 'المنتج غير موجود' });

        if (product.vendorId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'غير مسموح لك بمسح هذا المنتج' });
        }

        await Product.findByIdAndDelete(req.params.id);
        res.json({ message: 'Product deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

// Update Product
router.put('/:id', isAuthenticated, async (req, res) => {
    try {
        const { name, brand, price, image, category, description, condition, warranty, compatibility, stockQuantity, tags } = req.body;
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ error: 'المنتج غير موجود' });

        if (product.vendorId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'غير مسموح لك بتعديل هذا المنتج' });
        }

        const updatedProduct = await Product.findByIdAndUpdate(
            req.params.id,
            { name, brand, price, image, category, description, condition, warranty, stockQuantity, tags, compatibility: compatibility || [] },
            { new: true }
        );
        res.json(updatedProduct);
    } catch (err) {
        logger.error('Update Product Error:', err);
        res.status(500).json({ error: 'فشل تعديل المنتج' });
    }
});

module.exports = router;
