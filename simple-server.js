const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from docs folder
app.use(express.static(path.join(__dirname, 'docs')));

// Storage configuration
const STORAGE_FILE = path.join(__dirname, 'data', 'shared-events.json');
let sharedEvents = {};

// Ensure data directory exists and load existing data
async function initializeStorage() {
  try {
    // Create data directory if it doesn't exist
    const dataDir = path.dirname(STORAGE_FILE);
    await fs.mkdir(dataDir, { recursive: true });
    
    // Load existing data
    try {
      const data = await fs.readFile(STORAGE_FILE, 'utf8');
      sharedEvents = JSON.parse(data);
      console.log(`Loaded ${Object.keys(sharedEvents).length} shared events from storage`);
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.log('No existing storage file found, starting fresh');
        sharedEvents = {};
      } else {
        throw err;
      }
    }
  } catch (error) {
    console.error('Failed to initialize storage:', error);
    sharedEvents = {};
  }
}

// Save data to file
async function saveToStorage() {
  try {
    await fs.writeFile(STORAGE_FILE, JSON.stringify(sharedEvents, null, 2), 'utf8');
    console.log(`Saved ${Object.keys(sharedEvents).length} events to storage`);
  } catch (error) {
    console.error('Failed to save to storage:', error);
    throw error;
  }
}

// API routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    version: '1.0.0',
    persistence: true,
    events: Object.keys(sharedEvents).length,
    storageLocation: 'file'
  });
});

app.get('/api/events', (req, res) => {
  // Convert object to array format expected by frontend
  const eventsArray = Object.values(sharedEvents);
  res.json(eventsArray);
});

app.get('/api/events/:id', (req, res) => {
  const event = sharedEvents[req.params.id];
  if (event) {
    res.json(event);
  } else {
    res.status(404).json({ error: 'Event not found' });
  }
});

app.post('/api/events/:id', async (req, res) => {
  try {
    const eventId = req.params.id;
    sharedEvents[eventId] = {
      ...req.body,
      id: eventId,
      lastUpdated: new Date().toISOString(),
      persisted: true
    };
    
    // Save to file
    await saveToStorage();
    
    res.json(sharedEvents[eventId]);
  } catch (error) {
    console.error('Failed to save event:', error);
    res.status(500).json({ error: 'Failed to save event' });
  }
});

app.delete('/api/events/:id', async (req, res) => {
  try {
    if (sharedEvents[req.params.id]) {
      delete sharedEvents[req.params.id];
      
      // Save to file
      await saveToStorage();
      
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Event not found' });
    }
  } catch (error) {
    console.error('Failed to delete event:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// Catch-all handler for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'docs', 'index.html'));
});

const PORT = process.env.PORT || 8080;

// Initialize storage and start server
async function startServer() {
  await initializeStorage();
  
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Storage initialized with ${Object.keys(sharedEvents).length} events`);
  });
}

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});