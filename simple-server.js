const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from docs folder
app.use(express.static(path.join(__dirname, 'docs')));

// Simple in-memory storage for events
let sharedEvents = {};

// API routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    version: '1.0.0',
    persistence: false,
    events: Object.keys(sharedEvents).length
  });
});

app.get('/api/events', (req, res) => {
  res.json(sharedEvents);
});

app.get('/api/events/:id', (req, res) => {
  const event = sharedEvents[req.params.id];
  if (event) {
    res.json(event);
  } else {
    res.status(404).json({ error: 'Event not found' });
  }
});

app.post('/api/events/:id', (req, res) => {
  const eventId = req.params.id;
  sharedEvents[eventId] = {
    ...req.body,
    id: eventId,
    lastUpdated: new Date().toISOString(),
    persisted: false
  };
  res.json(sharedEvents[eventId]);
});

app.delete('/api/events/:id', (req, res) => {
  if (sharedEvents[req.params.id]) {
    delete sharedEvents[req.params.id];
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Event not found' });
  }
});

// Catch-all handler for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'docs', 'index.html'));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});