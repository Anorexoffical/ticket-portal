import { Router } from 'express';
import { login, signup, me, logout, changePassword } from '../controllers/auth.controller.js';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.post('/login', asyncHandler(login));
router.post('/signup', asyncHandler(signup));
router.get('/me', requireAuth, me);
router.post('/logout', logout);
router.post('/change-password', requireAuth, asyncHandler(changePassword));
export default router;
