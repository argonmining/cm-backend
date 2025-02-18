import { Request, Response } from 'express';
import fetch from 'node-fetch';

interface VPNAPIResponse {
    security: {
        vpn: boolean;
        proxy: boolean;
        tor: boolean;
        relay: boolean;
    };
    location: {
        country_code: string;
        country: string;
    };
}

function isValidIP(ip: string): boolean {
    // IPv4 validation with proper range checking
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipv4Regex.test(ip)) {
        const parts = ip.split('.').map(Number);
        return parts.every(part => part >= 0 && part <= 255);
    }

    // More flexible IPv6 validation that handles all valid formats
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^(([0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}$/;
    return ipv6Regex.test(ip);
}

function sanitizeIP(ip: string): string {
    // Remove any IPv6 to IPv4 mapping prefixes and trim whitespace
    return ip.replace(/^::ffff:/, '').trim();
}

function isValidVPNResponse(data: any): data is VPNAPIResponse {
    return (
        data &&
        typeof data === 'object' &&
        'security' in data &&
        typeof data.security === 'object' &&
        typeof data.security.vpn === 'boolean' &&
        typeof data.security.proxy === 'boolean' &&
        typeof data.security.tor === 'boolean' &&
        typeof data.security.relay === 'boolean' &&
        'location' in data &&
        typeof data.location === 'object' &&
        typeof data.location.country === 'string' &&
        typeof data.location.country_code === 'string'
    );
}

export const checkVPN = async (req: Request, res: Response) => {
    const apiKey = process.env.VPNAPI_KEY;
    
    // Get real IP from Cloudflare or other proxy if available
    const cfIP = Array.isArray(req.headers['cf-connecting-ip']) 
        ? req.headers['cf-connecting-ip'][0] 
        : req.headers['cf-connecting-ip'];
    const xRealIP = Array.isArray(req.headers['x-real-ip'])
        ? req.headers['x-real-ip'][0]
        : req.headers['x-real-ip'];
    const xForwardedFor = Array.isArray(req.headers['x-forwarded-for'])
        ? req.headers['x-forwarded-for'][0]
        : req.headers['x-forwarded-for'];
    const requestIP = req.ip;

    // Priority: Cloudflare IP > X-Real-IP > X-Forwarded-For > req.ip
    let clientIP: string | undefined;
    
    // Log headers for debugging in production
    console.debug('IP Detection Headers:', {
        cfIP,
        xRealIP,
        xForwardedFor,
        requestIP
    });

    if (typeof cfIP === 'string') {
        clientIP = cfIP;
    } else if (typeof xRealIP === 'string') {
        clientIP = xRealIP;
    } else if (typeof xForwardedFor === 'string') {
        // Get the first IP in the list (original client)
        clientIP = xForwardedFor.split(',')[0].trim();
    } else if (requestIP) {
        clientIP = requestIP;
    }

    if (!apiKey) {
        console.error('VPNAPI_KEY not configured in environment');
        return res.status(500).json({
            success: false,
            error: 'VPN detection service not configured'
        });
    }

    if (!clientIP) {
        console.warn('Could not determine client IP from any headers');
        return res.status(400).json({
            success: false,
            error: 'Could not determine client IP address'
        });
    }

    // Sanitize the IP after we've confirmed it exists
    const sanitizedIP = sanitizeIP(clientIP);

    if (!isValidIP(sanitizedIP)) {
        console.warn(`Invalid IP format detected: ${sanitizedIP}`);
        return res.status(400).json({
            success: false,
            error: 'Invalid IP address format'
        });
    }

    try {
        console.debug(`Checking VPN status for IP: ${sanitizedIP}`);
        const response = await fetch(`https://vpnapi.io/api/${sanitizedIP}?key=${apiKey}`, {
            timeout: 5000, // 5 second timeout
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            let errorMessage: string;
            try {
                const errorData = await response.json();
                errorMessage = errorData?.message || `VPN check failed: ${response.status} ${response.statusText}`;
            } catch {
                errorMessage = `VPN check failed: ${response.status} ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }

        const rawData = await response.json();
        
        if (!isValidVPNResponse(rawData)) {
            console.error('Invalid response format from VPN API:', rawData);
            return res.status(502).json({
                success: false,
                error: 'Invalid response from VPN detection service'
            });
        }

        const data: VPNAPIResponse = rawData;
        
        // Determine if any security flags are true
        const detectionTypes: string[] = [];
        if (data.security.vpn) detectionTypes.push('VPN');
        if (data.security.proxy) detectionTypes.push('Proxy');
        if (data.security.tor) detectionTypes.push('Tor');
        if (data.security.relay) detectionTypes.push('Relay');

        const isUsingVPN = detectionTypes.length > 0;

        // Cache the result for 5 minutes
        res.set('Cache-Control', 'private, max-age=300');

        // Log detection result
        console.debug('VPN Detection Result:', {
            ip: sanitizedIP,
            isUsingVPN,
            detectionTypes: detectionTypes.length > 0 ? detectionTypes : 'none'
        });

        return res.json({
            success: true,
            data: {
                isUsingVPN,
                details: isUsingVPN ? {
                    country: data.location.country,
                    detectionType: detectionTypes
                } : undefined
            }
        });
    } catch (error) {
        console.error('Error checking VPN status:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to check VPN status. Please try again.'
        });
    }
} 