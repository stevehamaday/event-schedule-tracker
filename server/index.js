import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import { BlobServiceClient } from '@azure/storage-blob';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// Get directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files from the parent directory's docs folder (built app)
app.use(express.static(path.join(__dirname, '../docs')));

// In-memory storage for shared events (in production, use Azure SQL Database or Cosmos DB)
let sharedEvents = {};
let persistenceReady = false;
const PERSIST_CONTAINER = process.env.SHOWFLOW_BLOB_CONTAINER || 'showflow-events';
const PERSIST_BLOB = 'events.json';

async function initPersistence() {
  try {
    if (!process.env.AZURE_STORAGE_CONNECTION_STRING) return;
    const blobService = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
    const container = blobService.getContainerClient(PERSIST_CONTAINER);
    await container.createIfNotExists();
    const blockBlob = container.getBlockBlobClient(PERSIST_BLOB);
    if (await blockBlob.exists()) {
      const downloaded = await blockBlob.download();
      const body = await streamToString(downloaded.readableStreamBody);
      sharedEvents = JSON.parse(body || '{}');
    } else {
      await blockBlob.upload(JSON.stringify(sharedEvents), Buffer.byteLength(JSON.stringify(sharedEvents)));
    }
    persistenceReady = true;
    console.log('[Persistence] Azure Blob persistence initialized.');
  } catch (err) {
    console.warn('[Persistence] Disabled (reason):', err.message);
  }
}

async function savePersistence() {
  try {
    if (!persistenceReady) return;
    const blobService = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
    const container = blobService.getContainerClient(PERSIST_CONTAINER);
    const blockBlob = container.getBlockBlobClient(PERSIST_BLOB);
    const data = JSON.stringify(sharedEvents);
    await blockBlob.upload(data, Buffer.byteLength(data), { overwrite: true });
  } catch (err) {
    console.warn('[Persistence] Save failed:', err.message);
  }
}

function streamToString(readable) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readable.on('data', (d) => chunks.push(d.toString()));
    readable.on('end', () => resolve(chunks.join('')));
    readable.on('error', reject);
  });
}

initPersistence();
let activeConnections = new Set();

// Azure OpenAI endpoint and key from .env
const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT; // e.g. https://YOUR_RESOURCE_NAME.openai.azure.com/openai/deployments/YOUR_DEPLOYMENT_NAME/chat/completions?api-version=2024-02-15-preview
const AZURE_OPENAI_KEY = process.env.AZURE_OPENAI_KEY;

// Shared Event Management APIs
app.get('/api/events/:eventId', (req, res) => {
  const { eventId } = req.params;
  const event = sharedEvents[eventId];
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }
  res.json(event);
});

app.post('/api/events/:eventId', async (req, res) => {
  const { eventId } = req.params;
  const { schedule, title, description, lastUpdated, updatedBy } = req.body;
  
  sharedEvents[eventId] = {
    id: eventId,
    title: title || `Event ${eventId}`,
    description: description || '',
    schedule: schedule || [],
    lastUpdated: lastUpdated || new Date().toISOString(),
    updatedBy: updatedBy || 'Anonymous',
    createdAt: sharedEvents[eventId]?.createdAt || new Date().toISOString()
  };
  
  await savePersistence();
  res.json({ success: true, event: sharedEvents[eventId], persisted: persistenceReady });
});

app.get('/api/events', (req, res) => {
  const eventList = Object.values(sharedEvents).map(event => ({
    id: event.id,
    title: event.title,
    description: event.description,
    lastUpdated: event.lastUpdated,
    updatedBy: event.updatedBy,
    segmentCount: event.schedule?.length || 0
  }));
  res.json(eventList);
});

app.delete('/api/events/:eventId', async (req, res) => {
  const { eventId } = req.params;
  if (sharedEvents[eventId]) {
    delete sharedEvents[eventId];
  await savePersistence();
  res.json({ success: true, persisted: persistenceReady });
  } else {
    res.status(404).json({ error: 'Event not found' });
  }
});

// Original GPT endpoint
app.post('/api/gpt', async (req, res) => {
  const { prompt, system } = req.body;
  try {
    const response = await axios.post(
      AZURE_OPENAI_ENDPOINT,
      {
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          { role: 'user', content: prompt }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'api-key': AZURE_OPENAI_KEY
        }
      }
    );
    res.json({ result: response.data.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

// Lightweight health check for Azure / monitoring
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    version: process.env.npm_package_version || 'unknown',
    persistence: persistenceReady,
    events: Object.keys(sharedEvents).length
  });
});

// Serve the React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../docs/index.html'));
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Show Flow Tracker with shared events running on port ${PORT}`));
