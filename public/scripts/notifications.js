const notificationSettings = {
    enablePushNotifications: true,
    alertTime: 5 // minutes before the session starts
};

function showNotification(title, message) {
    if (Notification.permission === "granted") {
        new Notification(title, { body: message });
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                new Notification(title, { body: message });
            }
        });
    }
}

function scheduleNotification(session) {
    const sessionStartTime = new Date(session.startTime);
    const alertTime = new Date(sessionStartTime.getTime() - notificationSettings.alertTime * 60000);

    const now = new Date();
    if (now < alertTime) {
        const timeUntilAlert = alertTime - now;
        setTimeout(() => {
            showNotification("Upcoming Session", `The session "${session.title}" starts in ${notificationSettings.alertTime} minutes.`);
        }, timeUntilAlert);
    }
}

function initializeNotifications(sessions) {
    if (notificationSettings.enablePushNotifications) {
        sessions.forEach(session => {
            scheduleNotification(session);
        });
    }
}

document.addEventListener("DOMContentLoaded", () => {
    // Assuming sessions data is available
    const sessions = [
        { title: "Session 1", startTime: "2023-10-01T10:00:00" },
        { title: "Session 2", startTime: "2023-10-01T11:00:00" }
    ];
    initializeNotifications(sessions);
});