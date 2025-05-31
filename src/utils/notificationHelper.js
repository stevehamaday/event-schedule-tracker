export const scheduleNotification = (session) => {
    const notificationTime = new Date(session.startTime - 5 * 60 * 1000); // 5 minutes before the session
    const now = new Date();

    if (notificationTime > now) {
        const timeout = notificationTime - now;
        setTimeout(() => {
            new Notification(`Upcoming Session: ${session.title}`, {
                body: `The session "${session.title}" is starting soon!`,
            });
        }, timeout);
    }
};

export const requestNotificationPermission = async () => {
    if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }
    return false;
};

export const showOnScreenAlert = (message) => {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'notification-alert';
    alertDiv.innerText = message;
    document.body.appendChild(alertDiv);

    setTimeout(() => {
        alertDiv.remove();
    }, 3000);
};