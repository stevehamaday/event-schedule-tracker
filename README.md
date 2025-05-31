# Event Schedule Tracker

## Overview
The Event Schedule Tracker is a web application designed to help users manage and track event schedules efficiently. It allows users to import schedules from Excel documents, adjust session durations, and receive notifications for upcoming sessions.

## Features
- **Import Live Event Schedule**: Users can upload an Excel document containing event schedules, which the application will parse and display.
- **Track Progress**: The application provides a visual representation of the current progress of events and sessions.
- **Adjust Session Durations**: Users can modify the duration of sessions as needed.
- **Countdown Timers**: Each upcoming session has a countdown timer to keep users informed of the time remaining.
- **Notifications**: Users can receive push notifications or on-screen alerts 5 minutes before the next scheduled session.

## Getting Started

### Prerequisites
- Node.js and npm installed on your machine.

### Installation
1. Clone the repository:
   ```
   git clone <repository-url>
   ```
2. Navigate to the project directory:
   ```
   cd event-schedule-tracker
   ```
3. Install the dependencies:
   ```
   npm install
   ```

### Running the Application
To start the application in development mode, run:
```
npm start
```
This will launch the application in your default web browser.

### Building for Production
To create a production build, run:
```
npm run build
```
This will generate optimized files for deployment in the `dist` directory.

## Usage
- Upload your event schedule in Excel format using the provided interface.
- View the list of events and their statuses.
- Adjust session durations as necessary.
- Monitor countdown timers for upcoming sessions.
- Enable notifications to receive alerts before sessions start.

## Contributing
Contributions are welcome! Please submit a pull request or open an issue for any enhancements or bug fixes.

## License
This project is licensed under the MIT License. See the LICENSE file for details.