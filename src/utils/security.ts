import crypto from 'crypto';

const API_SECRET = process.env.API_SECRET || 'your-default-secret-key';

export function generateSignature(data: string, timestamp: number): string {
    const message = `${data}:${timestamp}`;
    return crypto
        .createHmac('sha256', API_SECRET)
        .update(message)
        .digest('hex');
}

export function verifySignature(signature: string, data: string, timestamp: number): boolean {
    // Check if the timestamp is within 5 minutes
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    if (Math.abs(now - timestamp) > fiveMinutes) {
        return false;
    }

    const expectedSignature = generateSignature(data, timestamp);
    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
    );
}

export function generateNonce(): string {
    return crypto.randomBytes(16).toString('hex');
} 