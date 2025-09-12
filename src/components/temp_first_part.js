import React, { useState, useEffect, useRef } from 'react';
import './PresenterView.css'; // Import presenter view styles
import { parseExcelFile } from '../utils/excelParser.js'; // This path must be correct
import { parseScheduleFile, parseClipboardData } from '../utils/enhancedParser.js';
import DataPreviewModal from './DataPreviewModal.js';
import { QRCodeSVG } from 'qrcode.react';
import axios from 'axios';

// Helper for drag-and-drop
const reorder = (list, startIndex, endIndex) => {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
};

// *** REPLACED: This is the new, flexible recalculateTimes function ***
const recalculateTimes = (schedule, mode = 'cascade', editedIndex = null) => {
  if (!schedule || schedule.length === 0) return [];

  const toMinutes = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string') return null;
    let [time, modifier] = timeStr.split(' ');
    if (!time.includes(':')) return null;
    let [hours, minutes] = time.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return null;

    if (modifier) {
      if (modifier.toUpperCase() === 'PM' && hours !== 12) hours += 12;
      if (modifier.toUpperCase() === 'AM' && hours === 12) hours = 0;
    }
    return hours * 60 + minutes;
  };

  const toTimeStr = (mins) => {
    let hours = Math.floor(mins / 60);
    let minutes = mins % 60;
    let ampm = hours >= 12 ? 'PM' : 'AM';
    let displayHours = hours % 12;
    if (displayHours === 0) displayHours = 12;
    const result = `${displayHours}:${String(minutes).padStart(2, '0')} ${ampm}`;
    console.log(`toTimeStr(${mins}) -> hours: ${hours}, displayHours: ${displayHours}, minutes: ${minutes}, ampm: ${ampm}, result: ${result}`);
    return result;
  };

  // --- LOGIC FOR 'smart-edit' MODE (For intelligent time edits that preserve context) ---
  if (mode === 'smart-edit' && editedIndex !== null) {
    console.log('Smart-edit mode triggered:', { editedIndex, schedule });
    
    const result = [];
    
    for (let i = 0; i < schedule.length; i++) {
      const seg = schedule[i];
      const duration = parseInt(String(seg.duration).replace(/[^0-9]/g, ''), 10) || 0;
      
      if (i < editedIndex) {
        // Keep segments before the edited one unchanged
        console.log(`Segment ${i}: keeping unchanged`);
        result.push({ ...seg, duration: `${duration} min` });
      } else if (i === editedIndex) {
        // This is the edited segment - keep its new time and duration
        console.log(`Segment ${i}: edited segment, time: ${seg.time}`);
        result.push({ ...seg, duration: `${duration} min` });
      } else {
        // Recalculate segments after the edited one based on the PREVIOUS RESULT segment
        const prevSegment = result[i - 1]; // Use the previously processed segment from result
        const prevStartTime = toMinutes(prevSegment.time);
        const prevDuration = parseInt(String(prevSegment.duration).replace(/[^0-9]/g, ''), 10) || 0;
        const newStartTime = prevStartTime + prevDuration;
        const newTimeStr = toTimeStr(newStartTime);
        
        console.log(`Segment ${i}: recalculating from ${prevSegment.time} + ${prevDuration}min = ${newTimeStr}`);
        console.log(`  - prevStartTime (minutes): ${prevStartTime}`);
        console.log(`  - prevDuration: ${prevDuration}`);
        console.log(`  - newStartTime (minutes): ${newStartTime}`);
        console.log(`  - newTimeStr: ${newTimeStr}`);
        
        result.push({ ...seg, time: newTimeStr, duration: `${duration} min` });
      }
    }
    
    return result;
  }

  // --- LOGIC FOR 'cascade' MODE (Your existing, preferred logic for edits) ---
  if (mode === 'cascade') {
    let actualStartTime = null;
    if (schedule.length > 0 && schedule[0].time && toMinutes(schedule[0].time) !== null) {
      actualStartTime = schedule[0].time;
    } else {
      actualStartTime = '09:00 AM'; // Fallback
    }

    let currentTimeInMinutes = toMinutes(actualStartTime);
    return schedule.map(seg => {
      const startTime = toTimeStr(currentTimeInMinutes);
      const duration = parseInt(String(seg.duration).replace(/[^0-9]/g, ''), 10) || 0;
      currentTimeInMinutes += duration; // Add duration for the next segment
      return { ...seg, time: startTime, duration: `${duration} min` };
    });
  }

  // --- LOGIC FOR 'preserve' MODE (Smarter logic for initial file upload) ---
  if (mode === 'preserve') {
    let lastKnownTimeInMinutes = null;
    
    const firstValidTime = toMinutes(schedule.find(seg => toMinutes(seg.time) !== null)?.time);
    lastKnownTimeInMinutes = firstValidTime !== null ? firstValidTime : toMinutes('09:00 AM');

    return schedule.map(seg => {
      const segmentTimeInMinutes = toMinutes(seg.time);
      let currentStartTimeInMinutes;

      if (segmentTimeInMinutes !== null) {
        currentStartTimeInMinutes = segmentTimeInMinutes;
      } else {
        currentStartTimeInMinutes = lastKnownTimeInMinutes;
      }
      
      const newSeg = { ...seg, time: toTimeStr(currentStartTimeInMinutes) };
      const duration = parseInt(String(newSeg.duration).replace(/[^0-9]/g, ''), 10) || 0;
      newSeg.duration = `${duration} min`;
      
      lastKnownTimeInMinutes = currentStartTimeInMinutes + duration;
      return newSeg;
    });
  }

  // Failsafe
  return schedule;
};


const AI_SYSTEM_PROMPT = `You are Show Flow Agent, an AI event schedule assistant. You help users upload, edit, and manage event schedules, with dynamic time recalculation, inline editing, drag-and-drop reordering, and more. You can only make changes to the schedule as allowed by the user. If a user asks for something outside your scope, politely decline.`;

// Mobile nav and FAB helpers
const isMobile = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 768px)').matches;

class MobileErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    // Optionally log error
    if (window && window.console) {
      console.error('MobileErrorBoundary caught:', error, info);
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: 'red', padding: 24, background: '#fffbe6', fontSize: 18 }}>
          <strong>Mobile Render Error:</strong>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{String(this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const ShowFlowAgent = () => {
  // Placeholder state for schedule and alerts
  const [schedule, setSchedule] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState([]);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [title, setTitle] = useState(''); // Event title state

  // Inline editing state
  const [editIdx, setEditIdx] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [originalEditValues, setOriginalEditValues] = useState({}); // Track original values to detect what changed

  // Undo/Redo state
  const [history, setHistory] = useState([]); // stack of previous schedules
  const [future, setFuture] = useState([]);   // stack of undone schedules

  const alertTimeouts = useRef([]);
  const toastTimeout = useRef(null);

  // New state for feedback, theme, and accessibility
  const [feedback, setFeedback] = useState({}); // { index: "feedback text" }
  const [theme, setTheme] = useState('light');
  const [fontSize, setFontSize] = useState(1);
  const [highContrast, setHighContrast] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [now, setNow] = useState(new Date());
  const [currentIdx, setCurrentIdx] = useState(null);
  const [overrunIdx, setOverrunIdx] = useState(null);

  // New state for alert selection
  const [alertSegments, setAlertSegments] = useState([]); // array of indices
  // New state for expanded notes
  const [expandedNotesIdx, setExpandedNotesIdx] = useState(null);
  // Enhanced parser preview modal state
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  // New: Collapse/expand all notes
  const [allNotesExpanded, setAllNotesExpanded] = useState(false);
  // New: Keyboard shortcuts help modal
  const [showShortcuts, setShowShortcuts] = useState(false);
  // New: Debug/settings pane visibility
  const [showDebug, setShowDebug] = useState(false);
  
  // New: Presenter View toggle
  const [presenterViewMode, setPresenterViewMode] = useState(false);
  const [showMobileEdit, setShowMobileEdit] = useState(false);

  // Debug: set now to a custom date/time
  const [debugNow, setDebugNow] = useState(null);

  // New: Shared event functionality
  const [sharedEvents, setSharedEvents] = useState([]);
  const [currentSharedEventId, setCurrentSharedEventId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // 'connected', 'loading', 'error', 'disconnected'
  
  // Enhanced version control state
  const [userSessionId, setUserSessionId] = useState(null);
  const [activeUsers, setActiveUsers] = useState([]);
  const [conflictInfo, setConflictInfo] = useState(null);
  const [lastModified, setLastModified] = useState(null);
  const [versionInfo, setVersionInfo] = useState(null);

  // API Base URL - in production this would be your Azure Web App URL
  const API_BASE_URL = process.env.NODE_ENV === 'production' 
    ? window.location.origin  // Use same domain in production
    : 'http://localhost:5001'; // Local development

  // Initialize user session when component mounts
  const initializeUserSession = async () => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/start-session`);
      setUserSessionId(response.data.sessionId);
      console.log('User session initialized:', response.data.sessionId);
    } catch (error) {
      console.error('Failed to initialize user session:', error);
    }
  };

  // End user session when component unmounts
  const endUserSession = async () => {
    if (userSessionId) {
      try {
        await axios.post(`${API_BASE_URL}/api/end-session`, { sessionId: userSessionId });
        console.log('User session ended:', userSessionId);
      } catch (error) {
        console.error('Failed to end user session:', error);
      }
    }
  };

  // Get active users for current event
  const getActiveUsers = async () => {
    if (!currentSharedEventId) return;
    try {
      const response = await axios.get(`${API_BASE_URL}/api/active-users/${currentSharedEventId}`);
      setActiveUsers(response.data.activeUsers || []);
    } catch (error) {
      console.error('Failed to get active users:', error);
    }
  };

  // Check for version conflicts
  const checkVersionConflicts = async (eventId) => {
    if (!lastModified) return false;
    try {
      const response = await axios.post(`${API_BASE_URL}/api/check-conflicts`, {
        eventId,
        clientLastModified: lastModified
      });
      return response.data;
    } catch (error) {
      console.error('Failed to check version conflicts:', error);
      return { hasConflict: false };
    }
  };

  // Restore original version of an event
  const restoreOriginalVersion = async (eventId) => {
    if (!confirm('Are you sure you want to restore the original version? This will overwrite all current changes.')) {
      return;
    }
    
    try {
      setIsLoading(true);
      const response = await axios.post(`${API_BASE_URL}/api/restore-original/${eventId}`);
      
      // Reload the event to show the restored version
      await loadSharedEvent(eventId);
      
      setSummary(prev => [...prev, `Restored original version of '${eventId}'`]);
      alert('Original version has been restored successfully!');
    } catch (error) {
      console.error('Failed to restore original version:', error);
      setSummary(prev => [...prev, `Error restoring original version: ${error.message}`]);
      alert(`Error restoring original version: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle version conflict resolution
  const handleVersionConflict = async (eventId, action) => {
    try {
      setIsLoading(true);
      
      if (action === 'force-save') {
        // User chose to overwrite changes
        const eventData = {
          name: eventId,
          schedule: schedule,
          metadata: {
            title: title || eventId,
            lastModified: new Date().toISOString(),
            sessionId: userSessionId
          }
        };
        
        await axios.post(`${API_BASE_URL}/api/events/${eventId}`, eventData);
        setConflictInfo(null);
        setSummary(prev => [...prev, `Force-saved changes to '${eventId}' (overrode conflicting changes)`]);
        
      } else if (action === 'reload') {
        // User chose to reload and lose their changes
        await loadSharedEvent(eventId);
        setConflictInfo(null);
        setSummary(prev => [...prev, `Reloaded '${eventId}' from server (local changes discarded)`]);
      }
      
    } catch (error) {
      console.error('Failed to resolve version conflict:', error);
      setSummary(prev => [...prev, `Error resolving conflict: ${error.message}`]);
    } finally {
      setIsLoading(false);
    }
  };

  // Load shared events from backend
  const loadSharedEvents = async () => {
    try {
      setIsLoading(true);
      setConnectionStatus('loading');
      const response = await axios.get(`${API_BASE_URL}/api/events`);
      setSharedEvents(response.data);
      setConnectionStatus('connected');
    } catch (error) {
      console.error('Failed to load shared events:', error);
      setConnectionStatus('error');
      setSummary(prev => [...prev, `Error loading shared events: ${error.message}`]);
    } finally {
      setIsLoading(false);
    }
  };

  // Save current schedule as shared event
  const saveAsSharedEvent = async (eventName) => {
    if (!eventName || !eventName.trim()) {
      alert('Please provide a name for the shared event');
      return;
    }

    try {
      setIsLoading(true);
      console.log('Saving shared event:', eventName);
      console.log('API_BASE_URL:', API_BASE_URL);
      console.log('Current schedule:', schedule);
      
      const eventData = {
        name: eventName.trim(),
        schedule: schedule,
        metadata: {
          title: title || eventName.trim(),
          createdBy: userSessionId || 'Anonymous',
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          sessionId: userSessionId
        }
      };

      console.log('Event data to save:', eventData);
      const response = await axios.post(`${API_BASE_URL}/api/events/${eventName.trim()}`, eventData);
      console.log('Save response:', response);
      
      // Update local state with new timestamp
      setLastModified(eventData.metadata.lastModified);
      
      // Refresh shared events list
      await loadSharedEvents();
      
      setCurrentSharedEventId(eventName.trim());
      setSummary(prev => [...prev, `Shared event '${eventName}' saved successfully`]);
      alert(`Shared event '${eventName}' saved successfully!`);
    } catch (error) {
      console.error('Failed to save shared event:', error);
      console.error('Error details:', error.response || error);
      setSummary(prev => [...prev, `Error saving shared event: ${error.message}`]);
      alert(`Error saving shared event: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Load a shared event
  const loadSharedEvent = async (eventId) => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/events`);
      const events = response.data;
      const selectedEvent = events.find(event => event.id === eventId);
      
      if (selectedEvent) {
        // Push current state to history before loading
        pushHistory(schedule);
        
        // Load the shared event data
        setSchedule(selectedEvent.schedule || []);
        setTitle(selectedEvent.metadata?.title || selectedEvent.name);
        setCurrentSharedEventId(eventId);
        setLastModified(selectedEvent.metadata?.lastModified);
        setVersionInfo(selectedEvent.versionControl);
        
        // Get active users for this event
        await getActiveUsers();
        
        setSummary(prev => [...prev, `Loaded shared event '${selectedEvent.name}'`]);
      } else {
        throw new Error('Event not found');
      }
    } catch (error) {
      console.error('Failed to load shared event:', error);
      setSummary(prev => [...prev, `Error loading shared event: ${error.message}`]);
    } finally {
      setIsLoading(false);
    }
  };

  // Update current shared event (if one is loaded)
  const updateSharedEvent = async () => {
    if (!currentSharedEventId) {
      // Save as new shared event
      const eventName = prompt('Enter name for new shared event:');
      if (eventName) {
        await saveAsSharedEvent(eventName);
      }
      return;
    }

    try {
      setIsLoading(true);
      
      // Check for version conflicts first
      const conflictCheck = await checkVersionConflicts(currentSharedEventId);
      
      if (conflictCheck.hasConflict) {
        setConflictInfo({
          eventId: currentSharedEventId,
          serverLastModified: conflictCheck.serverLastModified,
          clientLastModified: lastModified
        });
        setIsLoading(false);
        return; // Don't save, let user resolve conflict
      }
      
      const eventData = {
        name: currentSharedEventId,
        schedule: schedule,
        metadata: {
          title: title || currentSharedEventId,
          lastModified: new Date().toISOString(),
          sessionId: userSessionId
        }
      };

      await axios.post(`${API_BASE_URL}/api/events/${currentSharedEventId}`, eventData);
      
      // Update local timestamp
      setLastModified(eventData.metadata.lastModified);
      
      setSummary(prev => [...prev, `Updated shared event '${currentSharedEventId}'`]);
    } catch (error) {
      console.error('Failed to update shared event:', error);
      setSummary(prev => [...prev, `Error updating shared event: ${error.message}`]);
    } finally {
      setIsLoading(false);
    }
  };

  // Delete a shared event
  const deleteSharedEvent = async (eventId) => {
    if (!confirm(`Are you sure you want to delete shared event '${eventId}'? This action cannot be undone.`)) {
      return;
    }

    try {
      setIsLoading(true);
      
      // Try regular delete first (soft delete)
      try {
        await axios.delete(`${API_BASE_URL}/api/events/${eventId}`);
      } catch (error) {
        if (error.response?.status === 403) {
          // Need admin permission for true delete
          const adminPassword = prompt('This event is protected. Enter admin password for permanent deletion:');
          if (!adminPassword) {
            setIsLoading(false);
            return;
          }
          
          await axios.delete(`${API_BASE_URL}/api/admin/events/${eventId}`, {
            headers: {
              'Admin-Password': adminPassword
            }
          });
        } else {
          throw error;
        }
      }
      
      // Refresh shared events list
      await loadSharedEvents();
      
      // Clear current shared event if it was deleted
      if (currentSharedEventId === eventId) {
        setCurrentSharedEventId(null);
        setLastModified(null);
        setVersionInfo(null);
      }
      
      setSummary(prev => [...prev, `Deleted shared event '${eventId}'`]);
    } catch (error) {
      console.error('Failed to delete shared event:', error);
      setSummary(prev => [...prev, `Error deleting shared event: ${error.message}`]);
      if (error.response?.status === 401) {
        alert('Invalid admin password. Delete operation cancelled.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Load shared events on component mount and manage session
  useEffect(() => {
    // Initialize user session
    initializeUserSession();
    
    // Load shared events
    loadSharedEvents();
    
    // Set up periodic refresh for real-time collaboration
    const interval = setInterval(() => {
      if (connectionStatus === 'connected') {
        loadSharedEvents();
        if (currentSharedEventId) {
          getActiveUsers();
        }
      }
    }, 30000); // Refresh every 30 seconds
    
    // Clean up session on unmount
    return () => {
      clearInterval(interval);
      endUserSession();
    };
  }, []);

  // Update active users when current shared event changes
  useEffect(() => {
    if (currentSharedEventId && connectionStatus === 'connected') {
      getActiveUsers();
    }
  }, [currentSharedEventId, connectionStatus]);

  const handleDebugNow = () => {
    const input = prompt('Enter a time (e.g., 10:05 AM):', '10:05 AM');
    if (!input) return;
    const [time, modifier] = input.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    let nowDate = new Date();
    if (modifier && modifier.toUpperCase() === 'PM' && hours !== 12) hours += 12;
    if (modifier && modifier.toUpperCase() === 'AM' && hours === 12) hours = 0;
    nowDate.setHours(hours);
    nowDate.setMinutes(minutes);
    nowDate.setSeconds(0);
    nowDate.setMilliseconds(0);
    setDebugNow(nowDate);
    setNow(nowDate);
  };
  const handleResetDebugNow = () => {
    setDebugNow(null);
    setNow(new Date());
  };

  // Helper to push current schedule to history before change
  const pushHistory = (prevSchedule) => {
    setHistory(h => [...h, prevSchedule]);
    setFuture([]); // clear redo stack on new action
  };

  // Handlers for drag-and-drop
  const handleDragStart = (index) => setDraggedIndex(index);
  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (index) => {
    if (draggedIndex === null || draggedIndex === index) return;
    pushHistory(schedule);
    const newOrder = reorder(schedule, draggedIndex, index);
    const recalculated = recalculateTimes(newOrder);
    setSchedule(recalculated);
    setDraggedIndex(null);
    setSummary((prev) => [
      ...prev,
      `Reordered segment '${schedule[draggedIndex]?.segment || ''}' to position ${index + 1} and recalculated times.`
    ]);
  };

  // Add segment at index
  const handleAddSegment = (index) => {
    pushHistory(schedule);
    const newSegment = {
      time: '',
      duration: '0',
      segment: 'New Segment',
      presenter: '',
      notes: ''
    };
    const newSchedule = [...schedule];
    newSchedule.splice(index, 0, newSegment);
    const recalculated = recalculateTimes(newSchedule);
    setSchedule(recalculated);
    setSummary((prev) => [
      ...prev,
      `Added new segment at position ${index + 1} and recalculated times.`
    ]);
  };

  // Remove segment at index
  const handleRemoveSegment = (index) => {
    pushHistory(schedule);
    const removed = schedule[index];
    const newSchedule = schedule.filter((_, i) => i !== index);
    const recalculated = recalculateTimes(newSchedule);
    setSchedule(recalculated);
    setSummary((prev) => [
      ...prev,
      `Removed segment '${removed?.segment || ''}' at position ${index + 1} and recalculated times.`
    ]);
  };
  // Enhanced parse schedule from textarea with preview
  const handleParseSchedule = () => {
    if (!inputValue.trim()) return;
    
    try {
      // Use enhanced clipboard parser
      const parseResult = parseClipboardData(inputValue);
      
      // Show preview modal
      setPreviewData(parseResult);
      setShowPreviewModal(true);
      
    } catch (err) {
      // Fallback to old parser for compatibility
      handleParseScheduleFallback();
    }
  };

  // Fallback parser (original logic)
  const handleParseScheduleFallback = () => {
    pushHistory(schedule);
    // Split lines, trim, and filter out empty
    const lines = inputValue.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    // Detect delimiter (tab, comma, or multiple spaces)
    const delimiter = lines[0].includes('\t') ? '\t' : (lines[0].includes(',') ? ',' : /\s{2,}/.test(lines[0]) ? /\s{2,}/ : '\t');
    // Parse header row
    let headerLine = lines[0];
    let headers = headerLine.split(delimiter).map(h => h.trim().toLowerCase());
    // Map header names to field keys
    const colMap = {};
    headers.forEach((h, idx) => {
      if (h.includes('time')) colMap.time = idx;
      else if (h.includes('duration')) colMap.duration = idx;
      else if (h.includes('segment')) colMap.segment = idx;
      else if (h.includes('presenter') || h.includes('facilitator') || h.includes('speaker') || h.includes('host')) colMap.presenter = idx;
      else if (h.includes('note') || h.includes('feedback')) colMap.notes = idx;
    });
    // Parse data rows
    const parsed = lines.slice(1).map(line => {
      const cells = typeof delimiter === 'string' ? line.split(delimiter) : line.split(delimiter);
      return {
        time: cells[colMap.time] ? cells[colMap.time].trim() : '',
        duration: cells[colMap.duration] ? cells[colMap.duration].trim() : '',
        segment: cells[colMap.segment] ? cells[colMap.segment].trim() : '',
        presenter: cells[colMap.presenter] ? cells[colMap.presenter].trim() : '',
        notes: cells[colMap.notes] ? cells[colMap.notes].trim() : ''
      };
    });
    const recalculated = recalculateTimes(parsed);
    setSchedule(recalculated);
    setSummary((prev) => [...prev, 'Parsed schedule from input and recalculated times.']);
  };
  // Simplified file upload handler for CSV only
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('Please select a CSV file (.csv)');
      return;
    }
    
    try {
      const text = await file.text();
      const parseResult = parseCSVContent(text, file.name);
      
      // Show preview modal
      setPreviewData(parseResult);
      setShowPreviewModal(true);
      
    } catch (err) {
      alert(`Failed to parse CSV file: ${err.message}`);
    }
  };

  // Simple CSV parser function
  const parseCSVContent = (csvText, fileName) => {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSV file must have at least a header row and one data row');
    }
    
    // Parse header
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
    
    // Map headers to field names
    const fieldMap = {};
    headers.forEach((header, index) => {
      if (header.includes('time') || header.includes('start')) fieldMap.time = index;
      else if (header.includes('duration')) fieldMap.duration = index;
      else if (header.includes('segment') || header.includes('session') || header.includes('title')) fieldMap.segment = index;
      else if (header.includes('presenter') || header.includes('speaker') || header.includes('facilitator')) fieldMap.presenter = index;
      else if (header.includes('note')) fieldMap.notes = index;
    });
    
    // Parse data rows
    const data = lines.slice(1).map(line => {
      const cells = line.split(',').map(cell => cell.replace(/^"|"$/g, '').trim());
      return {
        time: fieldMap.time !== undefined ? cells[fieldMap.time] || '' : '',
        duration: fieldMap.duration !== undefined ? cells[fieldMap.duration] || '' : '',
        segment: fieldMap.segment !== undefined ? cells[fieldMap.segment] || '' : '',
        presenter: fieldMap.presenter !== undefined ? cells[fieldMap.presenter] || '' : '',
        notes: fieldMap.notes !== undefined ? cells[fieldMap.notes] || '' : ''
      };
    });
    
    return {
      data: data,
      metadata: {
        fileName: fileName,
        format: 'CSV',
        rowCount: data.length
      }
    };
  };

  // Handle accepting data from preview modal
  const handleAcceptPreview = (data) => {
    pushHistory(schedule);
    
    // Apply default duration if missing
    const withDefaults = data.map(seg => ({
      ...seg,
      duration: seg.duration || '30',
    }));

    // Use preserve mode for initial upload
    const recalculated = recalculateTimes(withDefaults, 'preserve');
    
    setSchedule(recalculated);
    setSummary((prev) => [...prev, `Loaded schedule from ${previewData.metadata.fileName} with ${data.length} segments.`]);
    
    // Close modal
    setShowPreviewModal(false);
    setPreviewData(null);
  };

  // Handle rejecting data from preview modal
  const handleRejectPreview = () => {
    setShowPreviewModal(false);
    setPreviewData(null);
  };

  // Start editing a row
  const handleEdit = (idx) => {
    setEditIdx(idx);
    setEditValues({ ...schedule[idx] }); // Create a copy
    setOriginalEditValues({ ...schedule[idx] }); // Store original values for comparison with a separate copy
  };

  // Save edits
  const handleSaveEdit = (idx) => {
    pushHistory(schedule);
    const updated = schedule.map((seg, i) => i === idx ? { ...editValues } : seg);
    
    // Determine if the time field was edited
    const timeWasEdited = originalEditValues.time !== editValues.time;
    
    // Debug logging
    console.log('Save Edit Debug:', {
      idx,
      originalTime: originalEditValues.time,
      newTime: editValues.time,
      timeWasEdited,
      editValues,
      originalEditValues
    });
    
    // Use smart-edit mode if time was changed, otherwise use cascade mode
    const recalculated = timeWasEdited 
      ? recalculateTimes(updated, 'smart-edit', idx)
      : recalculateTimes(updated, 'cascade');
    
    console.log('Recalculation result:', { mode: timeWasEdited ? 'smart-edit' : 'cascade', recalculated });
    
    setSchedule(recalculated);
    setEditIdx(null);
    setEditValues({});
    setOriginalEditValues({});
    
    const action = timeWasEdited 
      ? `Edited start time for '${editValues.segment}' and updated subsequent segments`
      : `Edited segment '${editValues.segment}' at position ${idx + 1} and recalculated times`;
    
    setSummary((prev) => [
      ...prev,
      action
    ]);
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditIdx(null);
    setEditValues({});
    setOriginalEditValues({});
  };

  // Handle inline field change
  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditValues(prev => ({ ...prev, [name]: value }));
  };

  // Undo handler
  const handleUndo = () => {
    if (history.length === 0) return;
    setFuture(f => [schedule, ...f]);
    const prev = history[history.length - 1];
    setSchedule(prev);
    setHistory(h => h.slice(0, h.length - 1));
    setSummary((prevSummary) => [...prevSummary, 'Undid last change.']);
  };

  // Redo handler
  const handleRedo = () => {
    if (future.length === 0) return;
    setHistory(h => [...h, schedule]);
    const next = future[0];
    setSchedule(next);
    setFuture(f => f.slice(1));
    setSummary((prevSummary) => [...prevSummary, 'Redid change.']);
  };

  // Helper: parse 'HH:MM AM/PM' to Date object for today or a given base date
  const getSegmentDate = (timeStr, baseDate = null, rollToTomorrow = false) => {
    const ref = baseDate instanceof Date ? new Date(baseDate) : new Date();
    let [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (modifier) {
      if (modifier.toUpperCase() === 'PM' && hours !== 12) hours += 12;
      if (modifier.toUpperCase() === 'AM' && hours === 12) hours = 0;
    }
    ref.setHours(hours);
    ref.setMinutes(minutes);
    ref.setSeconds(0);
    ref.setMilliseconds(0);
    // Only roll to tomorrow if requested (for alert scheduling)
    if (rollToTomorrow && ref < new Date()) ref.setDate(ref.getDate() + 1);
    return ref;
  };

  // Clear all scheduled alerts
  const clearScheduledAlerts = () => {
    alertTimeouts.current.forEach(timeoutId => clearTimeout(timeoutId));
    alertTimeouts.current = [];
  };

  // Toggle alert for a segment (auto-schedule notification)
  const toggleAlertSegment = (idx) => {
    setAlertSegments(prev => {
      let updated;
      if (prev.includes(idx)) {
        updated = prev.filter(i => i !== idx);
      } else {
        updated = [...prev, idx];
      }
      // Immediately update alerts for the new selection
      scheduleAlertsForSegments(updated);
      return updated;
    });
  };

  // Helper to schedule notifications for selected segments
  const scheduleAlertsForSegments = (segmentIndices) => {
    clearScheduledAlerts();
    if (!('Notification' in window)) {
      setAlerts(['This browser does not support desktop notifications.']);
      return;
    }
    if (Notification.permission !== 'granted') {
      Notification.requestPermission().then(perm => {
        if (perm !== 'granted') {
          setAlerts(['Notification permission denied.']);
          return;
        }
        actuallySchedule(segmentIndices);
      });
    } else {
      actuallySchedule(segmentIndices);
    }
  };

  // Toast notification state
  const [toast, setToast] = useState({ show: false, message: '' });
  // Audio ref for alert sound
  const alertAudioRef = useRef(null);

  // Toast helpers
  const showToast = (message) => {
    setToast({ show: true, message });
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setToast({ show: false, message: '' }), 4000);
  };

  // Play alert sound
  const playAlertSound = () => {
    if (alertAudioRef.current) {
      alertAudioRef.current.currentTime = 0;
      alertAudioRef.current.play();
    }
  };

  // Actually schedule the notifications
  const actuallySchedule = (segmentIndices) => {
    const now = new Date();
    let count = 0;
    segmentIndices.forEach(i => {
      const seg = schedule[i];
      if (!seg || !seg.time) return;
      const segDate = getSegmentDate(seg.time);
      const msUntil = segDate - now;
      if (msUntil > 0) {
        const timeoutId = setTimeout(() => {
          // In-app toast/banner
          showToast(`Segment: ${seg.segment || 'Untitled'} starts now!${seg.presenter ? ' Presenter: ' + seg.presenter : ''}`);
          playAlertSound();
          // Desktop notification (if supported)
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`Segment: ${seg.segment || 'Untitled'}`, {
              body: `Starts at ${seg.time}${seg.presenter ? ' | Presenter: ' + seg.presenter : ''}`,
              icon: 'styles/logo-mcaps.png',
            });
          }
        }, msUntil);
        alertTimeouts.current.push(timeoutId);
        count++;
      }
    });
    setAlerts([`Scheduled ${count} alert(s) for selected segments.`]);
  };

  // Accessibility: font size and contrast
  useEffect(() => {
    document.body.style.fontSize = fontSize + 'em';
    document.body.style.background = highContrast ? '#000' : '';
    document.body.style.color = highContrast ? '#fff' : '';
  }, [fontSize, highContrast]);

  // Live event progress and overrun detection
  useEffect(() => {
    if (!schedule.length) return;
    let interval;
    if (!debugNow) {
      interval = setInterval(() => {
        setNow(new Date());
      }, 10000);
    }
    // Always recalculate currentIdx and overrunIdx when 'now', 'schedule', or 'debugNow' changes
    const nowToUse = debugNow || now;
    let found = false;
    let overrun = null;
    schedule.forEach((seg, i) => {
      if (!seg.time) return;
      const segDate = getSegmentDate(seg.time, nowToUse);
      const nextSeg = schedule[i + 1];
      const nextDate = nextSeg && nextSeg.time ? getSegmentDate(nextSeg.time, nowToUse) : null;
      if (!found && segDate <= nowToUse && (!nextDate || nowToUse < nextDate)) {
        setCurrentIdx(i);
        found = true;
      }
      // Overrun: if now > next segment's start
      if (nextDate && nowToUse > nextDate && i === currentIdx) {
        overrun = i;
      }
    });
    setOverrunIdx(overrun);
    return () => interval && clearInterval(interval);
  }, [schedule, now, debugNow]);

  // Theme toggles (light/dark only, with Microsoft as base theme)
  const toggleTheme = () => {
    setTheme(t => (t === 'light' ? 'dark' : 'light'));
    // Update body class for CSS targeting
    document.body.classList.toggle('dark', theme === 'light');
  };

  // QR code and sharing
  const handleShowQR = () => setShowQR(q => !q);
  const handleShare = () => {
    const url = window.location.href;
    setShareLink(url);
    navigator.clipboard.writeText(url);
    alert('Schedule link copied to clipboard!');
  };

  // Print/export
  const handlePrint = () => window.print();

  // Duplicate segment at index
  const handleDuplicateSegment = (index) => {
    pushHistory(schedule);
    const segToCopy = schedule[index];
    const newSeg = { ...segToCopy };
    const newSchedule = [...schedule];
    newSchedule.splice(index + 1, 0, newSeg);
    const recalculated = recalculateTimes(newSchedule);
    setSchedule(recalculated);
    setSummary((prev) => [
      ...prev,
      `Duplicated segment '${segToCopy.segment}' at position ${index + 2} and recalculated times.`
    ]);
  };

  // Check if any segments have notes
  const hasNotesInSchedule = () => {
    return schedule.some(seg => seg.notes && seg.notes.trim().length > 0);
  };

  // Collapse/expand all notes
  const handleToggleAllNotes = () => {
    setAllNotesExpanded(expanded => !expanded);
    setExpandedNotesIdx(expandedNotesIdx => allNotesExpanded ? null : 'all');
  };

  // Export to CSV only
  const handleExportSchedule = () => {
    // Create CSV content manually (no dependencies needed)
    const headers = ['Time', 'Duration', 'Segment', 'Presenter', 'Notes'];
    const csvContent = [
      headers.join(','),
      ...schedule.map(seg => [
        `"${seg.time || ''}"`,
        `"${seg.duration || ''}"`,
        `"${seg.segment || ''}"`,
        `"${seg.presenter || ''}"`,
        `"${(seg.notes || '').replace(/"/g, '""')}"` // Escape quotes in notes
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'showflow-schedule.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Show event selector with radio buttons
  const showEventSelector = () => {
    if (sharedEvents.length === 0) {
      alert('No saved events available. Create one in Edit Mode first.');
      return;
    }

    // Create a modal-like dialog content
    const eventOptions = sharedEvents.map((event, index) => 
      `<label style="display: block; margin: 8px 0; padding: 12px; background: #f8f9fa; border-radius: 4px; cursor: pointer;">
        <input type="radio" name="eventChoice" value="${index}" style="margin-right: 8px;"> 
        <strong>${event.name}</strong>
        ${event.metadata ? `<br><small>Created: ${new Date(event.metadata.createdAt).toLocaleDateString()}</small>` : ''}
      </label>`
    ).join('');

    const dialogHTML = `
      <div style="font-family: system-ui; max-width: 400px;">
        <h3 style="margin-top: 0;">Select Event</h3>
        <form id="eventForm">
          ${eventOptions}
          <div style="margin: 16px 0; padding: 12px; background: #fff3cd; border-radius: 4px;">
            <label style="display: block; cursor: pointer;">
              <input type="radio" name="eventChoice" value="reset" style="margin-right: 8px;"> 
              <strong>🗑️ Reset All (Clear Current Event)</strong>
            </label>
          </div>
          <div style="margin-top: 16px; text-align: right;">
            <button type="button" onclick="document.getElementById('eventDialog').style.display='none'" 
                    style="margin-right: 8px; padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">
              Cancel
            </button>
            <button type="submit" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
              Select
            </button>
          </div>
        </form>
      </div>
    `;

    // Create and show dialog
    const dialog = document.createElement('div');
    dialog.id = 'eventDialog';
    dialog.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
      background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; 
      z-index: 2000; padding: 20px; box-sizing: border-box;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
      background: white; padding: 24px; border-radius: 8px; 
      box-shadow: 0 4px 20px rgba(0,0,0,0.3); max-height: 80vh; overflow-y: auto;
    `;
    content.innerHTML = dialogHTML;
    
    dialog.appendChild(content);
    document.body.appendChild(dialog);

    // Handle form submission
    document.getElementById('eventForm').onsubmit = (e) => {
      e.preventDefault();
      const selected = document.querySelector('input[name="eventChoice"]:checked');
      if (selected) {
        if (selected.value === 'reset') {
          // Reset all - clear current event
          setCurrentSharedEventId(null);
          setSchedule([]);
          setSummary([]);
          setCurrentIdx(null);
          pushHistory([]);
        } else {
          const index = parseInt(selected.value);
          loadSharedEvent(sharedEvents[index].id);
        }
      }
      document.body.removeChild(dialog);
    };

    // Close on background click
    dialog.onclick = (e) => {
      if (e.target === dialog) {
        document.body.removeChild(dialog);
      }
    };
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); handleUndo(); }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); handleRedo(); }
      if (e.key === 'a' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault(); handleAddSegment(schedule.length);
      }
      if (e.key === '?') { e.preventDefault(); setShowShortcuts(true); }
      if (e.key === 'F3') { e.preventDefault(); togglePresenterView(); } // F3 for Presenter View toggle
      if (e.ctrlKey && e.shiftKey && e.key === 'D') { e.preventDefault(); setShowDebug(prev => !prev); } // Hidden debug toggle
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [schedule, handleUndo, handleRedo, handleAddSegment]);

  // Session timer for current segment
  const [segmentTimer, setSegmentTimer] = useState(0);
  useEffect(() => {
    if (currentIdx === null || !schedule[currentIdx]) return;
    const seg = schedule[currentIdx];
    const segDate = getSegmentDate(seg.time);
    let duration = parseInt(seg.duration, 10) || 0;
    const endDate = new Date(segDate.getTime() + duration * 60000);
    const updateTimer = () => {
      const nowTime = new Date();
      const msLeft = endDate - nowTime;
      setSegmentTimer(Math.max(0, Math.floor(msLeft / 1000)));
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [currentIdx, schedule]);

  // Restore schedule from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('showflow-schedule');
    if (saved) {
      try {
        setSchedule(JSON.parse(saved));
      } catch (e) {
        // Ignore corrupted data
      }
    }
  }, []);

  // Save schedule to localStorage on every change
  useEffect(() => {
    localStorage.setItem('showflow-schedule', JSON.stringify(schedule));
  }, [schedule]);
  // In the Reset All handler, also clear localStorage
  const handleResetAll = () => {
    setSchedule([]);
    setHistory([]);
    setFuture([]);
    setSummary([]);
    setAlerts([]);
    setAlertSegments([]);
    setExpandedNotesIdx(null);
    setAllNotesExpanded(false);
    setInputValue(''); // Clear the input box
    localStorage.removeItem('showflow-schedule');
  };

  // Toggle Presenter View
  const togglePresenterView = () => {
    setPresenterViewMode(prev => !prev);
  };

  // Helper: check if mobile device (refined)
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileFooterMenuOpen, setMobileFooterMenuOpen] = useState(false); // <<< ADD THIS LINE
  useEffect(() => {
    const checkMobile = () => setIsMobileDevice(isMobile());
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  return (
    <MobileErrorBoundary>
      <div className={['showflow-root', theme, highContrast ? 'high-contrast' : ''].join(' ')}>
        {/* Mobile Logo Header - Custom mobile-only styling */}
        {isMobileDevice && (
          <div className="mobile-logo-header" style={{
            background: 'none',
            padding: '24px 0 12px 0',
            textAlign: 'center',
            position: 'relative',
            zIndex: 1100
          }}>
            <img
              src={theme === 'dark' ? 'styles/showflowlogov3_dark.png' : 'styles/showflow-logo-new.png'}
              alt="Show Flow Agent Logo"
              style={{ 
                width: '150px',
                maxWidth: '80vw',
                filter: 'drop-shadow(0 4px 18px rgba(0,0,0,0.28))',
                background: 'none'
              }}
            />
          </div>
        )}
        {/* Mobile nav drawer (simple) */}
        {isMobileDevice && mobileNavOpen && (
          <div style={{position:'fixed',top:54,left:0,right:0,background:'#F25022',color:'#fff',zIndex:1002,padding:'18px 0',textAlign:'center'}}>
            <button className="showflow-btn" style={{width:'90%',margin:'8px 0'}} onClick={() => setMobileNavOpen(false)}>Close Menu</button>
            <button className="showflow-btn" style={{width:'90%',margin:'8px 0'}} onClick={toggleTheme}>
              {theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
            </button>
            <button className="showflow-btn" style={{width:'90%',margin:'8px 0'}} onClick={handleUndo} disabled={history.length === 0}>Undo</button>
            <button className="showflow-btn" style={{width:'90%',margin:'8px 0'}} onClick={handleRedo} disabled={future.length === 0}>Redo</button>
            <button className="showflow-btn danger" style={{width:'90%',margin:'8px 0'}} onClick={handleResetAll}>Reset All</button>
          </div>
        )}
        {/* Toast/banner notification */}
        {toast.show && (
          <div
            className="showflow-toast"
            style={isMobileDevice
              ? { top: 64, width: '90vw', left: '5vw', right: '5vw', position: 'fixed', zIndex: 2001 }
              : {}}
          >
            <span role="img" aria-label="Alert" style={{ marginRight: 8 }}>🔔</span>
            {toast.message}
          </div>
        )}
        {/* Audio element for alert sound */}
        <audio ref={alertAudioRef} src="styles/alert-chime.wav" preload="auto" />
        <header className="logo-only-header">
          <div className="logo-header-content">
            <img
              src={theme === 'dark' ? 'styles/showflowlogov3_dark.png' : 'styles/showflow-logo-new.png'}
              alt="Show Flow Agent Logo"
              className="prominent-logo"
            />
          </div>
        </header>

        {/* Conditional rendering for Presenter View - outside of main content flow */}
        {presenterViewMode && (
            <div className="showflow-presenter-view fullscreen">
              {schedule.length === 0 ? (
                <div className="showflow-presenter-empty">
                  <h1>No Schedule Loaded</h1>
                  <p>Please load a schedule to use Presenter View</p>
                  <button className="showflow-btn primary large" onClick={togglePresenterView}>
                    ← Return to Normal View
                  </button>
                </div>
              ) : (
                <>
                  {/* Current Segment Display */}
                  {currentIdx !== null && schedule[currentIdx] ? (
                    <div className="showflow-presenter-current">
                      <div className="showflow-presenter-label">Current Segment</div>
                      <div className="showflow-presenter-title">{schedule[currentIdx].segment}</div>
                      <div className="showflow-presenter-time">{schedule[currentIdx].time}</div>
                      {schedule[currentIdx].presenter && (
                        <div className="showflow-presenter-presenter">Presenter: {schedule[currentIdx].presenter}</div>
                      )}
                      <div 
                        className={`showflow-presenter-timer ${
                          segmentTimer <= 10 ? 'critical' : 
                          segmentTimer <= 30 ? 'warning' : ''
                        }`}
                      >
                        <span className="showflow-presenter-timer-icon">
                          {segmentTimer <= 10 ? '🚨' : segmentTimer <= 30 ? '⚠️' : '⏳'}
                        </span>
                        <span className="showflow-presenter-timer-text">
                          {Math.floor(segmentTimer / 60)}:{(segmentTimer % 60).toString().padStart(2, '0')} remaining
                        </span>
                      </div>
                      {overrunIdx === currentIdx && (
                        <div className="showflow-presenter-overrun">⚠️ OVERRUN!</div>
                      )}
                    </div>
                  ) : (
                    <div className="showflow-presenter-current">
                      <div className="showflow-presenter-label">Schedule Status</div>
                      <div className="showflow-presenter-title">No Segment Active</div>
                      <div className="showflow-presenter-time">Waiting for schedule to start...</div>
                    </div>
                  )}
                  {/* Next Segment Display */}
                  {currentIdx !== null && schedule[currentIdx + 1] ? (
                    <div className="showflow-presenter-next">
                      <div className="showflow-presenter-label">Next Up</div>
                      <div className="showflow-presenter-next-title">{schedule[currentIdx + 1].segment}</div>
                      <div className="showflow-presenter-next-time">{schedule[currentIdx + 1].time}</div>
                    </div>
                  ) : currentIdx !== null && currentIdx === schedule.length - 1 ? (
                    <div className="showflow-presenter-next">
                      <div className="showflow-presenter-label">Schedule Status</div>
                      <div className="showflow-presenter-next-title">Final Segment</div>
                      <div className="showflow-presenter-next-time">Event concludes after this segment</div>
                    </div>
                  ) : null}

                  {/* Quick Return Button */}
                  <div className="showflow-presenter-controls">
                    <button className="showflow-btn large" onClick={togglePresenterView}>
                      ← Normal View
                    </button>
                  </div>
                </>
              )}
            </div>
        )}

        {/* Mobile: Default to Mobile Presenter View */}
        {isMobileDevice && !showMobileEdit ? (
          <main className="showflow-mobile-presenter" style={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #6c7bbd 0%, #8a9dc9 100%)',
            color: 'white',
            padding: '20px 16px',
            boxSizing: 'border-box'
          }}>
            {/* Mobile Presenter Header */}
            <div style={{
              textAlign: 'center',
              marginBottom: '32px'
            }}>
              <h1 style={{
                fontSize: '1.5em',
                margin: 0,
                fontWeight: '600',
                textShadow: '0 1px 2px rgba(0,0,0,0.2)'
              }}>
                Event Tracker
              </h1>
              {/* Only keep the smart Load/Change Event button */}
            </div>

            {schedule.length === 0 ? (
              // Empty state for mobile presenter
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                gap: '24px'
              }}>
                <div style={{fontSize: '4em', opacity: '0.8'}}>📅</div>
                <div>
                  <h2 style={{fontSize: '1.8em', marginBottom: '16px'}}>No Schedule Loaded</h2>
                  <p style={{fontSize: '1.1em', opacity: '0.9', marginBottom: '24px', lineHeight: '1.4'}}>
                    Load a shared event to start tracking
                  </p>
                  <button 
                    className="showflow-btn success"
                    style={{
                      background: 'rgba(255,255,255,0.9)',
                      color: '#6c7bbd',
                      padding: '16px 32px',
                      fontSize: '1.1em',
                      fontWeight: '600',
                      border: 'none',
                      borderRadius: '8px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                    onClick={() => showEventSelector()}
                  >
                    📂 Load an Event
                  </button>
                </div>
              </div>
            ) : (
              // Mobile presenter content
              <div style={{flex: 1, display: 'flex', flexDirection: 'column'}}>
                {/* Current Segment Display */}
                {currentIdx !== null && schedule[currentIdx] ? (
                  <div style={{
                    background: 'rgba(255,255,255,0.15)',
                    borderRadius: '16px',
                    padding: '24px',
                    marginBottom: '24px',
                    textAlign: 'center',
                    border: '2px solid rgba(255,255,255,0.2)'
                  }}>
                    <div style={{fontSize: '0.9em', opacity: '0.8', marginBottom: '8px'}}>
                      NOW PLAYING
                    </div>
                    <h2 style={{
                      fontSize: '1.6em',
                      margin: '0 0 12px 0',
                      fontWeight: '600',
                      lineHeight: '1.2'
                    }}>
                      {schedule[currentIdx].segment}
                    </h2>
                    {schedule[currentIdx].presenter && (
                      <div style={{fontSize: '1.1em', opacity: '0.9', marginBottom: '16px'}}>
                        👤 {schedule[currentIdx].presenter}
                      </div>
                    )}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '16px',
                      flexWrap: 'wrap'
                    }}>
                      <div style={{
                        background: 'rgba(255,255,255,0.2)',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        fontSize: '1em'
                      }}>
                        🕐 {schedule[currentIdx].time}
                      </div>
                      <div style={{
                        background: segmentTimer <= 120 ? 'rgba(255,79,79,0.3)' : 'rgba(255,255,255,0.2)',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        fontSize: '1em',
                        fontWeight: '600'
                      }}>
                        ⏳ {Math.floor(segmentTimer / 60)}:{(segmentTimer % 60).toString().padStart(2, '0')} left
                      </div>
                    </div>
                    {overrunIdx === currentIdx && (
                      <div style={{
                        marginTop: '12px',
                        background: 'rgba(255,79,79,0.4)',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        fontSize: '0.9em',
                        fontWeight: '600'
                      }}>
                        ⚠️ OVERRUN
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{
                    background: 'rgba(255,255,255,0.15)',
                    borderRadius: '16px',
                    padding: '24px',
                    marginBottom: '24px',
                    textAlign: 'center',
                    border: '2px solid rgba(255,255,255,0.2)'
                  }}>
                    <div style={{fontSize: '0.9em', opacity: '0.8', marginBottom: '8px'}}>
                      EVENT STATUS
                    </div>
                    <h2 style={{fontSize: '1.4em', margin: 0}}>
                      {currentIdx === null ? 'Ready to Start' : 'Event Complete'}
                    </h2>
                  </div>
                )}

                {/* Next Segments */}
                {currentIdx !== null && currentIdx + 1 < schedule.length && (
                  <div style={{marginBottom: '24px'}}>
                    <h3 style={{
                      fontSize: '1.1em',
                      marginBottom: '16px',
                      opacity: '0.9',
                      textAlign: 'center'
                    }}>
                      Coming Up
                    </h3>
                    <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                      {schedule.slice(currentIdx + 1, currentIdx + 3).map((seg, i) => (
                        <div key={i} style={{
                          background: 'rgba(255,255,255,0.1)',
                          borderRadius: '12px',
                          padding: '16px',
                          border: '1px solid rgba(255,255,255,0.2)'
                        }}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '4px'
                          }}>
                            <div style={{fontSize: '1em', fontWeight: '500'}}>
                              {seg.segment}
                            </div>
                            <div style={{fontSize: '0.9em', opacity: '0.8'}}>
                              {seg.time}
                            </div>
                          </div>
                          {seg.presenter && (
                            <div style={{fontSize: '0.9em', opacity: '0.8'}}>
                              👤 {seg.presenter}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Smart Load/Change Event Button */}
                <div style={{
                  margin: '24px 0',
                  textAlign: 'center'
                }}>
                  <button 
                    className="showflow-btn"
                    style={{
                      background: 'rgba(255,255,255,0.9)',
                      border: '2px solid rgba(255,255,255,0.5)',
                      color: '#6c7bbd',
                      padding: '12px 24px',
                      fontSize: '1em',
                      fontWeight: '600',
                      borderRadius: '8px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      minWidth: '160px'
                    }}
                    onClick={() => {
                      // Show event selector with radio buttons
                      showEventSelector();
                    }}
                  >
                    {currentSharedEventId ? '🔄 Change Event' : '📂 Load Event'}
                  </button>
                </div>

                {/* Quick Actions */}
                <div style={{
                  marginTop: 'auto',
                  display: 'flex',
                  gap: '12px',
                  flexWrap: 'wrap'
                }}>
                  <button 
                    className="showflow-btn"
                    style={{
                      flex: 1,
                      background: 'rgba(255,255,255,0.9)',
                      border: '2px solid rgba(255,255,255,0.5)',
                      color: '#6c7bbd',
                      padding: '16px',
                      fontSize: '1em',
                      fontWeight: '600',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                    onClick={() => setPresenterViewMode(true)}
                  >
                    📺 Full Screen
                  </button>
                </div>
              </div>
            )}
          </main>
        ) : (
          <main className="showflow-main" style={{ 
            display: presenterViewMode ? 'none' : 'block',
            maxWidth: '100vw',
            overflow: 'hidden',
            boxSizing: 'border-box'
          }}>
            {/* Mobile Edit Mode or Desktop Layout */}
            {isMobileDevice && showMobileEdit ? (
              <>
                {/* Mobile Edit Mode Header */}
                <div style={{
                  background: '#f8fafd',
                  padding: '16px',
                  marginBottom: '16px',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <h2 style={{margin: 0, fontSize: '1.2em'}}>📝 Edit Mode</h2>
                  <button 
                    className="showflow-btn"
                    onClick={() => setShowMobileEdit(false)}
                    style={{padding: '8px 16px', fontSize: '0.9em'}}
                  >
                    ← Back to Tracker
                  </button>
                </div>

                {/* Mobile Edit: Simplified Import Section */}
                <section className="showflow-card">
                  <h3>Import Schedule</h3>
                  <textarea
                    className="showflow-textarea"
                    placeholder="Paste your schedule here..."
                    rows={4}
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                  />
                  <div className="showflow-input-actions" style={{marginTop:'12px'}}>
                    <button className="showflow-btn success" onClick={handleParseSchedule}>Parse Schedule</button>
                    <label className="showflow-file-upload" style={{marginLeft:'8px'}}>
                      <input type="file" accept=".csv" onChange={handleFileUpload} />
                      <span>Upload CSV</span>
                    </label>
                  </div>
                </section>

                {/* Mobile Edit: Current Schedule */}
                <section className="showflow-card">
                  <h3>Current Schedule</h3>
                  {schedule.length === 0 ? (
                    <div className="showflow-empty" style={{textAlign:'center',padding:'32px 0'}}>
                      <p style={{fontSize:'1.08em',marginBottom:16}}>
                        No schedule loaded yet.<br />
                        <span style={{color:'#6c7bbd',fontSize:'0.98em'}}>Import or create one above!</span>
                      </p>
                      <button
                        className="showflow-btn success"
                        style={{fontSize:'1.08em',padding:'12px 32px',marginTop:8}}
                        onClick={() => handleAddSegment(0)}
                      >
                        + Create Schedule
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="showflow-table-container">
                        <table className="showflow-table">
                          <thead>
                            <tr>
                              <th>Time</th>
                              <th>Segment</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {schedule.map((seg, i) => (
                              <React.Fragment key={i}>
                                <tr
                                  className={
                                    (i === currentIdx ? 'current-segment ' : '') +
                                    (i === currentIdx+1 ? 'next-segment ' : '') +
                                    (i === overrunIdx ? 'overrun' : '')
                                  }
                                  style={{ position: 'relative' }}
                                >
                                  <td style={{fontSize:'0.9em'}}>{seg.time}</td>
                                  <td>
                                    <div style={{fontSize:'1.0em',fontWeight:'500'}}>{seg.segment}</div>
                                    {seg.presenter && (
                                      <div style={{fontSize:'0.85em',color:'#666',marginTop:'2px'}}>
                                        👤 {seg.presenter}
                                      </div>
                                    )}
                                    <div style={{fontSize:'0.8em',color:'#888',marginTop:'2px'}}>
                                      ⏱️ {seg.duration}
                                    </div>
                                  </td>
                                  <td style={{textAlign:'right',width:'80px'}}>
                                    <div style={{display:'flex',gap:'4px'}}>
                                      <button 
                                        className="showflow-btn" 
                                        onClick={() => handleEdit(i)} 
                                        style={{padding:'6px 10px',fontSize:'0.8em'}}
                                        title="Edit segment"
                                      >
                                        ✏️
                                      </button>
                                      <button 
                                        className="showflow-btn danger" 
                                        onClick={() => handleRemoveSegment(i)} 
                                        style={{padding:'6px 10px',fontSize:'0.8em'}}
                                        title="Delete segment"
                                      >
                                        🗑️
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                                {/* Mobile inline editing */}
                                {editIdx === i && (
                                  <tr>
                                    <td colSpan={3} style={{background:'#f8fafd',padding:'12px'}}>
                                      <div style={{display:'grid',gap:'8px'}}>
                                        <input
                                          name="time"
                                          value={editValues.time || ''}
                                          onChange={handleEditChange}
                                          className="showflow-input"
                                          placeholder="9:00 AM"
                                          style={{width:'100%'}}
                                        />
                                        <input
                                          name="segment"
                                          value={editValues.segment || ''}
                                          onChange={handleEditChange}
                                          className="showflow-input"
                                          placeholder="Session name"
                                          style={{width:'100%'}}
                                        />
                                        <input
                                          name="presenter"
                                          value={editValues.presenter || ''}
                                          onChange={handleEditChange}
                                          className="showflow-input"
                                          placeholder="Presenter"
                                          style={{width:'100%'}}
                                        />
                                        <input
                                          name="duration"
                                          value={editValues.duration || ''}
                                          onChange={handleEditChange}
                                          className="showflow-input"
                                          placeholder="30 min"
                                          style={{width:'100%'}}
                                        />
                                        <div style={{display:'flex',gap:'8px',marginTop:'8px'}}>
                                          <button className="showflow-btn success" onClick={() => handleSaveEdit(i)} style={{flex:1}}>✓ Save</button>
                                          <button className="showflow-btn" onClick={handleCancelEdit} style={{flex:1}}>✕ Cancel</button>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <button 
                        className="showflow-btn success" 
                        onClick={() => handleAddSegment(schedule.length)}
                        style={{marginTop:'16px',width:'100%'}}
                      >
                        + Add Segment
                      </button>
                    </>
                  )}
                </section>

                {/* Mobile Edit: Shared Events */}
                <section className="showflow-card">
                  <h3>Team Collaboration</h3>
                  {currentSharedEventId ? (
                    <div style={{background:'#fff4ce',padding:'12px',borderRadius:'4px',marginBottom:'12px'}}>
                      <div style={{fontSize:'0.9em'}}>📤 <strong>{currentSharedEventId}</strong></div>
                      <button 
                        className="showflow-btn" 
                        style={{ marginTop: '8px', padding: '6px 12px', fontSize: '0.8em' }}
                        onClick={updateSharedEvent}
                        disabled={isLoading}
                      >
                        {isLoading ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  ) : (
                    <button 
                      className="showflow-btn success" 
                      onClick={() => {
                        const eventName = prompt('Enter name for shared event:');
                        if (eventName) saveAsSharedEvent(eventName);
                      }}
                      disabled={isLoading}
                      style={{width:'100%',marginBottom:'12px'}}
                    >
                      💾 Share This Schedule
                    </button>
                  )}
                  {sharedEvents.length > 0 && (
                    <div style={{maxHeight:'150px',overflow:'auto'}}>
                      {sharedEvents.map((event) => (
                        <div key={event.id} style={{
                          padding:'8px',
                          background:event.id === currentSharedEventId ? '#fff4ce' : '#f8f9fa',
                          marginBottom:'4px',
                          borderRadius:'4px',
                          fontSize:'0.8em'
                        }}>
                          <div style={{fontWeight:'500'}}>{event.name}</div>
                          <div style={{display:'flex',gap:'8px',marginTop:'4px'}}>
                            <button 
                              className="showflow-btn" 
                              style={{padding:'2px 8px',fontSize:'0.7em'}}
                              onClick={() => loadSharedEvent(event.id)}
                              disabled={isLoading}
                            >
                              📥 Load
                            </button>
                            <button 
                              className="showflow-btn danger" 
                              style={{padding:'2px 8px',fontSize:'0.7em'}}
                              onClick={() => deleteSharedEvent(event.id)}
                              disabled={isLoading}
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </>
            ) : (
            <>
              {/* Mobile: Current Schedule First (Core Experience) */}
              <section className="showflow-card">
                <h2>Current Schedule</h2>
                {schedule.length === 0 ? (
                  <div className="showflow-empty" style={{textAlign:'center',padding:'32px 0'}}>
                    <p style={{fontSize:'1.08em',marginBottom:16}}>
                      No schedule loaded yet.<br />
                      <span style={{color:'#6c7bbd',fontSize:'0.98em'}}>Get started below!</span>
                    </p>
                    <button
                      className="showflow-btn success"
                      style={{fontSize:'1.08em',padding:'12px 32px',marginTop:8}}
                      onClick={() => handleAddSegment(0)}
                    >
                      + Create Schedule
                    </button>
                    <p style={{fontSize:'0.9em',margin:'16px 0 0 0',color:'#666'}}>
                      or use the 📝 button below to import
                    </p>
                  </div>
                ) : (
                  <>
                    {hasNotesInSchedule() && (
                      <button 
                        className="showflow-btn" 
                        style={{marginBottom:12}} 
                        onClick={handleToggleAllNotes}
                      >
                        {allNotesExpanded ? 'Collapse All Notes' : 'Expand All Notes'}
                      </button>
                    )}
                    {/* Mobile Schedule Table - simplified */}
                    <div className="showflow-table-container">
                      <table className="showflow-table">
                        <thead>
                          <tr>
                            <th>Time</th>
                            <th>Segment</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {schedule.map((seg, i) => (
                            <React.Fragment key={i}>
                              <tr
                                className={
                                  (i === currentIdx ? 'current-segment ' : '') +
                                  (i === currentIdx+1 ? 'next-segment ' : '') +
                                  (i === overrunIdx ? 'overrun' : '')
                                }
                                style={{ position: 'relative' }}
                                onClick={() => setExpandedNotesIdx(expandedNotesIdx === i ? null : i)}
                                title="Tap to add notes or see details"
                              >
                                <td style={{fontSize:'0.9em'}}>{seg.time}</td>
                                <td>
                                  <div style={{fontSize:'1.0em',fontWeight:'500'}}>{seg.segment}</div>
                                  {seg.presenter && (
                                    <div style={{fontSize:'0.85em',color:'#666',marginTop:'2px'}}>
                                      👤 {seg.presenter}
                                    </div>
                                  )}
                                  <div style={{fontSize:'0.8em',color:'#888',marginTop:'2px'}}>
                                    ⏱️ {seg.duration}
                                  </div>
                                </td>
                                <td style={{textAlign:'right',width:'60px'}}>
                                  {editIdx === i ? (
                                    <div style={{display:'flex',gap:'4px'}}>
                                      <button className="showflow-btn success" onClick={e => { e.stopPropagation(); handleSaveEdit(i); }} style={{padding:'4px 8px',fontSize:'0.7em'}}>✓</button>
                                      <button className="showflow-btn" onClick={e => { e.stopPropagation(); handleCancelEdit(); }} style={{padding:'4px 8px',fontSize:'0.7em'}}>✕</button>
                                    </div>
                                  ) : (
                                    <button 
                                      className="showflow-btn" 
                                      onClick={e => { e.stopPropagation(); handleEdit(i); }} 
                                      style={{padding:'6px 10px',fontSize:'0.8em'}}
                                      title="Edit segment"
                                    >
                                      ✏️
                                    </button>
                                  )}
                                </td>
                              </tr>
                              {/* Mobile inline editing */}
                              {editIdx === i && (
                                <tr>
                                  <td colSpan={3} style={{background:'#f8fafd',padding:'12px'}}>
                                    <div style={{display:'grid',gap:'8px'}}>
                                      <input
                                        name="time"
                                        value={editValues.time || ''}
                                        onChange={handleEditChange}
                                        className="showflow-input"
                                        placeholder="9:00 AM"
                                        style={{width:'100%'}}
                                      />
                                      <input
                                        name="segment"
                                        value={editValues.segment || ''}
                                        onChange={handleEditChange}
                                        className="showflow-input"
                                        placeholder="Session name"
                                        style={{width:'100%'}}
                                      />
                                      <input
                                        name="presenter"
                                        value={editValues.presenter || ''}
                                        onChange={handleEditChange}
                                        className="showflow-input"
                                        placeholder="Presenter"
                                        style={{width:'100%'}}
                                      />
                                      <input
                                        name="duration"
                                        value={editValues.duration || ''}
                                        onChange={handleEditChange}
                                        className="showflow-input"
                                        placeholder="30 min"
                                        style={{width:'100%'}}
                                      />
                                    </div>
                                  </td>
                                </tr>
                              )}
                              {/* Expandable notes row */}
                              {(allNotesExpanded || expandedNotesIdx === i) && editIdx !== i && (
                                <tr>
                                  <td colSpan={3} style={{background:'#f8fafd',padding:'12px'}}>
                                    <input
                                      type="text"
                                      placeholder="Add notes or feedback..."
                                      value={seg.notes || ''}
                                      onChange={e => {
                                        const updated = schedule.map((s, idx) => idx === i ? { ...s, notes: e.target.value } : s);
                                        pushHistory(schedule);
                                        setSchedule(updated);
                                      }}
                                      className="showflow-input"
                                      style={{width:'100%'}}
                                      autoFocus
                                    />
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </section>

