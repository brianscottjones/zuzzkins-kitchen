import express from 'express';

const app = express();
const PORT = process.env.PORT || 8080;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GIST_ID = process.env.GIST_ID;
const ADMIN_KEY = process.env.ADMIN_KEY || 'ratpack2024';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS — allow all origins
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// GET /api/health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// POST /api/signup
app.post('/api/signup', async (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();

    // Basic validation
    if (!email || !email.includes('@') || !email.includes('.')) {
      return res.json({ success: false, error: 'Invalid email' });
    }

    // Fetch current gist
    const gistRes = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'zuzzkins-api'
      }
    });

    const gist = await gistRes.json();
    const currentContent = gist?.files?.['subscribers.csv']?.content || 'email,timestamp\n';

    // Dedup check
    if (currentContent.includes(email)) {
      return res.json({ success: true, message: 'already subscribed' });
    }

    // Append new row
    const newRow = `${email},${new Date().toISOString()}\n`;
    const updatedContent = currentContent + newRow;

    // Update gist
    await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'zuzzkins-api'
      },
      body: JSON.stringify({
        files: {
          'subscribers.csv': { content: updatedContent }
        }
      })
    });

    console.log(`[signup] New subscriber: ${email}`);
    res.json({ success: true });

  } catch (err) {
    console.error('[signup] Error:', err.message);
    // Never show errors to users — just silently succeed
    res.json({ success: true });
  }
});

// GET /api/subscribers?key=ADMIN_KEY — view the list
app.get('/api/subscribers', async (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.status(403).send('Unauthorized');
  }
  try {
    const gistRes = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'zuzzkins-api'
      }
    });
    const gist = await gistRes.json();
    const csv = gist?.files?.['subscribers.csv']?.content || 'email,timestamp\n';
    res.setHeader('Content-Type', 'text/plain');
    res.send(csv);
  } catch (err) {
    res.status(500).send('Error fetching list');
  }
});

app.listen(PORT, () => {
  console.log(`Zuzzkins API running on port ${PORT}`);
});
