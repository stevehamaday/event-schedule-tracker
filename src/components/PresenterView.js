import React, { useEffect, useState } from 'react';

const PresenterView = () => {
  const [schedule, setSchedule] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(null);
  const [segmentTimer, setSegmentTimer] = useState(0);
  const [totalTimer, setTotalTimer] = useState(0);

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

  if (!schedule.length) {
    return <div style={{padding:32, textAlign:'center'}}><h2>Presenter View</h2><p>No schedule loaded.</p></div>;
  }

  return (
    <div style={{ padding: 24, maxWidth: 600, margin: '0 auto', fontSize: '1.18em', background: '#f8fafd', borderRadius: 12, boxShadow: '0 2px 12px #0001' }}>
      <h2 style={{textAlign:'center'}}>Presenter View</h2>
      {currentIdx !== null && schedule[currentIdx] && (
        <div style={{margin:'18px 0', background:'#e9ecf5', borderRadius:10, padding:18, textAlign:'center'}}>
          <strong style={{fontSize:'1.1em'}}>Current Segment:</strong><br />
          <span style={{fontSize:'1.3em', fontWeight:600}}>{schedule[currentIdx].segment}</span><br />
          <span style={{color:'#232a5c'}}>{schedule[currentIdx].time} ({schedule[currentIdx].duration})</span>
          <div style={{marginTop:10, color:'#6c7bbd', fontWeight:500}}>
            <span role="img" aria-label="timer">⏳</span> {Math.floor(segmentTimer/60)}:{(segmentTimer%60).toString().padStart(2,'0')} left
          </div>
          {schedule[currentIdx].notes && (
            <div style={{marginTop:10, color:'#555'}}><strong>Notes:</strong> {schedule[currentIdx].notes}</div>
          )}
        </div>
      )}
      <div style={{margin:'18px 0'}}>
        <strong>Next Segments:</strong>
        <ul style={{paddingLeft:18}}>
          {schedule.slice(currentIdx+1, currentIdx+4).map((seg, idx) => (
            <li key={idx} style={{marginBottom:6}}>
              <span style={{fontWeight:600}}>{seg.segment}</span> <span style={{color:'#6c7bbd'}}>{seg.time}</span>
            </li>
          ))}
        </ul>
      </div>
      <div style={{margin:'18px 0', textAlign:'center'}}>
        <strong>Total Time Left in Schedule:</strong><br />
        <span style={{fontSize:'1.2em', color:'#232a5c'}}>{Math.floor(totalTimer/60)}:{(totalTimer%60).toString().padStart(2,'0')}</span>
      </div>
    </div>
  );
};

export default PresenterView;
