// HIGH LOCKDOWN: Enterprise-grade version control with file locking
// Add to simple-server.js

let userRoles = new Map(); // userId -> role mapping
let fileLocks = new Map(); // eventId -> lock info
let pendingApprovals = new Map(); // approvalId -> approval data
let auditLog = []; // Complete audit trail

const ROLES = {
  ADMIN: 'admin',
  MODERATOR: 'moderator', 
  EDITOR: 'editor',
  VIEWER: 'viewer'
};

const enterpriseEventStructure = () => {
  Object.keys(sharedEvents).forEach(eventId => {
    if (!sharedEvents[eventId].enterpriseData) {
      sharedEvents[eventId] = {
        ...sharedEvents[eventId],
        enterpriseData: {
          version: 1,
          locked: false,
          lockedBy: null,
          lockExpiry: null,
          approvalRequired: true,
          lastApprovedVersion: 1,
          pendingChanges: null,
          auditTrail: [],
          permissions: {
            admins: ['admin'], // Default admin user
            moderators: [],
            editors: ['*'], // Everyone can edit by default
            viewers: ['*']
          }
        }
      };
    }
  });
};

// User authentication/role assignment
app.post('/api/auth/login', (req, res) => {
  const { username, role } = req.body;
  const userId = `user-${username}-${Date.now()}`;
  
  // In production, this would validate against a real auth system
  const assignedRole = role || ROLES.EDITOR;
  userRoles.set(userId, {
    username,
    role: assignedRole,
    loginTime: new Date().toISOString()
  });
  
  addAuditEntry('USER_LOGIN', userId, null, { username, role: assignedRole });
  
  res.json({
    success: true,
    userId,
    username,
    role: assignedRole,
    permissions: getRolePermissions(assignedRole)
  });
});

// Request edit lock
app.post('/api/events/:id/request-lock', (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  
  const user = userRoles.get(userId);
  if (!user || !hasPermission(user.role, 'edit')) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  
  const event = sharedEvents[id];
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }
  
  // Check if already locked
  const existingLock = fileLocks.get(id);
  if (existingLock && existingLock.expiry > Date.now()) {
    if (existingLock.userId === userId) {
      // User already has the lock, extend it
      existingLock.expiry = Date.now() + 15 * 60 * 1000; // 15 minutes
      return res.json({
        success: true,
        lockAcquired: true,
        lockExpiry: existingLock.expiry,
        message: 'Lock extended'
      });
    } else {
      return res.status(423).json({
        error: 'FILE_LOCKED',
        message: `File is locked by ${existingLock.username}`,
        lockedBy: existingLock.username,
        lockExpiry: existingLock.expiry
      });
    }
  }
  
  // Acquire lock
  const lockExpiry = Date.now() + 15 * 60 * 1000; // 15 minutes
  fileLocks.set(id, {
    userId,
    username: user.username,
    expiry: lockExpiry,
    acquiredAt: Date.now()
  });
  
  // Update event lock status
  event.enterpriseData.locked = true;
  event.enterpriseData.lockedBy = user.username;
  event.enterpriseData.lockExpiry = new Date(lockExpiry).toISOString();
  
  addAuditEntry('LOCK_ACQUIRED', userId, id, { username: user.username });
  
  res.json({
    success: true,
    lockAcquired: true,
    lockExpiry,
    message: `Lock acquired until ${new Date(lockExpiry).toLocaleTimeString()}`
  });
});

// Release edit lock
app.post('/api/events/:id/release-lock', (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  
  const lock = fileLocks.get(id);
  if (!lock || lock.userId !== userId) {
    return res.status(403).json({ error: 'You do not hold the lock for this file' });
  }
  
  fileLocks.delete(id);
  
  const event = sharedEvents[id];
  if (event) {
    event.enterpriseData.locked = false;
    event.enterpriseData.lockedBy = null;
    event.enterpriseData.lockExpiry = null;
  }
  
  const user = userRoles.get(userId);
  addAuditEntry('LOCK_RELEASED', userId, id, { username: user?.username });
  
  res.json({ success: true, message: 'Lock released' });
});

// Submit changes for approval
app.post('/api/events/:id/submit-for-approval', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, schedule, name, metadata, changeDescription } = req.body;
    
    const user = userRoles.get(userId);
    if (!user || !hasPermission(user.role, 'edit')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const lock = fileLocks.get(id);
    if (!lock || lock.userId !== userId) {
      return res.status(423).json({ error: 'You must hold the edit lock to submit changes' });
    }
    
    const event = sharedEvents[id];
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    const approvalId = `approval-${id}-${Date.now()}`;
    const submissionTime = new Date().toISOString();
    
    // Store pending changes
    pendingApprovals.set(approvalId, {
      id: approvalId,
      eventId: id,
      submittedBy: user.username,
      submittedAt: submissionTime,
      changeDescription: changeDescription || 'No description provided',
      proposedChanges: {
        schedule,
        name: name || event.name,
        metadata: metadata || event.metadata
      },
      currentVersion: event.enterpriseData.version,
      status: 'pending',
      reviews: []
    });
    
    // Update event with pending changes
    event.enterpriseData.pendingChanges = approvalId;
    
    addAuditEntry('APPROVAL_SUBMITTED', userId, id, {
      approvalId,
      changeDescription,
      username: user.username
    });
    
    // Release lock after submission
    fileLocks.delete(id);
    event.enterpriseData.locked = false;
    event.enterpriseData.lockedBy = null;
    event.enterpriseData.lockExpiry = null;
    
    res.json({
      success: true,
      approvalId,
      message: 'Changes submitted for approval',
      status: 'pending_approval'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit for approval' });
  }
});

// Approve/reject changes
app.post('/api/approvals/:approvalId/review', async (req, res) => {
  try {
    const { approvalId } = req.params;
    const { userId, action, reviewNotes } = req.body; // action: 'approve' | 'reject'
    
    const user = userRoles.get(userId);
    if (!user || !hasPermission(user.role, 'approve')) {
      return res.status(403).json({ error: 'Insufficient permissions to review changes' });
    }
    
    const approval = pendingApprovals.get(approvalId);
    if (!approval) {
      return res.status(404).json({ error: 'Approval request not found' });
    }
    
    if (approval.status !== 'pending') {
      return res.status(400).json({ error: 'Approval request already processed' });
    }
    
    const reviewTime = new Date().toISOString();
    approval.reviews.push({
      reviewedBy: user.username,
      reviewedAt: reviewTime,
      action,
      notes: reviewNotes || ''
    });
    
    if (action === 'approve') {
      // Apply the changes
      const event = sharedEvents[approval.eventId];
      if (event) {
        const newVersion = event.enterpriseData.version + 1;
        
        // Apply changes
        event.name = approval.proposedChanges.name;
        event.schedule = approval.proposedChanges.schedule;
        event.metadata = approval.proposedChanges.metadata;
        event.lastModifiedBy = approval.submittedBy;
        event.lastModifiedAt = reviewTime;
        
        // Update enterprise data
        event.enterpriseData.version = newVersion;
        event.enterpriseData.lastApprovedVersion = newVersion;
        event.enterpriseData.pendingChanges = null;
        
        // Add to audit trail
        event.enterpriseData.auditTrail.push({
          version: newVersion,
          approvedBy: user.username,
          approvedAt: reviewTime,
          submittedBy: approval.submittedBy,
          changeDescription: approval.changeDescription,
          approvalId
        });
        
        approval.status = 'approved';
        await saveToStorage();
        
        addAuditEntry('CHANGES_APPROVED', userId, approval.eventId, {
          approvalId,
          newVersion,
          submittedBy: approval.submittedBy,
          approvedBy: user.username
        });
        
        res.json({
          success: true,
          message: `Changes approved and applied as version ${newVersion}`,
          newVersion
        });
      }
    } else {
      // Reject changes
      approval.status = 'rejected';
      
      const event = sharedEvents[approval.eventId];
      if (event) {
        event.enterpriseData.pendingChanges = null;
      }
      
      addAuditEntry('CHANGES_REJECTED', userId, approval.eventId, {
        approvalId,
        submittedBy: approval.submittedBy,
        rejectedBy: user.username,
        reviewNotes
      });
      
      res.json({
        success: true,
        message: 'Changes rejected',
        status: 'rejected'
      });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to process review' });
  }
});

// Get pending approvals
app.get('/api/approvals/pending', (req, res) => {
  const { userId } = req.query;
  
  const user = userRoles.get(userId);
  if (!user || !hasPermission(user.role, 'approve')) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  
  const pending = Array.from(pendingApprovals.values())
    .filter(approval => approval.status === 'pending')
    .map(approval => ({
      id: approval.id,
      eventId: approval.eventId,
      eventName: sharedEvents[approval.eventId]?.name || 'Unknown',
      submittedBy: approval.submittedBy,
      submittedAt: approval.submittedAt,
      changeDescription: approval.changeDescription,
      currentVersion: approval.currentVersion
    }));
  
  res.json(pending);
});

// Get audit log
app.get('/api/audit', (req, res) => {
  const { userId, eventId, limit = 50 } = req.query;
  
  const user = userRoles.get(userId);
  if (!user || !hasPermission(user.role, 'audit')) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  
  let filteredLog = auditLog;
  if (eventId) {
    filteredLog = auditLog.filter(entry => entry.eventId === eventId);
  }
  
  res.json(filteredLog.slice(-limit).reverse());
});

function hasPermission(role, action) {
  const permissions = {
    [ROLES.ADMIN]: ['edit', 'approve', 'audit', 'manage_users'],
    [ROLES.MODERATOR]: ['edit', 'approve', 'audit'],
    [ROLES.EDITOR]: ['edit'],
    [ROLES.VIEWER]: []
  };
  
  return permissions[role]?.includes(action) || false;
}

function getRolePermissions(role) {
  return {
    canEdit: hasPermission(role, 'edit'),
    canApprove: hasPermission(role, 'approve'),
    canAudit: hasPermission(role, 'audit'),
    canManageUsers: hasPermission(role, 'manage_users')
  };
}

function addAuditEntry(action, userId, eventId, details) {
  const user = userRoles.get(userId);
  auditLog.push({
    id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    action,
    userId,
    username: user?.username || 'Unknown',
    eventId,
    details,
    ipAddress: '0.0.0.0' // In production, get from req.ip
  });
  
  // Keep only last 1000 audit entries
  if (auditLog.length > 1000) {
    auditLog = auditLog.slice(-1000);
  }
}

// Clean up expired locks (run periodically)
setInterval(() => {
  const now = Date.now();
  for (const [eventId, lock] of fileLocks.entries()) {
    if (lock.expiry < now) {
      fileLocks.delete(eventId);
      const event = sharedEvents[eventId];
      if (event) {
        event.enterpriseData.locked = false;
        event.enterpriseData.lockedBy = null;
        event.enterpriseData.lockExpiry = null;
      }
      addAuditEntry('LOCK_EXPIRED', lock.userId, eventId, { username: lock.username });
    }
  }
}, 60000); // Check every minute

module.exports = {
  enterpriseEventStructure,
  userRoles,
  fileLocks,
  pendingApprovals,
  auditLog,
  ROLES
};