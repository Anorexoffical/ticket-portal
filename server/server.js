import 'dotenv/config';
import app from './src/app.js';

const port = Number(process.env.PORT || 4000);
app.listen(port, '0.0.0.0', () => console.log(`API listening on http://localhost:${port}`));
