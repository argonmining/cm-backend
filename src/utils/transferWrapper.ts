import { executeTransfer } from './transfer';

export async function transferTokens(
    walletAddress: string,
    amount: string = process.env.DEFAULT_CLAIM_AMOUNT || '1000'
): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    const privateKey = process.env.WALLET_PRIVATE_KEY;
    const ticker = process.env.CLAIM_TICKER || 'CRUMBS';
    
    if (!privateKey) {
        return {
            success: false,
            error: 'Wallet private key not configured'
        };
    }

    try {
        const result = await executeTransfer({
            privateKey,
            dest: walletAddress,
            amount,
            ticker,
            network: 'mainnet',
            logLevel: process.env.NODE_ENV === 'development' ? 'DEBUG' : 'INFO'
        });

        return {
            success: result.success,
            transactionHash: result.txHash,
            error: result.error
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
} 