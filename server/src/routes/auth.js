import { Router } from 'express';
import { register, login, getMe, getUserById } from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { checkUserOwnership } from '../middleware/ownership.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.get('/user/:id', protect, checkUserOwnership('id'), getUserById);

export default router;
