import { Router } from 'express';
import {
  register,
  login,
  me,
  verifyEmail,
  resendVerification,
  updateProfile,
  changePassword,
} from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/verify-email', verifyEmail);

router.get('/me', requireAuth, me);
router.post('/resend-verification', requireAuth, resendVerification);
router.put('/profile', requireAuth, updateProfile);
router.put('/password', requireAuth, changePassword);

export default router;
