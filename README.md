# Event Schedule Tracker

## Overview
The Event Schedule Tracker is a web application designed to help users manage and track event schedules efficiently. It allows users to import schedules from Excel documents, adjust session durations, and receive notifications for upcoming sessions.

## Features
- **Import Live Event Schedule**: Users can upload an Excel document containing event schedules, which the application will parse and display.
- **Track Progress**: The application provides a visual representation of the current progress of events and sessions.
- **Adjust Session Durations**: Users can modify the duration of sessions as needed.
- **Countdown Timers**: Each upcoming session has a countdown timer to keep users informed of the time remaining.
- **Notifications**: Users can receive push notifications or on-screen alerts 5 minutes before the next scheduled session.
- **Speaker View**: Toggle to a distraction-free, large-text display showing only the current segment, time remaining, and next segment - perfect for speakers to see from a distance.

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

## Schedule Import Formats

### Recommended: CSV Format
For the most reliable schedule import, we recommend using **CSV files**:
- CSV files preserve text formatting exactly as entered
- Time values like "9:00 AM" are imported without conversion issues
- To create a CSV from Excel: File → Save As → CSV (Comma delimited)

### Excel Format (.xlsx)
While Excel files are supported, Excel's internal time storage can sometimes cause parsing issues. If you must use Excel format, follow these formatting tips:

#### Time Column Formatting:
- **Best Practice**: Format the Time column as **Text** instead of Time format
  - Select the Time column → Right-click → Format Cells → Text
  - Enter times as text: "9:00 AM", "2:30 PM", etc.
- **Alternative**: Use General format and enter times with AM/PM
- **Avoid**: Excel's built-in Time format (shows as clock icon)

#### Duration Column Formatting:
- Format as **General** or **Text**
- Enter durations as plain numbers (minutes): 30, 45, 60
- Or use text formats: "30 min", "1:30", "45m"

#### Column Headers:
Use these exact column names (case-insensitive):
- **Time**: Session start time (e.g., "9:00 AM")
- **Duration**: Session length in minutes (e.g., "30")
- **Segment**: Session/segment name (required)
- **Presenter**: Speaker name (optional)
- **Notes**: Additional information (optional)

#### Example Excel Setup:
```
Time        Duration    Segment             Presenter       Notes
9:00 AM     30          Opening Remarks     John Smith      Welcome session
9:30 AM     45          Keynote             Jane Doe        Main presentation
10:15 AM    15          Break               -               Coffee break
```

## Usage
- Upload your event schedule in CSV or Excel format using the provided interface.
- View the list of events and their statuses.
- Adjust session durations as necessary.
- Monitor countdown timers for upcoming sessions.
- Enable notifications to receive alerts before sessions start.
- Toggle **Speaker View** for a clean, large-text display perfect for speakers:
  - Click the "👁️ Speaker View" button in the footer, or press **F3**
  - Shows current segment, time remaining, and next segment in large, easy-to-read text
  - Features a gradient background using brand colors for professional appearance
  - Toggle back to normal view anytime without losing progress

## Contributing
Contributions are welcome! Please submit a pull request or open an issue for any enhancements or bug fixes.

## License
This project is licensed under the MIT License. See the LICENSE file for details.