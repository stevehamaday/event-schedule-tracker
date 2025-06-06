import React, { useState, useRef, useEffect } from 'react';
import { parseExcelFile } from '../utils/excelParser';
import { QRCodeSVG } from 'qrcode.react';
import axios from 'axios';

// Helper for drag-and-drop
const reorder = (list, startIndex, endIndex) => {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
};

// Helper to recalculate start times based on durations and event start time
const recalculateTimes = (schedule, startIdx = 0) => {
  // Use the time at startIdx (or fallback to 09:00 AM if missing)
  const updated = [...schedule];
  let mins;
  if (updated[startIdx] && updated[startIdx].time) {
    // Parse the anchor time
    let time = updated[startIdx].time.trim();
    let modifier = '';
    if (/am|pm/i.test(time)) {
      [time, modifier] = time.split(/\s+/);
      modifier = modifier.toUpperCase();
    }
    let [hours, minutes] = time.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) {
      mins = 9 * 60;
    } else {
      if (modifier) {
        if (modifier === 'PM' && hours !== 12) hours += 12;
        if (modifier === 'AM' && hours === 12) hours = 0;
      }
      mins = hours * 60 + minutes;
    }
    // Overwrite the anchor time to ensure consistency
    updated[startIdx].time = toTimeStr(mins);
  } else {
    mins = 9 * 60;
    updated[startIdx].time = toTimeStr(mins);
  }
  // Helper to format time
  function toTimeStr(mins) {
    let hours = Math.floor(mins / 60);
    let minutes = mins % 60;
    let ampm = hours >= 12 ? 'PM' : 'AM';
    let displayHours = hours % 12;
    if (displayHours === 0) displayHours = 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  }
  // Propagate times forward, always overwriting
  for (let i = startIdx + 1; i < updated.length; i++) {
    let duration = parseInt(updated[i - 1].duration, 10);
    if (isNaN(duration) || duration < 0) duration = 0;
    mins += duration;
    updated[i].time = toTimeStr(mins);
  }
  return updated;
};

const AI_SYSTEM_PROMPT = `You are Show Flow Agent, an AI event schedule assistant. You help users upload, edit, and manage event schedules, with dynamic time recalculation, inline editing, drag-and-drop reordering, and more. You can only make changes to the schedule as allowed by the user. If a user asks for something outside your scope, politely decline.`;

// Mobile nav and FAB helpers
const isMobile = () => window.matchMedia && window.matchMedia('(max-width: 768px)').matches;

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

  // Save edits
  const handleSaveEdit = (idx) => {
    pushHistory(schedule);
    // Update the edited segment
    const updated = schedule.map((seg, i) => i === idx ? { ...editValues } : seg);
    // Always recalculate ALL subsequent times based on the edited segment's new time/duration
    // This ensures all following segments are updated, even if they had times before
    const recalculated = recalculateTimes(updated, idx);
    setSchedule(recalculated);
    setEditIdx(null);
    setEditValues({});
    setSummary((prev) => [
      ...prev,
      `Edited segment '${editValues.segment}' at position ${idx + 1} and recalculated times.`
    ]);
  };

  // Handlers for drag-and-drop
  const handleDragStart = (index) => setDraggedIndex(index);
  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (index) => {
    if (draggedIndex === null || draggedIndex === index) return;
    pushHistory(schedule);
    const newOrder = reorder(schedule, draggedIndex, index);
    // After reordering, always recalculate ALL times from the earliest of draggedIndex or index
    const recalcStart = Math.min(draggedIndex, index);
    const recalculated = recalculateTimes(newOrder, recalcStart);
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
    // Fill missing times
    const recalculated = recalculateTimes(newSchedule, index);
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
    // Fill missing times
    const recalculated = recalculateTimes(newSchedule, index);
    setSchedule(recalculated);
    setSummary((prev) => [
      ...prev,
      `Removed segment '${removed?.segment || ''}' at position ${index + 1} and recalculated times.`
    ]);
  };

  // Helper to fill only missing times, never overwrite user-provided times
  const fillMissingTimes = (schedule, startIdx = 0) => {
    const toMinutes = (timeStr) => {
      if (!timeStr) return 9 * 60;
      let time = timeStr.trim();
      let modifier = '';
      if (/am|pm/i.test(time)) {
        [time, modifier] = time.split(/\s+/);
        modifier = modifier.toUpperCase();
      }
      let [hours, minutes] = time.split(':').map(Number);
      if (isNaN(hours) || isNaN(minutes)) return 9 * 60;
      if (modifier) {
        if (modifier === 'PM' && hours !== 12) hours += 12;
        if (modifier === 'AM' && hours === 12) hours = 0;
      }
      return hours * 60 + minutes;
    };
    const toTimeStr = (mins) => {
      let hours = Math.floor(mins / 60);
      let minutes = mins % 60;
      let ampm = hours >= 12 ? 'PM' : 'AM';
      let displayHours = hours % 12;
      if (displayHours === 0) displayHours = 12;
      return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    };
    const updated = [...schedule];
    // Find the first segment with a time
    let mins = null;
    let anchorIdx = 0;
    for (let i = 0; i < updated.length; i++) {
      if (updated[i].time) {
        mins = toMinutes(updated[i].time);
        anchorIdx = i;
        break;
      }
    }
    if (mins === null) {
      mins = 9 * 60; // fallback only if no times at all
      anchorIdx = 0;
    }
    for (let i = anchorIdx; i < updated.length; i++) {
      if (i === anchorIdx && updated[i].time) {
        mins = toMinutes(updated[i].time); // preserve first segment's time
      } else if (!updated[i].time) {
        updated[i].time = toTimeStr(mins);
      }
      let duration = parseInt(updated[i].duration, 10);
      if (isNaN(duration) || duration < 0) duration = 0;
      mins += duration;
    }
    return updated;
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
      };
    });
    // Only fill missing times, never overwrite user-provided times
    const filled = fillMissingTimes(parsed);
    setSchedule(filled);
    setSummary((prev) => [...prev, 'Parsed schedule from input.']);
  };

  // File upload handler
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      pushHistory(schedule);
      const parsed = await parseExcelFile(file);
      // Find the first column that is either 'start time' or 'time' (case-insensitive)
      // and treat it as the anchor for the first segment's start time
      // (parseExcelFile should already map this, but we double-check here)
      let firstTimeIdx = parsed.findIndex(seg => seg.time && seg.time.trim());
      // If no times at all, fallback to 9:00 AM for the first segment
      if (firstTimeIdx === -1 && parsed.length > 0) {
        parsed[0].time = '09:00 AM';
        firstTimeIdx = 0;
      }
      // If ALL segments have a time, do not fill anything, just use as-is
      const allHaveTime = parsed.every(seg => seg.time && seg.time.trim());
      if (allHaveTime) {
        setSchedule(parsed);
        setSummary((prev) => [...prev, `Loaded schedule from file (all times preserved).`]);
      } else {
        // If any are missing, fill only missing times, but always preserve the first segment's time
        const withDefaults = parsed.map(seg => ({
          ...seg,
          duration: seg.duration || '30',
        }));
        // Always fill from the first segment with a time (or 0)
        const filled = fillMissingTimes(withDefaults, firstTimeIdx !== -1 ? firstTimeIdx : 0);
        setSchedule(filled);
        setSummary((prev) => [...prev, `Loaded schedule from file (missing times filled, start time preserved).`]);
      }
    } catch (err) {
      alert('Failed to parse file. Please upload a valid .xlsx or .csv with columns: Time, Duration, Segment, Presenter.');
    }
  };

  // Start editing a row
  const handleEdit = (idx) => {
    setEditIdx(idx);
    setEditValues(schedule[idx]);
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
  // Updated: Accept rollToTomorrow param for correct live highlighting and alert scheduling
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
              icon: '/styles/logo-mcaps.png',
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
    // Fill missing times
    const recalculated = recalculateTimes(newSchedule, index + 1);
    setSchedule(recalculated);
    setSummary((prev) => [
      ...prev,
      `Duplicated segment '${segToCopy.segment}' at position ${index + 2} and recalculated times.`
    ]);
  };


  // Collapse/expand all notes
  const handleToggleAllNotes = () => {
    setAllNotesExpanded(expanded => !expanded);
    setExpandedNotesIdx(expandedNotesIdx => allNotesExpanded ? null : 'all');
  };

  // Export to Excel (XLSX)
  const handleExportExcel = () => {
    if (!schedule.length) return;
    // Dynamically import xlsx only when needed
    import('xlsx').then(XLSX => {
      const ws = XLSX.utils.json_to_sheet(schedule.map(seg => ({
        Time: seg.time,
        Duration: seg.duration,
        Segment: seg.segment,
        Presenter: seg.presenter,
        Notes: seg.notes
      })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Schedule');
      XLSX.writeFile(wb, 'showflow-schedule.xlsx');
    });
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

  // Save schedule to localStorage for presenter view
  useEffect(() => {
    localStorage.setItem('showflow-schedule', JSON.stringify(schedule));
  }, [schedule]);

  // Clean up all timeouts/intervals on unmount
  useEffect(() => {
    return () => {
      // Clear alert timeouts
      alertTimeouts.current.forEach(timeoutId => clearTimeout(timeoutId));
      alertTimeouts.current = [];
      // Clear toast timeout
      if (toastTimeout.current) clearTimeout(toastTimeout.current);
    };
  }, []);

  // Mobile nav state
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // FAB handler: add segment at end
  const handleFabAddSegment = () => {
    handleAddSegment(schedule.length);
    if (isMobile()) window.scrollTo(0, document.body.scrollHeight);
  };

  return (
    <div className={['showflow-root', theme, highContrast ? 'high-contrast' : ''].join(' ')}>
      {/* Mobile Nav (hamburger) */}
      {isMobile() && (
        <nav className="showflow-mobile-nav" style={{marginBottom: 16}}>
          <img src={process.env.PUBLIC_URL ? process.env.PUBLIC_URL + '/styles/showflow-logo.png' : 'styles/showflow-logo.png'} alt="ShowFlow Logo" className="showflow-logo" />
          <button className="showflow-hamburger" aria-label="Open menu" onClick={() => setMobileNavOpen(v => !v)} style={{background: 'none', border: 'none', padding: 0, minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            {/* SVG hamburger icon for better visibility */}
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect y="7" width="32" height="4" rx="2" fill="#fff"/>
              <rect y="14" width="32" height="4" rx="2" fill="#fff"/>
              <rect y="21" width="32" height="4" rx="2" fill="#fff"/>
            </svg>
          </button>
        </nav>
      )}
      {/* Mobile nav drawer (simple) */}
      {isMobile() && mobileNavOpen && (
        <div style={{position:'fixed',top:54,left:0,right:0,background:'#232a5c',color:'#fff',zIndex:1002,padding:'18px 0',textAlign:'center'}}>
          <button className="showflow-btn" style={{width:'90%',margin:'8px 0'}} onClick={() => setMobileNavOpen(false)}>Close Menu</button>
          <button className="showflow-btn" style={{width:'90%',margin:'8px 0'}} onClick={toggleTheme}>{theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}</button>
          <button className="showflow-btn" style={{width:'90%',margin:'8px 0'}} onClick={handleUndo} disabled={history.length === 0}>Undo</button>
          <button className="showflow-btn" style={{width:'90%',margin:'8px 0'}} onClick={handleRedo} disabled={future.length === 0}>Redo</button>
          <button className="showflow-btn danger" style={{width:'90%',margin:'8px 0'}} onClick={() => { if(window.confirm('Are you sure you want to reset and clear the entire schedule?')) { setSchedule([]); setHistory([]); setFuture([]); setSummary([]); setAlerts([]); setAlertSegments([]); setExpandedNotesIdx(null); setAllNotesExpanded(false); } }}>Reset All</button>
        </div>
      )}
      {/* Toast/banner notification */}
      {toast.show && (
        <div className="showflow-toast">
          <span role="img" aria-label="Alert" style={{marginRight:8}}>🔔</span>
          {toast.message}
        </div>
      )}
      {/* Audio element for alert sound */}
      <audio ref={alertAudioRef} src="/styles/alert-chime.wav" preload="auto" />
      <header className="logo-only-header">
        <div className="logo-header-content">
          <img
            src={theme === 'dark' ? 'styles/showflowlogov3_dark.png' : 'styles/showflow-logo-new.png'}
            alt="Show Flow Agent Logo"
            className="prominent-logo"
          />
        </div>
      </header>
      <main className="showflow-main">
        {/* Floating sticky bar for current segment */}
        {currentIdx !== null && schedule[currentIdx] && (
          <div className="showflow-current-sticky">
            <span className="showflow-current-pulse" />
            <strong>Now:</strong> {schedule[currentIdx].segment}
            <span style={{marginLeft:8}}>{schedule[currentIdx].time}</span>
            {/* Session timer widget */}
            <span style={{marginLeft:16, color:'#6c7bbd', fontWeight:500}}>
              <span role="img" aria-label="timer">⏳</span> {Math.floor(segmentTimer/60)}:{(segmentTimer%60).toString().padStart(2,'0')} left
            </span>
            {overrunIdx === currentIdx && <span style={{color:'red',marginLeft:8}}>Overrun!</span>}
            {schedule[currentIdx+1] && (
              <span style={{marginLeft:24,opacity:0.7}}>
                <strong>Next Up:</strong> {schedule[currentIdx+1].segment} <span style={{marginLeft:8}}>{schedule[currentIdx+1].time}</span>
              </span>
            )}
          </div>
        )}
        {/* Schedule Input Section */}
        <section className="showflow-card">
          <h2>Import Schedule</h2>
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
        </section>
        {/* Schedule Table Display */}
        <section className="showflow-card">
          <h2>Current Schedule</h2>
          <button className="showflow-btn" style={{marginBottom:12}} onClick={handleToggleAllNotes}>
            {allNotesExpanded ? 'Collapse All Notes' : 'Expand All Notes'}
          </button>
          {schedule.length === 0 ? (
            <div className="showflow-empty" style={{textAlign:'center',padding:'32px 0'}}>
              <p style={{fontSize:'1.08em',marginBottom:16}}>
                You can build your schedule here by adding segments.<br />
                <span style={{color:'#6c7bd',fontSize:'0.98em'}}>Click below to get started!</span>
              </p>
              <button
                className="showflow-btn primary"
                style={{fontSize:'1.08em',padding:'12px 32px',marginTop:8}}
                onClick={() => handleAddSegment(0)}
              >
                + Start a New Schedule
              </button>
            </div>
          ) : (
            <div className="showflow-table-container">
              <table className="showflow-table">
                <thead>
                  <tr>
                    <th></th> {/* Alert icon column */}
                    <th></th> {/* Lock icon column */}
                    <th>{schedule[0]?.time ? 'Start Time' : 'Time'}</th>
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
                              )}                            </td>
                          </>
                        )}
                        {editIdx === i ? (
                          <>
                            <td>
                              <input
                                type="text"
                                name="time"
                                value={editValues.time || ''}
                                onChange={handleEditChange}
                                className="showflow-input"
                                style={{width:'6em'}}
                                placeholder="09:00 AM"
                                autoFocus
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                name="duration"
                                value={editValues.duration || ''}
                                onChange={handleEditChange}
                                className="showflow-input"
                                style={{width:'4em'}}
                                placeholder="30"
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                name="segment"
                                value={editValues.segment || ''}
                                onChange={handleEditChange}
                                className="showflow-input"
                                style={{width:'10em'}}
                                placeholder="Segment Name"
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                name="presenter"
                                value={editValues.presenter || ''}
                                onChange={handleEditChange}
                                className="showflow-input"
                                style={{width:'10em'}}
                                placeholder="Presenter Name"
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
                            {/* Removed notes column here for cleaner look */}
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
                            </td>
                            {/* On mobile, render icons at the end */}
                            {isMobile() && (
                              <td className="showflow-header-icons" style={{textAlign:'right',minWidth:64}}>
                                <button
                                  className="showflow-btn"
                                  style={{background:'none',border:'none',padding:0,cursor:'pointer'}}
                                  title={alertSegments.includes(i) ? 'Alert enabled' : 'Enable alert'}
                                  onClick={e => { e.stopPropagation(); toggleAlertSegment(i); }}
                                  tabIndex={0}
                                >
                                  <span style={{fontSize:'1.2em',color:alertSegments.includes(i)?'#232a5c':'#bbb'}}>
                                    {alertSegments.includes(i) ? '\ud83d\udd14' : '\ud83d\udd15'}
                                  </span>                                </button>
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
                </tbody>
              </table>
            </div>
          )}
        </section>
        {/* Summary/Action Log */}
        <section className="showflow-card">
          <h2>Action Log</h2>
          <div className="showflow-summary-container">
            <div className="showflow-summary-column">
              <h3>Recent Actions</h3>
              <ul className="showflow-summary-list">
                {summary.length === 0 && (
                  <div className="showflow-empty" style={{textAlign:'center',padding:'16px 0'}}>
                    <p style={{fontSize:'0.98em',marginBottom:8}}>No recent actions yet.</p>
                    <button className="showflow-btn" onClick={() => setSummary([])} style={{fontSize:'0.9em'}}>
                      Clear Log
                    </button>
                  </div>
                )}
                {summary.map((msg, idx) => (
                  <li key={idx} className="showflow-summary-item">
                    <span className="showflow-summary-dot" />
                    <span className="showflow-summary-text">{msg}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="showflow-summary-column">
              <h3>Scheduled Alerts</h3>
              <ul className="showflow-summary-list">
                {alerts.length === 0 && (
                  <div className="showflow-empty" style={{textAlign:'center',padding:'16px 0'}}>
                    <p style={{fontSize:'0.98em',marginBottom:8}}>No alerts scheduled.</p>
                    <button className="showflow-btn" onClick={() => setAlertSegments([])} style={{fontSize:'0.9em'}}>
                      Clear All Alerts
                    </button>
                  </div>
                )}
                {alerts.map((msg, idx) => (
                  <li key={idx} className="showflow-summary-item">
                    <span className="showflow-summary-dot" />
                    <span className="showflow-summary-text">{msg}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
        {/* Debug/Settings (hidden by default) */}
        {false && (
          <section className="showflow-card debug-section">
            <h2>Debug / Settings</h2>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <button className="showflow-btn" onClick={handleDebugNow}>Set Now to 10:05 AM</button>
              <button className="showflow-btn" onClick={handleResetDebugNow}>Reset Now</button>
              <div style={{display:'flex',gap:8}}>
                <button className="showflow-btn" onClick={() => setFontSize(fs => Math.max(0.5, fs - 0.1))}>A-</button>
                <button className="showflow-btn" onClick={() => setFontSize(fs => fs + 0.1)}>A+</button>
                <button className="showflow-btn" onClick={() => setHighContrast(hc => !hc)}>{highContrast ? 'Disable' : 'Enable'} High Contrast</button>
              </div>
              <button className="showflow-btn" onClick={toggleTheme}>{theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}</button>
            </div>
          </section>
        )}
      </main>
      {/* Desktop Undo/Redo/Reset buttons at bottom */}
      {!isMobile() && (
        <footer className="showflow-footer">
          <div className="footer-controls">
            <button className="showflow-btn" onClick={handleUndo} disabled={history.length === 0}>Undo</button>
            <button className="showflow-btn" onClick={handleRedo} disabled={future.length === 0}>Redo</button>
            <button className="showflow-btn danger" onClick={() => { if(window.confirm('Are you sure you want to reset and clear the entire schedule?')) { setSchedule([]); setHistory([]); setFuture([]); setSummary([]); setAlerts([]); setAlertSegments([]); setExpandedNotesIdx(null); setAllNotesExpanded(false); } }}>Reset All</button>
            <button className="showflow-btn" onClick={toggleTheme}>{theme === 'light' ? '\ud83c\udf19 Dark Mode' : '\u2600\ufe0f Light Mode'}</button>
          </div>
        </footer>
      )}
      {/* Shortcuts help modal */}
      {showShortcuts && (
        <div className="showflow-shortcuts-modal">
          <div className="showflow-shortcuts-content">
            <h2>Keyboard Shortcuts</h2>
            <button className="showflow-btn close" onClick={() => setShowShortcuts(false)}>✖️</button>
            <div className="showflow-shortcuts-list">
              <div className="showflow-shortcut-item">
                <div className="showflow-shortcut-key">Ctrl + Z</div>
                <div className="showflow-shortcut-desc">Undo</div>
              </div>
              <div className="showflow-shortcut-item">
                <div className="showflow-shortcut-key">Ctrl + Y</div>
                <div className="showflow-shortcut-desc">Redo</div>
              </div>
              <div className="showflow-shortcut-item">
                <div className="showflow-shortcut-key">A</div>
                <div className="showflow-shortcut-desc">Add Segment</div>
              </div>
              <div className="showflow-shortcut-item">
                <div className="showflow-shortcut-key">?</div>
                <div className="showflow-shortcut-desc">Show Shortcuts</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShowFlowAgent;
