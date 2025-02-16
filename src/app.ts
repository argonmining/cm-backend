import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import apiRoutes from './routes/api';

// Initialize WebSocket for Kaspa RPC
import './utils/websocket';

const app = express();
const port = process.env.PORT || 3001;

// Trust proxy - this is needed because we're behind Nginx
app.set('trust proxy', 1);

// Rate limiting configuration
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        success: false,
        error: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// CORS configuration
const corsOptions = {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    allowedHeaders: [
        'Content-Type',
        'x-signature',
        'x-timestamp',
        'x-nonce'
    ],
    maxAge: 600, // 10 minutes
};

// Security middleware
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '10kb' })); // Limit payload size
app.use(limiter);

// Add request validation middleware
app.use((req, res, next) => {
    // Validate Content-Type for POST requests
    if (req.method === 'POST' && !req.is('application/json')) {
        return res.status(415).json({
            success: false,
            error: 'Content-Type must be application/json'
        });
    }

    // Validate request body size
    if (req.method === 'POST' && req.headers['content-length']) {
        const contentLength = parseInt(req.headers['content-length']);
        if (contentLength > 10000) { // 10KB limit
            return res.status(413).json({
                success: false,
                error: 'Request body too large'
            });
        }
    }

    next();
});

// Routes
app.use('/api', apiRoutes);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        error: 'Internal Server Error'
    });
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
