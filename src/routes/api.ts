import { Router } from 'express';
import { body, param } from 'express-validator';
import { healthCheck, getClaims, createClaim } from '../controllers/claimController';
import { verifyRequestSignature } from '../middleware/security';
import { checkVPN } from '../controllers/vpnController';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limiter for VPN checks - more restrictive to stay within API limits
const vpnCheckLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 5, // Limit each IP to 5 requests per 5 minutes (more conservative)
    message: {
        success: false,
        error: 'Too many VPN check requests. Please try again in a few minutes.'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    skipFailedRequests: false, // Count failed requests (4xx/5xx codes)
    keyGenerator: (req) => {
        // Use the same IP detection logic as VPN check
        const cfIP = req.headers['cf-connecting-ip'];
        const xRealIP = req.headers['x-real-ip'];
        const xForwardedFor = req.headers['x-forwarded-for'];
        const requestIP = req.ip;

        if (typeof cfIP === 'string') return cfIP;
        if (typeof xRealIP === 'string') return xRealIP;
        if (typeof xForwardedFor === 'string') return xForwardedFor.split(',')[0].trim();
        return requestIP || req.socket.remoteAddress || 'unknown';
    }
});

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

// VPN check route with rate limiting and signature verification
router.get('/check-vpn', [
    vpnCheckLimiter,
    verifyRequestSignature
], checkVPN);

export default router;
