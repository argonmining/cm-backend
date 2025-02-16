import { Router } from 'express';
import { body, param } from 'express-validator';
import { healthCheck, getClaims, createClaim } from '../controllers/claimController';
import { verifyRequestSignature } from '../middleware/security';

const router = Router();

// Health check endpoint (no signature required)
router.get('/health', healthCheck);

// Protected routes
router.get('/claims/:walletAddress', [
    verifyRequestSignature,
    param('walletAddress')
        .isString()
        .matches(/^kaspa:[a-z0-9]{61,63}$/)
        .withMessage('Invalid Kaspa wallet address format')
], getClaims);

router.post('/claim', [
    verifyRequestSignature,
    body('walletAddress')
        .isString()
        .matches(/^kaspa:[a-z0-9]{61,63}$/)
        .withMessage('Invalid Kaspa wallet address format')
], createClaim);

export default router;
