// MEDIUM LOCKDOWN: Collaborative editing with conflict resolution
// Add to simple-server.js

let activeSessions = new Map(); // Track who's editing what
let autoSaveData = new Map(); // Store auto-saved drafts

// Enhanced data structure
const collaborativeEventStructure = () => {
  Object.keys(sharedEvents).forEach(eventId => {
    if (!sharedEvents[eventId].collaborativeData) {
      sharedEvents[eventId] = {
        ...sharedEvents[eventId],
        collaborativeData: {
          currentVersion: 1,
          checksum: generateChecksum(sharedEvents[eventId].schedule),
          activeEditors: [],
          lastAutoSave: null,
          conflictHistory: []
        }
      };
    }
  });
};

// Start editing session
app.post('/api/events/:id/start-editing', (req, res) => {
  const { id } = req.params;
  const { userInfo } = req.body;
  const userName = userInfo?.name || `User-${Date.now()}`;
  const sessionId = `${userName}-${Date.now()}`;
  
  if (!sharedEvents[id]) {
    return res.status(404).json({ error: 'Event not found' });
  }
  
  // Add to active sessions
  activeSessions.set(sessionId, {
    eventId: id,
    userName,
    startTime: new Date().toISOString(),
    lastActivity: new Date().toISOString()
  });
  
  // Add to event's active editors
  const event = sharedEvents[id];
  if (!event.collaborativeData.activeEditors.find(e => e.userName === userName)) {
    event.collaborativeData.activeEditors.push({
      userName,
      sessionId,
      startTime: new Date().toISOString()
    });
  }
  
  res.json({
    sessionId,
    activeEditors: event.collaborativeData.activeEditors,
    currentVersion: event.collaborativeData.currentVersion,
    checksum: event.collaborativeData.checksum,
    event: {
      id: event.id,
      name: event.name,
      schedule: event.schedule,
      metadata: event.metadata,
      lastModifiedAt: event.lastModifiedAt,
      lastModifiedBy: event.lastModifiedBy
    }
  });
});

// Auto-save draft
app.post('/api/events/:id/auto-save', async (req, res) => {
  const { id } = req.params;
  const { sessionId, schedule, userInfo } = req.body;
  
  const session = activeSessions.get(sessionId);
  if (!session || session.eventId !== id) {
    return res.status(401).json({ error: 'Invalid session' });
  }
  
  // Update session activity
  session.lastActivity = new Date().toISOString();
  
  // Store auto-save data
  const autoSaveKey = `${id}-${sessionId}`;
  autoSaveData.set(autoSaveKey, {
    schedule,
    timestamp: new Date().toISOString(),
    userInfo
  });
  
  res.json({ success: true, autoSaved: true });
});

// Save with conflict detection
app.post('/api/events/:id/save', async (req, res) => {
  try {
    const { id } = req.params;
    const { sessionId, schedule, name, metadata, userInfo, clientChecksum } = req.body;
    
    const session = activeSessions.get(sessionId);
    if (!session || session.eventId !== id) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    
    const event = sharedEvents[id];
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // Check for conflicts using checksum
    const currentChecksum = generateChecksum(event.schedule);
    if (clientChecksum && currentChecksum !== clientChecksum) {
      // Conflict detected - provide resolution options
      return res.status(409).json({
        error: 'CONFLICT_DETECTED',
        message: 'Event was modified by another user',
        conflictData: {
          serverVersion: {
            schedule: event.schedule,
            checksum: currentChecksum,
            lastModifiedBy: event.lastModifiedBy,
            lastModifiedAt: event.lastModifiedAt
          },
          clientVersion: {
            schedule,
            checksum: clientChecksum,
            userName: userInfo?.name || 'Anonymous'
          },
          autoSaveDraft: autoSaveData.get(`${id}-${sessionId}`)
        },
        resolutionOptions: [
          { id: 'keep_server', label: 'Keep server version (discard my changes)' },
          { id: 'keep_client', label: 'Use my version (overwrite server)' },
          { id: 'manual_merge', label: 'Show me both versions to merge manually' }
        ]
      });
    }
    
    // No conflict - save normally
    const timestamp = new Date().toISOString();
    const userName = userInfo?.name || 'Anonymous';
    const newVersion = event.collaborativeData.currentVersion + 1;
    const newChecksum = generateChecksum(schedule);
    
    sharedEvents[id] = {
      ...event,
      name: name || event.name,
      schedule,
      metadata: metadata || event.metadata,
      lastModifiedBy: userName,
      lastModifiedAt: timestamp,
      collaborativeData: {
        ...event.collaborativeData,
        currentVersion: newVersion,
        checksum: newChecksum,
        lastAutoSave: null
      }
    };
    
    // Clean up auto-save data
    autoSaveData.delete(`${id}-${sessionId}`);
    
    await saveToStorage();
    
    res.json({
      success: true,
      version: newVersion,
      checksum: newChecksum,
      message: `Saved version ${newVersion}`
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save event' });
  }
});

// Resolve conflict
app.post('/api/events/:id/resolve-conflict', async (req, res) => {
  try {
    const { id } = req.params;
    const { sessionId, resolution, mergedSchedule, userInfo } = req.body;
    
    const session = activeSessions.get(sessionId);
    if (!session || session.eventId !== id) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    
    const event = sharedEvents[id];
    const timestamp = new Date().toISOString();
    const userName = userInfo?.name || 'Anonymous';
    const newVersion = event.collaborativeData.currentVersion + 1;
    
    let finalSchedule;
    let resolutionNote;
    
    switch (resolution) {
      case 'keep_server':
        finalSchedule = event.schedule;
        resolutionNote = `${userName} kept server version during conflict resolution`;
        break;
      case 'keep_client':
        finalSchedule = mergedSchedule;
        resolutionNote = `${userName} overwrote server version during conflict resolution`;
        break;
      case 'manual_merge':
        finalSchedule = mergedSchedule;
        resolutionNote = `${userName} manually merged conflicting versions`;
        break;
      default:
        return res.status(400).json({ error: 'Invalid resolution type' });
    }
    
    const newChecksum = generateChecksum(finalSchedule);
    
    sharedEvents[id] = {
      ...event,
      schedule: finalSchedule,
      lastModifiedBy: userName,
      lastModifiedAt: timestamp,
      collaborativeData: {
        ...event.collaborativeData,
        currentVersion: newVersion,
        checksum: newChecksum,
        conflictHistory: [
          ...event.collaborativeData.conflictHistory.slice(-4), // Keep last 5
          {
            timestamp,
            resolution,
            resolvedBy: userName,
            note: resolutionNote
          }
        ]
      }
    };
    
    await saveToStorage();
    
    res.json({
      success: true,
      version: newVersion,
      checksum: newChecksum,
      message: `Conflict resolved: ${resolutionNote}`
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to resolve conflict' });
  }
});

// End editing session
app.post('/api/events/:id/end-editing', (req, res) => {
  const { id } = req.params;
  const { sessionId } = req.body;
  
  const session = activeSessions.get(sessionId);
  if (session && session.eventId === id) {
    // Remove from active sessions
    activeSessions.delete(sessionId);
    
    // Remove from event's active editors
    const event = sharedEvents[id];
    if (event) {
      event.collaborativeData.activeEditors = event.collaborativeData.activeEditors
        .filter(e => e.sessionId !== sessionId);
    }
    
    // Clean up auto-save data
    autoSaveData.delete(`${id}-${sessionId}`);
  }
  
  res.json({ success: true });
});

// Get active editors
app.get('/api/events/:id/editors', (req, res) => {
  const event = sharedEvents[req.params.id];
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }
  
  // Clean up stale sessions (older than 10 minutes)
  const cutoff = Date.now() - 10 * 60 * 1000;
  event.collaborativeData.activeEditors = event.collaborativeData.activeEditors
    .filter(editor => {
      const session = activeSessions.get(editor.sessionId);
      return session && new Date(session.lastActivity).getTime() > cutoff;
    });
  
  res.json({
    activeEditors: event.collaborativeData.activeEditors,
    totalActive: event.collaborativeData.activeEditors.length
  });
});

function generateChecksum(schedule) {
  // Simple checksum based on JSON string
  const str = JSON.stringify(schedule || []);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString();
}

module.exports = { 
  collaborativeEventStructure, 
  activeSessions, 
  autoSaveData 
};