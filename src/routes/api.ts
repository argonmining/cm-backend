import { Router } from 'express';
import { body, param } from 'express-validator';
import { healthCheck, getClaims, createClaim } from '../controllers/claimController';

const router = Router();

// Health check endpoint
router.get('/health', healthCheck);

// Get claims for a wallet address
router.get('/claims/:walletAddress', [
    param('walletAddress')
        .isString()
        .matches(/^kaspa:[a-z0-9]{61,63}$/)
        .withMessage('Invalid Kaspa wallet address format')
], getClaims);

// Create a new claim
router.post('/claim', [
    body('walletAddress')
        .isString()
        .matches(/^kaspa:[a-z0-9]{61,63}$/)
        .withMessage('Invalid Kaspa wallet address format')
], createClaim);

export default router;
