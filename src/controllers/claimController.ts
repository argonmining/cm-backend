import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import pool from '../config/database';
import { Claim, ApiResponse } from '../types';
import { transferTokens } from '../utils/transferWrapper';

export const healthCheck = async (_req: Request, res: Response): Promise<void> => {
    try {
        await pool.query('SELECT NOW()');
        res.json({ status: 'healthy', timestamp: new Date() });
    } catch (error) {
        res.status(500).json({ 
            status: 'unhealthy', 
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        });
    }
};

export const getClaims = async (req: Request, res: Response): Promise<void> => {
    try {
        const { walletAddress } = req.params;
        const result = await pool.query<Claim>(
            'SELECT * FROM claims WHERE wallet_address = $1 ORDER BY created_at DESC',
            [walletAddress]
        );

        const response: ApiResponse<Claim[]> = {
            success: true,
            data: result.rows
        };

        res.json(response);
    } catch (error) {
        const response: ApiResponse<null> = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
        res.status(500).json(response);
    }
};

export const createClaim = async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({
            success: false,
            error: errors.array()[0].msg
        });
        return;
    }

    try {
        const { walletAddress } = req.body;
        const amount = process.env.DEFAULT_CLAIM_AMOUNT || '1000';

        // Check for existing claims in the last 24 hours
        const existingClaim = await pool.query<Claim>(
            `SELECT * FROM claims 
             WHERE wallet_address = $1 
             AND created_at > NOW() - INTERVAL '24 hours'
             AND status != 'failed'
             ORDER BY created_at DESC 
             LIMIT 1`,
            [walletAddress]
        );

        if (existingClaim.rows.length > 0) {
            const lastClaim = existingClaim.rows[0];
            const nextClaimTime = new Date(lastClaim.created_at.getTime() + 24 * 60 * 60 * 1000);
            const timeRemaining = nextClaimTime.getTime() - Date.now();
            const hoursRemaining = Math.ceil(timeRemaining / (1000 * 60 * 60));

            res.status(400).json({
                success: false,
                error: `You can only claim once every 24 hours. Please try again in ${hoursRemaining} hours.`
            });
            return;
        }

        // Create initial claim record
        const initialClaim = await pool.query<Claim>(
            `INSERT INTO claims (wallet_address, amount, status) 
             VALUES ($1, $2, 'processing') 
             RETURNING *`,
            [walletAddress, amount]
        );

        // Process the token transfer
        const transferResult = await transferTokens(walletAddress);

        // Update claim based on transfer result
        const updatedClaim = await pool.query<Claim>(
            `UPDATE claims 
             SET status = $1, 
                 transaction_hash = $2, 
                 transaction_error = $3,
                 updated_at = NOW()
             WHERE id = $4 
             RETURNING *`,
            [
                transferResult.success ? 'completed' : 'failed',
                transferResult.transactionHash || null,
                transferResult.error || null,
                initialClaim.rows[0].id
            ]
        );

        const response: ApiResponse<Claim> = {
            success: transferResult.success,
            data: updatedClaim.rows[0],
            error: transferResult.error
        };

        res.status(transferResult.success ? 201 : 500).json(response);
    } catch (error) {
        const response: ApiResponse<null> = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
        res.status(500).json(response);
    }
};
