import { Router } from 'express';
import { createAuthController } from '../controllers/authController.js';
import { createProtect } from '../middleware/auth.js';
import { userStore as defaultUserStore } from '../storage/userStore.js';

export const createAuthRouter = (userStore = defaultUserStore) => {
  const router = Router();
  const controller = createAuthController(userStore);
  const protect = createProtect(userStore);

  router.post('/register', controller.register);
  router.post('/login', controller.login);
  router.get('/me', protect, controller.getMe);
  router.get('/user/:id', protect, controller.getUserById);
  return router;
};

export default createAuthRouter();
