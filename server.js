// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const { Resend } = require('resend');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());

// Configure CORS to be more secure
const GITHUB_API_URL = 'https://api.github.com';
const REPO_OWNER = 'davidparadine';
const REPO_NAME = 'fleet-checklist-app';

// Define a whitelist of allowed origins.
// The `CORS_ORIGIN` environment variable can contain a comma-separated list of domains.
// Your GitHub Pages URL is added as a default.
const whitelist = (process.env.CORS_ORIGIN || 'http://localhost:8080,https://davidparadine.github.io,https://fleet-checklist-app.vercel.app').split(',');

const corsOptions = {
  origin: function (origin, callback) {
    // Regex to allow Vercel preview URLs, e.g., https://fleet-checklist-app-*.vercel.app
    const vercelPreviewRegex = /^https:\/\/fleet-checklist-app-.*\.vercel\.app$/; 
    // The main production URL
    const vercelProdUrl = 'https://fleet-checklist-app.vercel.app';

    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (
      whitelist.indexOf(origin) !== -1 ||
      origin === vercelProdUrl || // Explicitly allow the production URL
      vercelPreviewRegex.test(origin)
    ) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
};

app.use(cors(corsOptions));

// Explicitly handle preflight requests for all routes
app.options('*', cors(corsOptions));

// A simple health check endpoint to verify the server is running
app.get('/api/health', (req, res) => {
  res.status(200).send('✅ FleetClean API is running.');
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
  const { fileName: baseFileName, content } = req.body;

  if (!baseFileName || !content) {
    return res.status(400).json({ message: 'Missing fileName or content.' });
  }

  // Securely construct the full path on the server to prevent path traversal.
  const fullPath = `progress/${baseFileName}`;

  const getExistingFile = async () => {
    try {
      // Attempt to get the file's metadata (including its SHA)
      return await githubApiRequest(`/contents/${fullPath}`);
    } catch (error) {
      // If the error is a 404, it means the file doesn't exist yet, which is fine.
      if (error.message.includes('404')) {
        return null;
      }
      // For any other error, re-throw it to be caught by the main catch block.
      throw error;
    }
  };

  try {
    const existingFile = await getExistingFile();

    const requestBody = {
      message: `Fleet checklist update: ${baseFileName}`,
      content: Buffer.from(JSON.stringify(content, null, 2)).toString('base64'),
      branch: 'main',
      // If the file exists, include its SHA to update it. Otherwise, this is a new file.
      ...(existingFile && { sha: existingFile.sha }),
    };

    const data = await githubApiRequest(`/contents/${fullPath}`, {
      method: 'PUT',
      body: JSON.stringify(requestBody),
    });

    // GitHub returns 201 for creation and 200 for update. Both are success cases.
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
    // If the directory doesn't exist, GitHub returns a 404. This is not a server crash.
    // We can return an empty array to the frontend so it shows "No saved files".
    if (error.message.includes('404')) {
      return res.status(200).json([]);
    }
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
    // The frontend sends the filename (e.g., "vehicle_ABC_123.json").
    // We construct the full, safe path on the server.
    const fullPath = `progress/${fileName}`;
    const data = await githubApiRequest(`/contents/${fullPath}`);
    res.status(200).json(data);
  } catch (error) {
    console.error('GitHub Get File Error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Export the app for Vercel
module.exports = app;