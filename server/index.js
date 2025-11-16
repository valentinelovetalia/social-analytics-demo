import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.send('API is running'));
// Mock endpoint, replace with real IG/TikTok adapters later
app.get('/api/metrics', (req, res) => {
  res.json({ bundles: [], summary: { totals: { impressions: 0 }, byPlatform: {} }, winner: null });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));