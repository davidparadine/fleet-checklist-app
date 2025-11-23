// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const { Resend } = require('resend');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises; // Use promises-based fs for async operations

const app = express();

// --- Middleware ---
app.use(cors()); // Enable CORS for all origins for local development simplicity
app.use(express.json());

// --- Static File Serving ---
// Serve static files (index.html, app.js, etc.) from the project's root directory.
app.use(express.static(path.join(__dirname, '/')));

app.get('/api/progress-files', async (req, res) => {
    const progressDir = path.join(__dirname, 'progress_files');
    try {
        await fs.mkdir(progressDir, { recursive: true });
        const files = await fs.readdir(progressDir);
        res.status(200).json(files.filter(file => file.endsWith('.json')));
    } catch (error) {
        console.error('Error listing progress files:', error);
        res.status(500).json({ message: 'Internal Server Error while listing files.' });
    }
});

// --- API Endpoints ---
// A simple health check endpoint to verify the server is running
app.get('/api/health', (req, res) => {
  res.status(200).send('✅ FleetClean API is running.');
});

// IMPORTANT: Store your API key in an environment variable, not in the code.
const resendApiKey = process.env.RESEND_API_KEY;
if (!resendApiKey) {
  console.error('❌ FATAL ERROR: RESEND_API_KEY is not defined in the .env file.');
  process.exit(1); // Exit the process with an error code
}
const resend = new Resend(resendApiKey);

app.post('/api/send-email', async (req, res) => {
  const { from, to, subject, body } = req.body;

  if (!from || !to || !subject || !body) {
    return res.status(400).json({ message: 'Missing required fields: from, to, subject, body' });
  }

  try {
    const { data, error } = await resend.emails.send({
      from: `Fleet Management <${from}>`,
      reply_to: 'd.paradinejr@dpmep.com', // Hardcoded as requested
      to: Array.isArray(to) ? to : [to], // Ensure 'to' is always an array
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

app.post('/api/save-progress', async (req, res) => {
  const { filename, data } = req.body;

  if (!filename || !data) {
    return res.status(400).json({ message: 'Missing required fields: filename, data' });
  }

  try {
    const progressDir = path.join(__dirname, 'progress_files');
    // Create the directory if it doesn't exist
    await fs.mkdir(progressDir, { recursive: true });

    const filePath = path.join(progressDir, filename);
    // Sanitize filename to prevent path traversal attacks
    if (path.dirname(filePath) !== progressDir) {
      return res.status(400).json({ message: 'Invalid filename.' });
    }

    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    res.status(200).json({ message: `Progress saved successfully to ${filename}` });
  } catch (error) {
    console.error('Error saving progress file:', error);
    res.status(500).json({ message: 'Internal Server Error while saving file.' });
  }
});

// --- Server Listening ---
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Server is running. Open your browser at http://localhost:${PORT}`);
});