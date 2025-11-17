
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Health route for Render
app.get('/health', (req, res) => res.status(200).send('ok'));

app.get('/', (req, res) => res.send('API is running'));
app.get('/api/metrics', (req, res) => {
  res.json({ bundles: [], summary: { totals: { impressions: 0 }, byPlatform: {} }, winner: null });
});

const PORT = process.env.PORT;
if (!PORT) {
  console.error('PORT not set. Render will assign this automatically.');
  process.exit(1);
}
app.listen(PORT, '0.0.0.0', () => console.log('Server running on port', PORT));
