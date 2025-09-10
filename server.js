// A simple backend example using Express.js and Resend
// To run this:
// 1. Create a .env file with your RESEND_API_KEY (e.g., RESEND_API_KEY=re_12345678)
// 2. Run `node server.js`

// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const { Resend } = require('resend');
const cors = require('cors');

const app = express();
app.use(express.json());

// Configure CORS to be more secure
const corsOptions = {
  // In production, set this to your frontend's domain.
  // For local dev, you can allow localhost:8080.
  origin: process.env.CORS_ORIGIN || 'http://localhost:8080'
};

app.use(cors(corsOptions));

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


// Export the app for Vercel
module.exports = app;