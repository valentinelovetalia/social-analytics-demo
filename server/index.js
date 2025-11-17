
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req,res) => res.status(200).send('ok'));
app.get('/', (req,res) => res.send('API is running'));
app.get('/api/metrics', (req,res) => res.json({ ok: true }));

const { PORT } = process.env;
if (!PORT) { console.error('Missing PORT env var'); process.exit(1); }
app.listen(PORT, '0.0.0.0', () => console.log('Server running on port', PORT));
