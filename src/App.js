import React, { useState, useEffect } from 'react';
import EventList from './components/EventList.js';
import SessionAdjuster from './components/SessionAdjuster.js';
import CountdownTimer from './components/CountdownTimer.js';
import { scheduleNotification } from './utils/notificationHelper.js';
import ShowFlowAgent from './components/EventScheduleManager.js';
import PresenterView from './components/PresenterView.js';

const App = () => {
    const [events, setEvents] = useState([]);
    const [currentEvent, setCurrentEvent] = useState(null);
    const [timer, setTimer] = useState(null);
    const [schedule, setSchedule] = useState([]); // or get from context/store
    const [presenterView, setPresenterView] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            // Removed parseExcelData usage
        };
        fetchData();
    }, []);

    useEffect(() => {
        if (currentEvent) {
            const countdown = new CountdownTimer(currentEvent.duration);
            setTimer(countdown);
            countdown.start();

            const notificationTimeout = setTimeout(() => {
                scheduleNotification(currentEvent.title);
            }, (currentEvent.duration - 5) * 60 * 1000);

            return () => {
                countdown.stop();
                clearTimeout(notificationTimeout);
            };
        }
    }, [currentEvent]);

    const handleSessionAdjustment = (adjustedDuration) => {
        if (currentEvent) {
            setCurrentEvent({ ...currentEvent, duration: adjustedDuration });
        }
    };

    // Simple route switch (for demo, not using react-router)
    if (window.location.pathname === '/presenter') {
        return <PresenterView schedule={schedule} />;
    }

    return (
        <div className="App">
            {/* Mobile nav and FAB are handled inside ShowFlowAgent */}
            <ShowFlowAgent />
        </div>
    );
};

export default App;