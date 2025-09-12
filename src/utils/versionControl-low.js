// LOW LOCKDOWN: Simple optimistic version control
// Add to simple-server.js

// Enhanced data structure with versioning
const enhanceSharedEventStructure = () => {
  // Migrate existing events to new structure
  Object.keys(sharedEvents).forEach(eventId => {
    if (!sharedEvents[eventId].versions) {
      sharedEvents[eventId] = {
        ...sharedEvents[eventId],
        currentVersion: 1,
        versions: [
          {
            version: 1,
            ...sharedEvents[eventId],
            timestamp: sharedEvents[eventId].lastUpdated || new Date().toISOString()
          }
        ],
        lastModifiedBy: sharedEvents[eventId].updatedBy || 'Unknown',
        lastModifiedAt: sharedEvents[eventId].lastUpdated || new Date().toISOString()
      };
    }
  });
};

// Modified save endpoint with version checking
app.post('/api/events/:id', async (req, res) => {
  try {
    const eventId = req.params.id;
    const { schedule, name, metadata, userInfo, clientLastModified } = req.body;
    
    const existingEvent = sharedEvents[eventId];
    
    // Check for conflicts (simple timestamp comparison)
    if (existingEvent && clientLastModified && 
        existingEvent.lastModifiedAt > clientLastModified) {
      return res.status(409).json({
        error: 'CONFLICT_DETECTED',
        message: `Event was modified by ${existingEvent.lastModifiedBy} at ${existingEvent.lastModifiedAt}`,
        currentVersion: existingEvent.currentVersion,
        lastModifiedBy: existingEvent.lastModifiedBy,
        lastModifiedAt: existingEvent.lastModifiedAt
      });
    }
    
    const newVersion = existingEvent ? existingEvent.currentVersion + 1 : 1;
    const timestamp = new Date().toISOString();
    const userName = userInfo?.name || 'Anonymous';
    
    // Create new version entry
    const newVersionData = {
      version: newVersion,
      schedule: schedule || [],
      name: name || eventId,
      metadata: metadata || {},
      timestamp,
      savedBy: userName,
      changes: existingEvent ? calculateChanges(existingEvent.schedule, schedule) : null
    };
    
    // Update event with new version
    sharedEvents[eventId] = {
      id: eventId,
      name: name || eventId,
      schedule: schedule || [],
      metadata: metadata || {},
      currentVersion: newVersion,
      versions: [
        ...(existingEvent?.versions || []).slice(-2), // Keep last 2 versions
        newVersionData
      ],
      lastModifiedBy: userName,
      lastModifiedAt: timestamp,
      createdAt: existingEvent?.createdAt || timestamp
    };
    
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

// Get event versions
app.get('/api/events/:id/versions', (req, res) => {
  const event = sharedEvents[req.params.id];
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }
  
  res.json({
    eventId: req.params.id,
    currentVersion: event.currentVersion,
    versions: event.versions.map(v => ({
      version: v.version,
      timestamp: v.timestamp,
      savedBy: v.savedBy,
      changes: v.changes
    }))
  });
});

// Restore previous version
app.post('/api/events/:id/restore/:version', async (req, res) => {
  try {
    const { id, version } = req.params;
    const { userInfo } = req.body;
    
    const event = sharedEvents[id];
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    const targetVersion = event.versions.find(v => v.version == version);
    if (!targetVersion) {
      return res.status(404).json({ error: 'Version not found' });
    }
    
    // Create new version from restored data
    const newVersion = event.currentVersion + 1;
    const timestamp = new Date().toISOString();
    const userName = userInfo?.name || 'Anonymous';
    
    const restoredVersionData = {
      version: newVersion,
      schedule: targetVersion.schedule,
      name: targetVersion.name,
      metadata: targetVersion.metadata,
      timestamp,
      savedBy: userName,
      changes: `Restored from version ${version}`
    };
    
    sharedEvents[id] = {
      ...event,
      schedule: targetVersion.schedule,
      name: targetVersion.name,
      metadata: targetVersion.metadata,
      currentVersion: newVersion,
      versions: [...event.versions, restoredVersionData],
      lastModifiedBy: userName,
      lastModifiedAt: timestamp
    };
    
    await saveToStorage();
    
    res.json({
      success: true,
      message: `Restored to version ${version}`,
      currentVersion: newVersion
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to restore version' });
  }
});

function calculateChanges(oldSchedule, newSchedule) {
  if (!oldSchedule || !newSchedule) return 'Full schedule change';
  
  const changes = [];
  if (oldSchedule.length !== newSchedule.length) {
    changes.push(`Schedule length: ${oldSchedule.length} → ${newSchedule.length}`);
  }
  
  // Simple diff - could be enhanced
  let modifiedCount = 0;
  const maxLength = Math.max(oldSchedule.length, newSchedule.length);
  for (let i = 0; i < maxLength; i++) {
    if (JSON.stringify(oldSchedule[i]) !== JSON.stringify(newSchedule[i])) {
      modifiedCount++;
    }
  }
  
  if (modifiedCount > 0) {
    changes.push(`${modifiedCount} segments modified`);
  }
  
  return changes.length > 0 ? changes.join(', ') : 'No significant changes';
}

module.exports = { enhanceSharedEventStructure };