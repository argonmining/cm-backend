import { spawn } from 'child_process';
import path from 'path';
import dotenv from 'dotenv';

// Load .env from the root directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface TransferResult {
    success: boolean;
    transactionHash?: string;
    error?: string;
}

export async function transferTokens(
    walletAddress: string,
    amount: string = process.env.DEFAULT_CLAIM_AMOUNT || '1000'
): Promise<TransferResult> {
    return new Promise((resolve) => {
        const privateKey = process.env.WALLET_PRIVATE_KEY;
        const ticker = process.env.CLAIM_TICKER || 'NACHO';
        
        if (!privateKey) {
            resolve({
                success: false,
                error: 'Wallet private key not configured'
            });
            return;
        }
        
        const transferScript = path.join(__dirname, 'transfer.ts');
        const child = spawn('ts-node', [
            transferScript,
            '--privKey', privateKey,
            '--dest', walletAddress,
            '--amount', amount,
            '--ticker', ticker,
            '--network', 'mainnet'
        ]);

        let outputData = '';
        let errorData = '';

        child.stdout.on('data', (data) => {
            outputData += data.toString();
            // Look for successful transaction hashes in the output
            const successMatch = data.toString().match(/submitted reveal tx sequence transaction: ([a-f0-9]+)/);
            if (successMatch) {
                resolve({
                    success: true,
                    transactionHash: successMatch[1]
                });
            }
        });

        child.stderr.on('data', (data) => {
            errorData += data.toString();
        });

        child.on('close', (code) => {
            if (code !== 0) {
                resolve({
                    success: false,
                    error: errorData || 'Transfer failed with no specific error message'
                });
            } else if (!outputData.includes('submitted reveal tx')) {
                resolve({
                    success: false,
                    error: 'Transfer completed but no transaction hash found'
                });
            }
        });

        // Set a timeout for the entire process
        setTimeout(() => {
            child.kill();
            resolve({
                success: false,
                error: 'Transfer timeout after 180 seconds'
            });
        }, 180000); // 3 minutes timeout
    });
} 