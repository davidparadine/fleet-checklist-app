// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const { Resend } = require('resend');
const cors = require('cors');
const path = require('path'); // Import the path module

const app = express();
app.use(express.json());

// --- Static File Serving for Local Development ---
// Serve static files (index.html, app.js, etc.) from the project's root directory.
app.use(express.static(path.join(__dirname, '/')));

// Configure CORS to be more secure
// Define a whitelist of allowed origins.
// The `CORS_ORIGIN` environment variable can contain a comma-separated list of domains.
const whitelist = (process.env.CORS_ORIGIN || 'http://localhost:3000,https://fleet-checklist-app.vercel.app').split(',');

const corsOptions = {
  origin: function (origin, callback) {
    // Regex to allow Vercel preview URLs, e.g., https://fleet-checklist-app-*.vercel.app
    const vercelPreviewRegex = /^https:\/\/fleet-checklist-app-.*\.vercel\.app$/; 

    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (
      whitelist.indexOf(origin) !== -1 ||
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

// --- Server Listening for Local Development ---
const PORT = process.env.PORT || 3000;

// This block ensures `app.listen` is only called when running `node server.js` directly.
// It will be ignored by Vercel, which imports the `app` object as a module.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`✅ Server is running. Open your browser at http://localhost:${PORT}`);
  });
}

// Export the app for serverless environments like Vercel
module.exports = app;