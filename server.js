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

// This allows your frontend (running on a different port during development) to call the API.
// In a real production environment, you might serve the frontend and backend from the same origin.
app.use(cors());

// Serve your static frontend files (index.html, app.js, etc.)
app.use(express.static(__dirname));

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

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running. Open http://localhost:${PORT} in your browser.`);
});