export interface Claim {
    id: number;
    wallet_address: string;
    amount: string;
    status: 'pending' | 'approved' | 'rejected';
    created_at: Date;
    updated_at: Date;
}

export interface ClaimRequest {
    walletAddress: string;
    amount: string;
}

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}
