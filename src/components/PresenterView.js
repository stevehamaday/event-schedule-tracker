import React, { useEffect, useState } from 'react';
import './PresenterView.css'; // Import the CSS file for styles

const PresenterView = () => {
  const [schedule, setSchedule] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(null);
  const [segmentTimer, setSegmentTimer] = useState(0);
  const [totalTimer, setTotalTimer] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Load schedule from localStorage (shared by main app)
  useEffect(() => {
    const stored = localStorage.getItem('showflow-schedule');
    if (stored) {
      setSchedule(JSON.parse(stored));
    }
  }, []);

  // Find current segment
  useEffect(() => {
    if (!schedule.length) return;
    const now = new Date();
    let idx = null;
    for (let i = 0; i < schedule.length; i++) {
      const seg = schedule[i];
      if (!seg.time) continue;
      const [time, modifier] = seg.time.split(' ');
      let [hours, minutes] = time.split(':').map(Number);
      if (modifier) {
        if (modifier.toUpperCase() === 'PM' && hours !== 12) hours += 12;
        if (modifier.toUpperCase() === 'AM' && hours === 12) hours = 0;
      }
      const segDate = new Date();
      segDate.setHours(hours, minutes, 0, 0);
      const nextSeg = schedule[i + 1];
      let nextDate = null;
      if (nextSeg && nextSeg.time) {
        const [nt, nm] = nextSeg.time.split(' ');
        let [nh, nmin] = nt.split(':').map(Number);
        if (nm) {
          if (nm.toUpperCase() === 'PM' && nh !== 12) nh += 12;
          if (nm.toUpperCase() === 'AM' && nh === 12) nh = 0;
        }
        nextDate = new Date();
        nextDate.setHours(nh, nmin, 0, 0);
      }
      if (segDate <= now && (!nextDate || now < nextDate)) {
        idx = i;
        break;
      }
    }
    setCurrentIdx(idx);
  }, [schedule]);

  // Segment timer
  useEffect(() => {
    if (currentIdx === null || !schedule[currentIdx]) return;
    const seg = schedule[currentIdx];
    const [time, modifier] = seg.time.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (modifier) {
      if (modifier.toUpperCase() === 'PM' && hours !== 12) hours += 12;
      if (modifier.toUpperCase() === 'AM' && hours === 12) hours = 0;
    }
    const segDate = new Date();
    segDate.setHours(hours, minutes, 0, 0);
    let duration = parseInt(seg.duration, 10) || 0;
    const endDate = new Date(segDate.getTime() + duration * 60000);
    const updateTimer = () => {
      const now = new Date();
      const msLeft = endDate - now;
      setSegmentTimer(Math.max(0, Math.floor(msLeft / 1000)));
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [currentIdx, schedule]);

  // Total timer
  useEffect(() => {
    if (!schedule.length) return;
    const last = schedule[schedule.length - 1];
    if (!last.time) return;
    const [time, modifier] = last.time.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (modifier) {
      if (modifier.toUpperCase() === 'PM' && hours !== 12) hours += 12;
      if (modifier.toUpperCase() === 'AM' && hours === 12) hours = 0;
    }
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date();
    endDate.setHours(hours, minutes, 0, 0);
    let duration = parseInt(last.duration, 10) || 0;
    endDate.setTime(endDate.getTime() + duration * 60000);
    const updateTotal = () => {
      const now = new Date();
      const msLeft = endDate - now;
      setTotalTimer(Math.max(0, Math.floor(msLeft / 1000)));
    };
    updateTotal();
    const interval = setInterval(updateTotal, 1000);
    return () => clearInterval(interval);
  }, [schedule]);

  const toggleFullScreen = () => {
    if (!isFullScreen) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
    setIsFullScreen(!isFullScreen);
  };

  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
    };
  }, []);

  if (!schedule.length) {
    return (
      <div className="showflow-presenter-view showflow-presenter-empty">
        <h1>Presenter View</h1>
        <p>No schedule loaded. Please add segments in the main view.</p>
      </div>
    );
  }

  const currentSegment = currentIdx !== null ? schedule[currentIdx] : null;
  const nextSegments = currentIdx !== null ? schedule.slice(currentIdx + 1, currentIdx + 4) : [];

  return (
    <div className={`showflow-presenter-view ${isFullScreen ? 'fullscreen' : ''}`}>
      {currentSegment ? (
        <>
          <div className="showflow-presenter-current">
            <div className="showflow-presenter-label">Current Segment</div>
            <div className="showflow-presenter-title">{currentSegment.segment}</div>
            <div className="showflow-presenter-time">{currentSegment.time} ({currentSegment.duration})</div>
            {currentSegment.presenter && <div className="showflow-presenter-presenter">{currentSegment.presenter}</div>}
            <div className={`showflow-presenter-timer ${segmentTimer < 60 ? 'critical' : segmentTimer < 300 ? 'warning' : ''}`}>
              <span className="showflow-presenter-timer-text">
                {Math.floor(segmentTimer / 60)}:{(segmentTimer % 60).toString().padStart(2, '0')}
              </span>
            </div>
            {segmentTimer < 0 && <div className="showflow-presenter-overrun">OVERRUN</div>}
          </div>
          <div className="showflow-presenter-next">
            <div className="showflow-presenter-label">Up Next</div>
            {nextSegments.length > 0 ? (
              <ul className="showflow-presenter-next-list">
                {nextSegments.map((seg, idx) => (
                  <li key={idx}>
                    <span className="segment-title">{seg.segment}</span>
                    <span className="segment-time">{seg.time}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>End of schedule</p>
            )}
          </div>
        </>
      ) : (
        <div className="showflow-presenter-empty">
          <h1>Presenter View</h1>
          <p>Waiting for the show to start...</p>
        </div>
      )}
      <div className="showflow-presenter-controls">
        <button onClick={toggleFullScreen} className="showflow-btn">
          {isFullScreen ? 'Exit Fullscreen' : 'Go Fullscreen'}
        </button>
        <div className="showflow-total-timer">
          <strong>Total Time Left: </strong>
          {Math.floor(totalTimer / 60)}:{(totalTimer % 60).toString().padStart(2, '0')}
        </div>
      </div>
    </div>
  );
};

export default PresenterView;
