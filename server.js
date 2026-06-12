const express = require('express');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'planles1905/poufpouf-prono-2026';
const DATA_FILE = path.join(__dirname, 'resultats.json');
const CONTENT_PATH = `https://api.github.com/repos/${GITHUB_REPO}/contents/resultats.json`;

app.use(express.json({ limit: '100kb' }));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/resultats.json', (req, res) => {
  res.sendFile(DATA_FILE);
});

app.post('/publish', async (req, res) => {
  if (!GITHUB_TOKEN) {
    console.error('Missing GITHUB_TOKEN environment variable');
    return res.status(500).send('Server configuration missing');
  }

  const payload = req.body;
  if (!payload || typeof payload !== 'object' || payload.r == null || payload.b == null) {
    return res.status(400).send('Payload invalide');
  }

  const content = JSON.stringify({ r: payload.r, b: payload.b }, null, 2) + '\n';
  const headers = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'poufpouf-prono-publisher'
  };

  try {
    await fs.writeFile(DATA_FILE, content, 'utf8');
  } catch (err) {
    console.error('Local write failed:', err);
  }

  try {
    const getRes = await fetch(CONTENT_PATH, { headers });
    if (!getRes.ok) {
      const text = await getRes.text();
      console.error('GitHub fetch SHA failed:', getRes.status, text);
      return res.status(502).send('GitHub read failed');
    }

    const fileInfo = await getRes.json();
    const putRes = await fetch(CONTENT_PATH, {
      method: 'PUT',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Mise à jour des résultats',
        content: Buffer.from(content, 'utf8').toString('base64'),
        sha: fileInfo.sha
      })
    });

    if (!putRes.ok) {
      const text = await putRes.text();
      console.error('GitHub update failed:', putRes.status, text);
      return res.status(502).send('GitHub update failed');
    }

    return res.send('OK');
  } catch (err) {
    console.error('Publish error:', err);
    return res.status(500).send('Erreur serveur');
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
