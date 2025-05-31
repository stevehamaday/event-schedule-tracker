import React from 'react';
import SessionAdjuster from './SessionAdjuster';
import CountdownTimer from './CountdownTimer';

const EventList = ({ events, onSessionDurationChange }) => {
    return (
        <div className="event-list">
            <h2>Event Schedule</h2>
            <ul>
                {events.map((event, index) => (
                    <li key={index}>
                        <h3>{event.title}</h3>
                        <p>{event.description}</p>
                        <p>Duration: {event.duration} minutes</p>
                        <SessionAdjuster 
                            duration={event.duration} 
                            onChange={(newDuration) => onSessionDurationChange(index, newDuration)} 
                        />
                        <CountdownTimer duration={event.duration} />
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default EventList;