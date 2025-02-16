import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import apiRoutes from './routes/api';

// Initialize WebSocket for Kaspa RPC
import './utils/websocket';

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

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
