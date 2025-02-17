# cm-backend

A Node.js backendapplication for KRC-20 Faucet / Claim Server Functionality.

## Setup

1. Install dependencies: `npm install`
2. Create a `.env` file based on the `env.example` file.
3. Build the application: `npm run build`
4. Start the application: `npm run prod`

## Usage

1. The application will start on port 3000.
2. The application will listen for incoming POST requests on the `/claim` endpoint.
3. The application will listen for incoming GET requests on the `/claims/{walletAddress}` endpoint.

No warranties are provided, use at your own risk.
Protect your private keys and do not share them with anyone.