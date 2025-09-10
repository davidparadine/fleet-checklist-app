// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const { Resend } = require('resend');
const cors = require('cors');

const app = express();
app.use(express.json());

// Configure CORS to be more secure
const GITHUB_API_URL = 'https://api.github.com';
const REPO_OWNER = 'davidparadine';
const REPO_NAME = 'fleet-checklist-app';

const corsOptions = {
  // In production, set this to your frontend's domain.
  origin: process.env.CORS_ORIGIN || 'http://localhost:8080',
};

app.use(cors(corsOptions));

// A simple health check endpoint to verify the server is running
app.get('/api/send-email', (req, res) => {
  res.status(200).send('✅ FleetClean Email API is running.');
});

// IMPORTANT: Store your API key in an environment variable, not in the code.
const resend = new Resend(process.env.RESEND_API_KEY);
const GITHUB_PAT = process.env.GITHUB_PAT;

app.post('/api/send-email', async (req, res) => {
  const { from, to, subject, body } = req.body;

  if (!from || !to || !subject || !body) {
    return res.status(400).json({ message: 'Missing required fields: from, to, subject, body' });
  }

  try {
    const { data, error } = await resend.emails.send({
      from: `Fleet Management <${from}>`,
      reply_to: 'd.paradinejr@dpmep.com',
      to: to,
      subject: subject,
      text: body, // Resend uses 'text' for the plain text body
    });

    if (error) {
      console.error({ error });
      return res.status(400).json(error);
    }

    res.status(200).json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// === GITHUB API ENDPOINTS ===

/**
 * Helper function for GitHub API requests
 */
async function githubApiRequest(endpoint, options = {}) {
  if (!GITHUB_PAT) {
    // This will be caught by the endpoint's try/catch block
    throw new Error('Server configuration error: GITHUB_PAT is not set on the server.');
  }
  const url = `${GITHUB_API_URL}/repos/${REPO_OWNER}/${REPO_NAME}${endpoint}`;
  const defaultOptions = {
    headers: {
      Authorization: `token ${GITHUB_PAT}`,
      'User-Agent': 'FleetChecklistApp-Backend/1.0',
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github.v3+json',
    },
  };

  const response = await fetch(url, { ...defaultOptions, ...options });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(`GitHub API Error (${response.status}): ${errorData.message}`);
  }

  return response.json();
}

/**
 * Endpoint to save a file to GitHub.
 */
app.post('/api/github/save', async (req, res) => {
  const { fileName, content } = req.body;

  if (!fileName || !content) {
    return res.status(400).json({ message: 'Missing fileName or content.' });
  }

  try {
    let existingFileSha = null;
    try {
      const fileData = await githubApiRequest(`/contents/${fileName}`);
      existingFileSha = fileData.sha;
    } catch (error) {
      if (!error.message.includes('404')) {
        throw error; // Re-throw if it's not a "file not found" error
      }
    }

    const requestBody = {
      message: `Fleet checklist update: ${fileName.split('/').pop()}`,
      content: Buffer.from(JSON.stringify(content, null, 2)).toString('base64'),
      branch: 'main',
    };

    if (existingFileSha) {
      requestBody.sha = existingFileSha;
    }

    const data = await githubApiRequest(`/contents/${fileName}`, {
      method: 'PUT',
      body: JSON.stringify(requestBody),
    });

    res.status(200).json(data);
  } catch (error) {
    console.error('GitHub Save Error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * Endpoint to list files in the 'progress' directory.
 */
app.get('/api/github/load', async (req, res) => {
  try {
    const data = await githubApiRequest('/contents/progress');
    res.status(200).json(data);
  } catch (error) {
    console.error('GitHub List Files Error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * Endpoint to get the content of a specific file.
 */
app.get('/api/github/load/:fileName', async (req, res) => {
  const { fileName } = req.params;
  try {
    // The file path is already encoded by the browser, but we ensure it's safe.
    const safeFilePath = `progress/${encodeURIComponent(fileName)}`;
    const data = await githubApiRequest(`/contents/${safeFilePath}`);
    res.status(200).json(data);
  } catch (error) {
    console.error('GitHub Get File Error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Export the app for Vercel
module.exports = app;