import React, { useState } from 'react';

const SessionAdjuster = ({ session, onUpdate }) => {
    const [duration, setDuration] = useState(session.duration);

    const increaseDuration = () => {
        setDuration(prevDuration => prevDuration + 1);
        onUpdate(session.id, duration + 1);
    };

    const decreaseDuration = () => {
        if (duration > 1) {
            setDuration(prevDuration => prevDuration - 1);
            onUpdate(session.id, duration - 1);
        }
    };

    return (
        <div className="session-adjuster">
            <h3>{session.title}</h3>
            <p>Current Duration: {duration} minutes</p>
            <button onClick={increaseDuration}>Increase Duration</button>
            <button onClick={decreaseDuration}>Decrease Duration</button>
        </div>
    );
};

export default SessionAdjuster;