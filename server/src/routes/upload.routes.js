import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';

const router = Router();
const UPLOADS_DIR = path.resolve('uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = path.join(UPLOADS_DIR, path.dirname(req.body.path || ''));
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => cb(null, path.basename(req.body.path || file.originalname)),
});
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 } });

// POST /api/uploads — upload a file
router.post('/uploads', requireAuth, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file received' });
  res.json({ path: req.body.path });
}));

// GET /api/uploads/file?path=branding/logo.png — serve a file
router.get('/uploads/file', asyncHandler(async (req, res) => {
  const filePath = path.join(UPLOADS_DIR, req.query.path || '');
  if (!filePath.startsWith(UPLOADS_DIR)) return res.status(403).end();
  if (!fs.existsSync(filePath)) {
    res.type('image/svg+xml').send('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" rx="8" fill="#dbeafe"/></svg>');
    return;
  }
  res.sendFile(filePath);
}));

// DELETE /api/uploads — delete a file
router.delete('/uploads', requireAuth, asyncHandler(async (req, res) => {
  const filePath = path.join(UPLOADS_DIR, req.body.path || '');
  if (!filePath.startsWith(UPLOADS_DIR)) return res.status(403).end();
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  res.json({ ok: true });
}));

export default router;
