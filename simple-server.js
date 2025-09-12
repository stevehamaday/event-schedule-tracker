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

// Enhanced version control storage
let activeUsers = new Map(); // Track active users per event
let userSessions = new Map(); // Track user sessions
let anonymousUserCounter = 0;

// Admin credentials
const ADMIN_USER = 'SFAdmin';
const ADMIN_PASSWORD = 'Microsoftie67!';

// Generate anonymous user ID
function generateAnonymousUserId() {
  anonymousUserCounter++;
  return `User${String.fromCharCode(65 + ((anonymousUserCounter - 1) % 26))}`; // UserA, UserB, etc.
}

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
      
      // Migrate existing events to new structure
      Object.keys(sharedEvents).forEach(eventId => {
        if (!sharedEvents[eventId].versionControl) {
          const originalData = { ...sharedEvents[eventId] };
          sharedEvents[eventId] = {
            ...originalData,
            versionControl: {
              currentVersion: 1,
              originalVersion: {
                version: 0,
                schedule: originalData.schedule || [],
                name: originalData.name || eventId,
                metadata: originalData.metadata || {},
                createdAt: originalData.createdAt || new Date().toISOString(),
                createdBy: 'System',
                note: 'Original version (always restorable)'
              },
              versions: [
                {
                  version: 1,
                  schedule: originalData.schedule || [],
                  name: originalData.name || eventId,
                  metadata: originalData.metadata || {},
                  timestamp: originalData.lastUpdated || new Date().toISOString(),
                  savedBy: originalData.updatedBy || 'Unknown',
                  changes: 'Initial version'
                }
              ],
              deletedAt: null,
              deletedBy: null,
              isDeleted: false
            }
          };
        }
      });
      
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

// Enhanced version control APIs

// Start user session for an event
app.post('/api/events/:id/start-session', (req, res) => {
  const eventId = req.params.id;
  const { clientId } = req.body;
  
  if (!sharedEvents[eventId] || sharedEvents[eventId].versionControl?.isDeleted) {
    return res.status(404).json({ error: 'Event not found' });
  }
  
  // Generate or reuse anonymous user ID
  let sessionInfo = userSessions.get(clientId);
  if (!sessionInfo) {
    sessionInfo = {
      userId: generateAnonymousUserId(),
      clientId,
      createdAt: Date.now()
    };
    userSessions.set(clientId, sessionInfo);
  }
  
  // Add to active users for this event
  if (!activeUsers.has(eventId)) {
    activeUsers.set(eventId, new Set());
  }
  activeUsers.get(eventId).add(sessionInfo.userId);
  
  // Update last activity
  sessionInfo.lastActivity = Date.now();
  
  res.json({
    userId: sessionInfo.userId,
    activeUsers: Array.from(activeUsers.get(eventId) || []),
    event: {
      ...sharedEvents[eventId],
      currentVersion: sharedEvents[eventId].versionControl.currentVersion,
      lastModifiedAt: sharedEvents[eventId].lastUpdated,
      lastModifiedBy: sharedEvents[eventId].updatedBy
    }
  });
});

// End user session
app.post('/api/events/:id/end-session', (req, res) => {
  const eventId = req.params.id;
  const { clientId } = req.body;
  
  const sessionInfo = userSessions.get(clientId);
  if (sessionInfo && activeUsers.has(eventId)) {
    activeUsers.get(eventId).delete(sessionInfo.userId);
    if (activeUsers.get(eventId).size === 0) {
      activeUsers.delete(eventId);
    }
  }
  
  res.json({ success: true });
});

// Get active users for an event
app.get('/api/events/:id/active-users', (req, res) => {
  const eventId = req.params.id;
  
  // Clean up stale sessions (older than 5 minutes)
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [clientId, session] of userSessions.entries()) {
    if (session.lastActivity < cutoff) {
      if (activeUsers.has(eventId)) {
        activeUsers.get(eventId).delete(session.userId);
      }
      userSessions.delete(clientId);
    }
  }
  
  const activeUserList = Array.from(activeUsers.get(eventId) || []);
  res.json({ activeUsers: activeUserList });
});

// Admin login
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  
  if (username === ADMIN_USER && password === ADMIN_PASSWORD) {
    res.json({ 
      success: true, 
      role: 'admin',
      message: 'Admin access granted'
    });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.get('/api/events', (req, res) => {
  // Convert object to array format expected by frontend
  // Filter out soft-deleted events for regular users
  const eventsArray = Object.values(sharedEvents)
    .filter(event => !event.versionControl?.isDeleted);
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
    const { 
      schedule, 
      name, 
      metadata, 
      clientId, 
      clientLastModified, 
      skipConflictCheck = false 
    } = req.body;
    
    const sessionInfo = userSessions.get(clientId);
    const userId = sessionInfo?.userId || 'Anonymous';
    
    const existingEvent = sharedEvents[eventId];
    const timestamp = new Date().toISOString();
    
    // Check for conflicts (unless skipping)
    if (existingEvent && !skipConflictCheck && clientLastModified) {
      if (existingEvent.lastUpdated > clientLastModified) {
        return res.status(409).json({
          error: 'CONFLICT_DETECTED',
          message: `Event was modified by ${existingEvent.updatedBy || 'another user'}`,
          serverVersion: {
            lastModified: existingEvent.lastUpdated,
            modifiedBy: existingEvent.updatedBy,
            currentVersion: existingEvent.versionControl?.currentVersion
          },
          clientVersion: {
            lastModified: clientLastModified
          }
        });
      }
    }
    
    // Create or update event with version control
    const newVersion = existingEvent ? existingEvent.versionControl.currentVersion + 1 : 1;
    
    // For new events, create the structure
    if (!existingEvent) {
      sharedEvents[eventId] = {
        id: eventId,
        name: name || eventId,
        schedule: schedule || [],
        metadata: metadata || {},
        lastUpdated: timestamp,
        updatedBy: userId,
        createdAt: timestamp,
        persisted: true,
        versionControl: {
          currentVersion: 1,
          originalVersion: {
            version: 0,
            schedule: schedule || [],
            name: name || eventId,
            metadata: metadata || {},
            createdAt: timestamp,
            createdBy: userId,
            note: 'Original version (always restorable)'
          },
          versions: [
            {
              version: 1,
              schedule: schedule || [],
              name: name || eventId,
              metadata: metadata || {},
              timestamp,
              savedBy: userId,
              changes: 'Initial version'
            }
          ],
          deletedAt: null,
          deletedBy: null,
          isDeleted: false
        }
      };
    } else {
      // Update existing event
      const previousSchedule = existingEvent.schedule;
      const changes = calculateChanges(previousSchedule, schedule);
      
      // Update main event data
      sharedEvents[eventId] = {
        ...existingEvent,
        name: name || existingEvent.name,
        schedule: schedule || existingEvent.schedule,
        metadata: metadata || existingEvent.metadata,
        lastUpdated: timestamp,
        updatedBy: userId,
        versionControl: {
          ...existingEvent.versionControl,
          currentVersion: newVersion,
          versions: [
            ...existingEvent.versionControl.versions.slice(-4), // Keep last 5 versions
            {
              version: newVersion,
              schedule: schedule || existingEvent.schedule,
              name: name || existingEvent.name,
              metadata: metadata || existingEvent.metadata,
              timestamp,
              savedBy: userId,
              changes
            }
          ]
        }
      };
    }
    
    // Save to file
    await saveToStorage();
    
    res.json({
      success: true,
      event: sharedEvents[eventId],
      version: newVersion,
      message: `Saved as version ${newVersion}`
    });
  } catch (error) {
    console.error('Failed to save event:', error);
    res.status(500).json({ error: 'Failed to save event' });
  }
});

// Restore to original version
app.post('/api/events/:id/restore-original', async (req, res) => {
  try {
    const eventId = req.params.id;
    const { clientId } = req.body;
    
    const event = sharedEvents[eventId];
    if (!event || event.versionControl?.isDeleted) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    const sessionInfo = userSessions.get(clientId);
    const userId = sessionInfo?.userId || 'Anonymous';
    const timestamp = new Date().toISOString();
    
    const originalVersion = event.versionControl.originalVersion;
    const newVersion = event.versionControl.currentVersion + 1;
    
    // Restore to original
    sharedEvents[eventId] = {
      ...event,
      name: originalVersion.name,
      schedule: originalVersion.schedule,
      metadata: originalVersion.metadata,
      lastUpdated: timestamp,
      updatedBy: userId,
      versionControl: {
        ...event.versionControl,
        currentVersion: newVersion,
        versions: [
          ...event.versionControl.versions.slice(-4),
          {
            version: newVersion,
            schedule: originalVersion.schedule,
            name: originalVersion.name,
            metadata: originalVersion.metadata,
            timestamp,
            savedBy: userId,
            changes: 'Restored to original version'
          }
        ]
      }
    };
    
    await saveToStorage();
    
    res.json({
      success: true,
      message: 'Restored to original version',
      version: newVersion,
      event: sharedEvents[eventId]
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to restore original version' });
  }
});

// Soft delete (hide from users)
app.delete('/api/events/:id', async (req, res) => {
  try {
    const eventId = req.params.id;
    const { clientId, isAdmin = false } = req.body;
    
    const event = sharedEvents[eventId];
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    const sessionInfo = userSessions.get(clientId);
    const userId = sessionInfo?.userId || 'Anonymous';
    const timestamp = new Date().toISOString();
    
    if (isAdmin) {
      // Admin: True delete
      delete sharedEvents[eventId];
      await saveToStorage();
      
      res.json({ 
        success: true, 
        message: 'Event permanently deleted by admin',
        deleted: true 
      });
    } else {
      // Regular user: Soft delete
      sharedEvents[eventId].versionControl.isDeleted = true;
      sharedEvents[eventId].versionControl.deletedAt = timestamp;
      sharedEvents[eventId].versionControl.deletedBy = userId;
      
      await saveToStorage();
      
      res.json({ 
        success: true, 
        message: 'Event moved to trash (admin can restore)',
        deleted: false,
        softDeleted: true 
      });
    }
  } catch (error) {
    console.error('Failed to delete event:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// Admin: Get deleted events
app.get('/api/admin/deleted-events', (req, res) => {
  const { isAdmin } = req.query;
  
  if (!isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const deletedEvents = Object.values(sharedEvents)
    .filter(event => event.versionControl?.isDeleted)
    .map(event => ({
      id: event.id,
      name: event.name,
      deletedAt: event.versionControl.deletedAt,
      deletedBy: event.versionControl.deletedBy,
      segmentCount: event.schedule?.length || 0
    }));
  
  res.json(deletedEvents);
});

// Admin: Restore deleted event
app.post('/api/admin/restore/:id', async (req, res) => {
  try {
    const eventId = req.params.id;
    const { isAdmin } = req.body;
    
    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const event = sharedEvents[eventId];
    if (!event || !event.versionControl?.isDeleted) {
      return res.status(404).json({ error: 'Deleted event not found' });
    }
    
    // Restore event
    event.versionControl.isDeleted = false;
    event.versionControl.deletedAt = null;
    event.versionControl.deletedBy = null;
    
    await saveToStorage();
    
    res.json({
      success: true,
      message: 'Event restored successfully',
      event: event
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to restore event' });
  }
});

function calculateChanges(oldSchedule, newSchedule) {
  if (!oldSchedule || !newSchedule) return 'Complete schedule replacement';
  
  if (oldSchedule.length !== newSchedule.length) {
    return `Schedule length changed: ${oldSchedule.length} → ${newSchedule.length} segments`;
  }
  
  let changedSegments = 0;
  for (let i = 0; i < oldSchedule.length; i++) {
    if (JSON.stringify(oldSchedule[i]) !== JSON.stringify(newSchedule[i])) {
      changedSegments++;
    }
  }
  
  return changedSegments > 0 ? `${changedSegments} segments modified` : 'Minor changes';
}

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