import { Request, Response, NextFunction } from 'express';
import { verifySignature } from '../utils/security';

export function verifyRequestSignature(req: Request, res: Response, next: NextFunction) {
    const signature = req.headers['x-signature'] as string;
    const timestamp = parseInt(req.headers['x-timestamp'] as string);
    const nonce = req.headers['x-nonce'] as string;

    // Check if required headers are present
    if (!signature || !timestamp || !nonce) {
        console.log('Missing security headers:', {
            signature: !!signature,
            timestamp: !!timestamp,
            nonce: !!nonce
        });
        return res.status(401).json({
            success: false,
            error: 'Missing security headers'
        });
    }

    // Get the base URL and full URL
    const baseUrl = '/api';
    const fullUrl = req.originalUrl;
    const relativeUrl = fullUrl.replace(baseUrl, '');

    // Create the data string from the request
    const data = JSON.stringify({
        method: req.method,
        url: relativeUrl,
        body: req.body,
        nonce
    });

    console.log('Verifying signature with:', {
        receivedSignature: signature,
        timestamp,
        nonce,
        data,
        fullUrl,
        relativeUrl
    });

    // Verify the signature
    if (!verifySignature(signature, data, timestamp)) {
        console.log('Signature verification failed');
        return res.status(401).json({
            success: false,
            error: 'Invalid request signature'
        });
    }

    next();
} 