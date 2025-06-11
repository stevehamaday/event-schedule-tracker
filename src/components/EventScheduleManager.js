import React, { useState, useEffect, useRef } from 'react';
import { parseExcelFile } from '../utils/excelParser'; // This path must be correct
import { QRCodeSVG } from 'qrcode.react';
import axios from 'axios';
import XLSX from 'xlsx';

// Helper for drag-and-drop
const reorder = (list, startIndex, endIndex) => {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
};

// *** REPLACED: This is the new, flexible recalculateTimes function ***
const recalculateTimes = (schedule, mode = 'cascade') => {
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
    return `${displayHours}:${String(minutes).padStart(2, '0')} ${ampm}`;
  };

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

  // Inline editing state
  const [editIdx, setEditIdx] = useState(null);
  const [editValues, setEditValues] = useState({});

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

  // New: Track locked segments

  // New: Collapse/expand all notes
  const [allNotesExpanded, setAllNotesExpanded] = useState(false);
  // New: Keyboard shortcuts help modal
  const [showShortcuts, setShowShortcuts] = useState(false);
  // New: Debug/settings pane visibility
  const [showDebug, setShowDebug] = useState(false);

  // Debug: set now to a custom date/time
  const [debugNow, setDebugNow] = useState(null);
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

  // Parse schedule from textarea (robust, Excel-like)
  const handleParseSchedule = () => {
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
      };    });
    const recalculated = recalculateTimes(parsed);
    setSchedule(recalculated);
    setSummary((prev) => [...prev, 'Parsed schedule from input and recalculated times.']);
  };

  // File upload handler
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      pushHistory(schedule);
      const parsed = await parseExcelFile(file);
      // If no duration, default to 30 min for demo
      const withDefaults = parsed.map(seg => ({
        ...seg,
        duration: seg.duration || '30',
      }));

      // *** UPDATED: This now uses the 'preserve' mode for the initial upload ***
      const recalculated = recalculateTimes(withDefaults, 'preserve');
      
      setSchedule(recalculated);
      setSummary((prev) => [...prev, `Loaded schedule from file and recalculated times.`]);
    } catch (err) {
      alert('Failed to parse file. Please upload a valid .xlsx or .csv with columns: Time, Duration, Segment, Presenter.');
    }
  };

  // Start editing a row
  const handleEdit = (idx) => {
    setEditIdx(idx);
    setEditValues(schedule[idx]);
  };

  // Save edits
  const handleSaveEdit = (idx) => {
    pushHistory(schedule);
    const updated = schedule.map((seg, i) => i === idx ? { ...editValues } : seg);
    const recalculated = recalculateTimes(updated);
    setSchedule(recalculated);
    setEditIdx(null);
    setEditValues({});
    setSummary((prev) => [
      ...prev,
      `Edited segment '${editValues.segment}' at position ${idx + 1} and recalculated times.`
    ]);
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditIdx(null);
    setEditValues({});
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

  // Theme toggles (refined, only dark/light)
  const toggleTheme = () => {
    setTheme(t => (t === 'light' ? 'dark' : 'light'));
    // Optionally, update body class for global dark mode
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

  // Export to Excel (XLSX)
  const handleExportSchedule = (format) => {
    if (format === 'excel') {
      import('xlsx').then(XLSX => {
        const ws = XLSX.utils.json_to_sheet(schedule);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Schedule');
        XLSX.writeFile(wb, 'showflow-schedule.xlsx');
      });
    } else if (format === 'csv') {
      import('xlsx').then(XLSX => {
        const ws = XLSX.utils.json_to_sheet(schedule);
        const csv = XLSX.utils.sheet_to_csv(ws);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'showflow-schedule.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    } else if (format === 'json') {
      const dataStr = JSON.stringify(schedule, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'showflow-schedule.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
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
        {/* Mobile Nav - Clean logo banner only */}
        {isMobileDevice && (
          <nav className="showflow-mobile-nav" style={{position:'relative',zIndex:1100}}>
            <img
              src="styles/showflow-logo.png"
              alt="ShowFlow Logo"
              className="showflow-logo"
              style={{
                maxWidth: '180px',
                maxHeight: '40px',
                height: 'auto',
                display: 'block',
                margin: '0 auto',
                padding: '8px 0'
              }}
            />
          </nav>
        )}
        {/* Mobile nav drawer (simple) */}
        {isMobileDevice && mobileNavOpen && (
          <div style={{position:'fixed',top:54,left:0,right:0,background:'#232a5c',color:'#fff',zIndex:1002,padding:'18px 0',textAlign:'center'}}>
            <button className="showflow-btn" style={{width:'90%',margin:'8px 0'}} onClick={() => setMobileNavOpen(false)}>Close Menu</button>
            <button className="showflow-btn" style={{width:'90%',margin:'8px 0'}} onClick={toggleTheme}>{theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}</button>
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
        <main className="showflow-main">          {/* Floating sticky bar for current segment */}
          {currentIdx !== null && schedule[currentIdx] && (
            <div className="showflow-current-sticky" style={isMobile() ? { position: 'sticky', top: 64, zIndex: 900, background: '#232a5c' } : {}}>
              <span className="showflow-current-pulse" />
              <strong>Now:</strong> {schedule[currentIdx].segment}
              <span style={{ marginLeft: 8 }}>{schedule[currentIdx].time}</span>
              {/* Session timer widget */}
              <span style={{ marginLeft: 16, color: '#6c7bbd', fontWeight: 500 }}>
                <span role="img" aria-label="timer">⏳</span> {Math.floor(segmentTimer / 60)}:{(segmentTimer % 60).toString().padStart(2, '0')} left
              </span>
              {overrunIdx === currentIdx && <span style={{ color: 'red', marginLeft: 8 }}>Overrun!</span>}
              {schedule[currentIdx + 1] && (
                <span style={{ marginLeft: 24, opacity: 0.7 }}>
                  <strong>Next Up:</strong> {schedule[currentIdx + 1].segment} <span style={{ marginLeft: 8 }}>{schedule[currentIdx + 1].time}</span>
                </span>
              )}
            </div>
          )}          {/* Schedule Input Section */}
          <section className="showflow-card">
            <h2>Import or Paste Schedule</h2>
            <p style={{fontSize: '0.85em', color: '#666', marginTop: '-8px', marginBottom: 16}}>
              <em>Single-day events only • Multi-day support coming soon</em>
            </p>
            <p style={{marginBottom: 16}}>
              <a 
                href="https://aka.ms/showflowtrackertemplate" 
                target="_blank" 
                rel="noopener noreferrer"
                className="showflow-btn"
                style={{
                  textDecoration: 'none',
                  display: 'inline-block',
                  backgroundColor: '#6c7bbd',
                  color: '#fff',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  fontSize: '0.9em'
                }}
              >
                📋 Click for Schedule Template
              </a>
            </p>
            <textarea
              className="showflow-textarea"
              placeholder="Paste your schedule here..."
              rows={6}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onPaste={e => {
                // Wait for paste to complete, then update inputValue and optionally auto-parse
                setTimeout(() => {
                  setInputValue(e.target.value);
                  // Optionally auto-parse after paste
                  // handleParseSchedule();
                }, 0);
              }}
            />
            <div className="showflow-input-actions">
              <button className="showflow-btn primary" onClick={handleParseSchedule}>Parse Schedule</button>
              <label className="showflow-file-upload">
                <input type="file" accept=".xlsx,.csv" onChange={handleFileUpload} />
                <span>Upload .xlsx or .csv</span>
              </label>
            </div>
          </section>          {/* Schedule Table Display */}
          <section className="showflow-card">
            <h2>Current Schedule</h2>
            {schedule.length === 0 ? (              <div className="showflow-empty" style={{textAlign:'center',padding:'32px 0'}}>
                  <p style={{fontSize:'1.08em',marginBottom:16}}>
                    You can build your schedule here by adding segments.<br />
                    <span style={{color:'#6c7bbd',fontSize:'0.98em'}}>Click below to get started!</span>
                  </p>                <button
                    className="showflow-btn primary"
                    style={{fontSize:'1.08em',padding:'12px 32px',marginTop:8}}
                    onClick={() => handleAddSegment(0)}
                  >
                    + Create a New Schedule
                  </button>
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
              <div className="showflow-table-container">
                <table className="showflow-table">
                  <thead>
                    <tr>
                      <th></th> {/* Alert icon column */}
                      <th></th> {/* Lock icon column */}
                      <th>Time</th>
                      <th>Duration</th>
                      <th>Segment</th>
                      <th>Presenter</th>
                      <th colSpan={5}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.map((seg, i) => (
                      <React.Fragment key={i}>
                        <tr
                          draggable
                          onDragStart={() => handleDragStart(i)}
                          onDragOver={handleDragOver}
                          onDrop={() => handleDrop(i)}
                          className={
                            (draggedIndex === i ? 'dragged ' : '') +
                            (i === currentIdx ? 'current-segment ' : '') +
                            (i === currentIdx+1 ? 'next-segment ' : '') +
                            (i === overrunIdx ? 'overrun' : '')
                          }
                          style={{ cursor: 'pointer', position: 'relative' }}
                          onClick={() => setExpandedNotesIdx(expandedNotesIdx === i ? null : i)}
                          title="Click to reveal or add notes"
                        >
                          {/* Render icons on the right for mobile, left for desktop */}
                          {!isMobile() && (
                            <>
                              {/* Alert icon */}
                              <td style={{textAlign:'center',width:32}}>
                                {i === currentIdx ? (
                                  <span className="showflow-current-pulse" title="Current segment" />
                                ) : (
                                  <button
                                    className="showflow-btn"
                                    style={{background:'none',border:'none',padding:0,cursor:'pointer'}}
                                    title={alertSegments.includes(i) ? 'Alert enabled' : 'Enable alert'}
                                    onClick={e => { e.stopPropagation(); toggleAlertSegment(i); }}
                                    tabIndex={0}
                                  >
                                    <span style={{fontSize:'1.2em',color:alertSegments.includes(i)?'#232a5c':'#bbb'}}>
                                      {alertSegments.includes(i) ? '🔔' : '🔕'}
                                    </span>
                                  </button>
                                )}                              </td>
                            </>
                          )}
                          {/* Editable fields */}
                          {editIdx === i ? (
                            <>
                              <td>
                                <input
                                  name="time"
                                  value={editValues.time || ''}
                                  onChange={handleEditChange}
                                  className="showflow-input"
                                  style={{width:'6em'}}
                                  autoFocus
                                />
                              </td>
                              <td>
                                <input
                                  name="duration"
                                  value={editValues.duration || ''}
                                  onChange={handleEditChange}
                                  className="showflow-input"
                                  style={{width:'5em'}}
                                />
                              </td>
                              <td>
                                <input
                                  name="segment"
                                  value={editValues.segment || ''}
                                  onChange={handleEditChange}
                                  className="showflow-input"
                                  style={{width:'12em'}}
                                />
                              </td>
                              <td>
                                <input
                                  name="presenter"
                                  value={editValues.presenter || ''}
                                  onChange={handleEditChange}
                                  className="showflow-input"
                                  style={{width:'10em'}}
                                />
                              </td>
                              {/* Save/Cancel buttons */}
                              <td colSpan={5} style={{minWidth:120}}>
                                <button className="showflow-btn primary" onClick={e => { e.stopPropagation(); handleSaveEdit(i); }}>Save</button>
                                <button className="showflow-btn" onClick={e => { e.stopPropagation(); handleCancelEdit(); }} style={{marginLeft:8}}>Cancel</button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td>{seg.time}</td>
                              <td>{seg.duration}</td>
                              <td>{seg.segment}</td>
                              <td>{seg.presenter}</td>
                              {/* Duplicate button */}
                              <td>
                                <button className="showflow-btn" title="Duplicate segment" onClick={e => { e.stopPropagation(); handleDuplicateSegment(i); }}>⧉</button>
                              </td>
                              {/* Add segment after */}
                              <td>
                                <button className="showflow-btn" title="Add segment after" onClick={e => { e.stopPropagation(); handleAddSegment(i + 1); }}>+</button>
                              </td>
                              {/* Remove segment */}
                              <td>
                                <button className="showflow-btn danger" title="Remove segment" onClick={e => { e.stopPropagation(); handleRemoveSegment(i); }}>-</button>
                              </td>
                              {/* Edit segment */}
                              <td>
                                <button className="showflow-btn" title="Edit segment" onClick={e => { e.stopPropagation(); handleEdit(i); }}>Edit</button>
                              </td>                              {/* On mobile, render icons at the end */}
                              {isMobileDevice && (
                                <td className="showflow-header-icons" style={{
                                  textAlign: 'right',
                                  minWidth: 96, // increased from 64
                                  display: 'flex',
                                  gap: '12px', // increased from 8px
                                  justifyContent: 'flex-end',
                                  alignItems: 'center',
                                  overflowX: 'auto', // allow horizontal scroll if needed
                                  paddingRight: 8
                                }}>
                                  {/* Alert and lock icons removed from mobile view to prevent overlap with Edit button */}
                                </td>
                              )}
                            </>
                          )}
                        </tr>
                        {/* Expandable notes row */}
                        {(allNotesExpanded || expandedNotesIdx === i) && editIdx !== i && (
                          <tr>
                            <td colSpan={12} style={{background:'#f8fafd',padding:'12px 24px'}}>
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
                  </tbody>                </table>
              </div>
              </>
            )}
          </section>
          {/* Summary/Action Log Section */}
          <section className="showflow-card">
            <h2>Action Log</h2>
            <div className="showflow-summary-container">
              <div className="showflow-summary-column">
                <h3>Recent Actions</h3>
                <ul className="showflow-summary-list">
                  {summary.length === 0 && (
                    <div className="showflow-empty" style={{textAlign:'center',padding:'16px 0'}}>
                      <span style={{fontSize:'0.9em',color:'#666'}}>No recent actions to show.</span>
                    </div>
                  )}
                  {summary.slice(-5).map((s, idx) => (
                    <li key={idx} className="showflow-summary-item">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="showflow-summary-column">
                <h3>Scheduled Alerts</h3>
                <ul className="showflow-summary-list">
                  {alerts.length === 0 && (
                    <div className="showflow-empty" style={{textAlign:'center',padding:'16px 0'}}>
                      <span style={{fontSize:'0.9em',color:'#666'}}>No alerts scheduled.</span>
                    </div>
                  )}
                  {alerts.map((a, idx) => (
                    <li key={idx} className="showflow-summary-item">
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
          {/* Debug/Settings Section (hidable) */}
          {showDebug && (
            <section className="showflow-card" style={{marginTop:24}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <h2 style={{margin:0}}>Settings & Debug</h2>
                <button className="showflow-btn" onClick={handleDebugNow} style={{marginLeft:8}}>Set Debug Now</button>
                <button className="showflow-btn" onClick={() => setShowDebug(false)} style={{marginLeft:8}}>Hide Debug</button>
              </div>
              <div style={{marginTop:16}}>
                <label style={{display:'block',marginBottom:8}}>
                  Font Size:
                  <input
                    type="range"
                    min="0.8"
                    max="1.5"
                    step="0.1"
                    value={fontSize}
                    onChange={e => setFontSize(parseFloat(e.target.value))}
                    style={{marginLeft:8,width:'calc(100% - 32px)',display:'inline-block'}}
                  />
                </label>
                <label style={{display:'block',marginBottom:8}}>
                  High Contrast:
                  <input
                    type="checkbox"
                    checked={highContrast}
                    onChange={e => setHighContrast(e.target.checked)}
                    style={{marginLeft:8}}
                  />
                </label>
              </div>
              {/* Debug controls (hidden by default) */}
              <div style={{marginTop:16}}>
                <button className="showflow-btn" onClick={handleResetDebugNow} style={{marginRight:8}}>Reset Debug Now</button>
                <button className="showflow-btn" onClick={() => setDebugNow(new Date())}>Set Now to Current Time</button>
              </div>
            </section>
          )}
          {!showDebug && (
            <div style={{textAlign:'right',margin:'16px 0'}}>
              <button className="showflow-btn" onClick={() => setShowDebug(true)}>Show Debug/Settings</button>
            </div>
          )}
        </main>
        {/* Undo/Redo/Reset Footer Controls + Dark Mode Toggle */}
        {isMobileDevice ? (
          <footer className="showflow-footer-controls" style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: '#f8fafd',
            borderTop: '1px solid #e0e4f7',
            padding: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            boxShadow: '0 -2px 8px rgba(60,80,160,0.04)'
          }}>
            <button
              className="showflow-btn"
              style={{ width: '100%', fontSize: '1.2em', padding: '16px 0', borderRadius: 0, background: 'none', border: 'none', textAlign: 'center' }}
              onClick={() => setMobileFooterMenuOpen(v => !v)}
              aria-label="Show controls"
            >
              ☰ Menu
            </button>
            {mobileFooterMenuOpen && (
              <div style={{
                position: 'fixed',
                bottom: 56,
                left: 0,
                right: 0,
                background: '#fff',
                zIndex: 2002,
                boxShadow: '0 -2px 8px rgba(0,0,0,0.08)',
                borderTop: '1px solid #e0e4f7',
                padding: '12px 0'
              }}>
                <button className="showflow-btn" onClick={toggleTheme} style={{ width: '90%', margin: '12px auto', display: 'block' }}>
                  {theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
                </button>
                <button className="showflow-btn" onClick={handleUndo} disabled={history.length === 0} style={{ width: '90%', margin: '12px auto', display: 'block' }}>Undo</button>
                <button className="showflow-btn" onClick={handleRedo} disabled={future.length === 0} style={{ width: '90%', margin: '12px auto', display: 'block' }}>Redo</button>
                <button className="showflow-btn danger" onClick={handleResetAll} style={{ width: '90%', margin: '12px auto', display: 'block' }}>Reset All</button>
                <button className="showflow-btn" onClick={() => setMobileFooterMenuOpen(false)} style={{ width: '90%', margin: '12px auto', display: 'block' }}>Close</button>
              </div>
            )}
          </footer>
        ) : (
          // Desktop Footer Controls
          <footer className="showflow-footer-controls" style={{position:'fixed',bottom:0,left:0,right:0,background:'#f8fafd',borderTop:'1px solid #e0e4f7',padding:'12px 0',display:'flex',justifyContent:'center',alignItems:'center',zIndex:1000,boxShadow:'0 -2px 8px rgba(60,80,160,0.04)'}}>
            <div style={{ position: 'relative', marginRight: 16 }}>
              <button
                className="showflow-btn"
                style={{ background: '#21a366', color: '#fff', border: 'none', paddingRight: 24 }}
                onClick={e => {
                  const menu = document.getElementById('export-dropdown');
                  menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
                }}
                title="Export schedule"
              >
                Export ▼
              </button>
              <div id="export-dropdown" style={{ display: 'none', position: 'absolute', left: 0, bottom: '110%', background: '#fff', border: '1px solid #ccc', zIndex: 1001, minWidth: 120, boxShadow: '0 4px 16px rgba(60,80,160,0.10)', padding: '8px 0', borderRadius: 6 }}>
                <button className="showflow-btn" style={{ width: '100%', textAlign: 'left', color: '#21a366', background: 'none', border: 'none', padding: '8px 16px' }} onClick={() => { handleExportSchedule('excel'); document.getElementById('export-dropdown').style.display = 'none'; }}>Excel (.xlsx)</button>
                <button className="showflow-btn" style={{ width: '100%', textAlign: 'left', color: '#217346', background: 'none', border: 'none', padding: '8px 16px' }} onClick={() => { handleExportSchedule('csv'); document.getElementById('export-dropdown').style.display = 'none'; }}>CSV (.csv)</button>
                <button className="showflow-btn" style={{ width: '100%', textAlign: 'left', color: '#444', background: 'none', border: 'none', padding: '8px 16px' }} onClick={() => { handleExportSchedule('json'); document.getElementById('export-dropdown').style.display = 'none'; }}>JSON (.json)</button>
              </div>
            </div>
            <button className="showflow-btn" onClick={handleUndo} disabled={history.length === 0} style={{marginRight:16}}>Undo</button>
            <button className="showflow-btn" onClick={handleRedo} disabled={future.length === 0} style={{marginRight:16}}>Redo</button>
            <button className="showflow-btn danger" onClick={handleResetAll} style={{marginRight:24}}>Reset All</button>
            <button className="showflow-btn" onClick={toggleTheme} style={{marginLeft:8}}>{theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}</button>
            <a
              href="https://aka.ms/sfbugtracker"
              target="_blank"
              rel="noopener noreferrer"
              className="showflow-btn"
              style={{ marginLeft: 8 }}
            >
              🐞 Report a Bug
            </a>
          </footer>
        )}
        {/* QR Code & Share Modal */}
        {showQR && (
          <div className="showflow-qr-modal">
            <div className="showflow-qr-content">
              <h2>Share Schedule</h2>
              <p>Share this link with others to view the schedule:</p>
              <input
                type="text"
                value={shareLink}
                readOnly
                className="showflow-input"
                style={{width:'100%',marginBottom:16}}
              />
              <QRCodeSVG
                value={shareLink}
                size={128}
                style={{marginBottom:16}}
              />
              <button className="showflow-btn primary" onClick={() => navigator.clipboard.writeText(shareLink)}>
                Copy Link to Clipboard
              </button>
              <button className="showflow-btn" onClick={handleShowQR} style={{marginTop:8}}>
                Close
              </button>
            </div>
          </div>
        )}
        {/* Shortcuts Help Modal */}
        {showShortcuts && (
          <div className="showflow-shortcuts-modal">
            <div className="showflow-shortcuts-content">
              <h2>Keyboard Shortcuts</h2>
              <button className="showflow-btn" onClick={() => setShowShortcuts(false)} style={{position:'absolute',top:8,right:8}}>✖️</button>
              <div style={{maxHeight:'70vh',overflowY:'auto'}}>
                <h3>Navigation</h3>
                <div className="showflow-shortcut-item">
                  <div className="showflow-shortcut-key">⌨️</div>
                  <div className="showflow-shortcut-desc">Focus on schedule table</div>
                </div>
                <div className="showflow-shortcut-item">
                  <div className="showflow-shortcut-key">↑ ↓</div>
                  <div className="showflow-shortcut-desc">Navigate segments</div>
                </div>
                <div className="showflow-shortcut-item">
                  <div className="showflow-shortcut-key">← →</div>
                  <div className="showflow-shortcut-desc">Adjust time/duration</div>
                </div>
                <div className="showflow-shortcut-item">
                  <div className="showflow-shortcut-key">Enter</div>
                  <div className="showflow-shortcut-desc">Edit selected segment</div>
                </div>
                <div className="showflow-shortcut-item">
                  <div className="showflow-shortcut-key">Esc</div>
                  <div className="showflow-shortcut-desc">Cancel edit or close modal</div>
                </div>
                <h3 style={{marginTop:24}}>Editing</h3>
                <div className="showflow-shortcut-item">
                  <div className="showflow-shortcut-key">Tab</div>
                  <div className="showflow-shortcut-desc">Next field</div>
                </div>
                <div className="showflow-shortcut-item">
                  <div className="showflow-shortcut-key">Shift + Tab</div>
                  <div className="showflow-shortcut-desc">Previous field</div>
                </div>
                <div className="showflow-shortcut-item">
                  <div className="showflow-shortcut-key">Ctrl + Z</div>
                  <div className="showflow-shortcut-desc">Undo</div>
                </div>
                <div className="showflow-shortcut-item">
                  <div className="showflow-shortcut-key">Ctrl + Y</div>
                  <div className="showflow-shortcut-desc">Redo</div>
                </div>
                <div className="showflow-shortcut-item">
                  <div className="showflow-shortcut-key">Ctrl + A</div>
                  <div className="showflow-shortcut-desc">Select all</div>
                </div>
                <div className="showflow-shortcut-item">
                  <div className="showflow-shortcut-key">Delete</div>
                  <div className="showflow-shortcut-desc">Remove segment</div>
                </div>
                <h3 style={{marginTop:24}}>Miscellaneous</h3>
                <div className="showflow-shortcut-item">
                  <div className="showflow-shortcut-key">F1</div>
                  <div className="showflow-shortcut-desc">Show this help</div>
                </div>
                <div className="showflow-shortcut-item">
                  <div className="showflow-shortcut-key">F2</div>
                  <div className="showflow-shortcut-desc">Toggle theme</div>
                </div>
                <div className="showflow-shortcut-item">
                  <div className="showflow-shortcut-key">F5</div>
                  <div className="showflow-shortcut-desc">Refresh schedule</div>
                </div>
                <div className="showflow-shortcut-item">
                  <div className="showflow-shortcut-key">Ctrl + P</div>
                  <div className="showflow-shortcut-desc">Print schedule</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </MobileErrorBoundary>
  );
};

export default ShowFlowAgent;
