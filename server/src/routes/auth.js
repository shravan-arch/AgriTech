import { Router } from 'express';
import { createAuthController } from '../controllers/authController.js';
import { createProtect } from '../middleware/auth.js';
import { userStore as defaultUserStore } from '../storage/userStore.js';

export const createAuthRouter = (userStore = defaultUserStore, options = {}) => {
  const router = Router();
  const controller = createAuthController(userStore, options);
  const protect = createProtect(userStore);

  router.post('/register', controller.register);
  router.post('/login', controller.login);
  router.post('/google', controller.googleAuth);
  router.post('/forgot-password', controller.forgotPassword);
  router.post('/reset-password', controller.resetPassword);
  router.get('/verify-email', controller.checkVerifyEmail);
  router.post('/verify-email', controller.verifyEmail);
  router.post('/resend-verification', controller.resendVerification);
  router.get('/me', protect, controller.getMe);
  router.put('/profile', protect, controller.updateProfile);
  router.get('/user/:id', protect, controller.getUserById);
  return router;
};

export default createAuthRouter();
