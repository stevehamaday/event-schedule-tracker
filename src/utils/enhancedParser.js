import XLSX from 'xlsx';

/**
 * Enhanced parser with robust data validation and format detection
 * Handles multiple file formats, inconsistent headers, and data quality issues
 */

// Configuration for fuzzy column matching
const COLUMN_PATTERNS = {
  time: [
    'time', 'start', 'begin', 'when', 'schedule', 'hour', 'clock',
    'starttime', 'start_time', 'time_start', 'session_time', 'event_time'
  ],
  duration: [
    'duration', 'length', 'minutes', 'mins', 'runtime', 'period',
    'how_long', 'session_length', 'event_duration', 'min'
  ],
  segment: [
    'segment', 'session', 'topic', 'title', 'subject', 'activity', 'event',
    'agenda', 'item', 'description', 'what', 'content', 'session_name',
    'agenda_item', 'event_name', 'activity_name'
  ],
  presenter: [
    'presenter', 'speaker', 'host', 'facilitator', 'instructor', 'leader',
    'moderator', 'teacher', 'who', 'presenter_name', 'speaker_name',
    'facilitated_by', 'led_by', 'conducted_by'
  ],
  notes: [
    'notes', 'note', 'comments', 'remarks', 'details', 'info', 'information',
    'description', 'additional', 'misc', 'other', 'feedback', 'observations'
  ]
};

// Time format detection patterns
const TIME_PATTERNS = [
  /^\d{1,2}:\d{2}\s*(AM|PM)$/i,           // 9:00 AM, 12:30 PM
  /^\d{1,2}:\d{2}$/,                      // 9:00, 12:30 (24hr)
  /^\d{1,2}\.\d{2}\s*(AM|PM)$/i,          // 9.00 AM
  /^\d{1,2}:\d{2}:\d{2}\s*(AM|PM)?$/i,    // 9:00:00 AM, 9:00:00
  /^\d{1,2}h\d{2}$/i,                     // 9h00
  /^\d{1,4}$/,                            // 900, 1200 (military time)
];

// Duration format detection patterns
const DURATION_PATTERNS = [
  /(\d+)\s*min/i,                         // 30 min, 45 minutes
  /(\d+)\s*m/i,                           // 30m
  /(\d+)\s*hr/i,                          // 1 hr, 2 hours
  /(\d+)h\s*(\d+)m/i,                     // 1h30m
  /(\d+):(\d+)/,                          // 1:30 (hour:minute)
  /(\d+\.?\d*)/,                          // Plain numbers
];

/**
 * Normalize header text for fuzzy matching
 */
const normalizeHeader = (header) => {
  if (!header) return '';
  return header.toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/gi, '')
    .replace(/\s+/g, '');
};

/**
 * Calculate similarity score between two strings
 */
const calculateSimilarity = (str1, str2) => {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
};

/**
 * Levenshtein distance for string similarity
 */
const levenshteinDistance = (str1, str2) => {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
};

/**
 * Intelligent column mapping with fuzzy matching
 */
const mapColumns = (headers) => {
  const normalizedHeaders = headers.map(h => normalizeHeader(h));
  const mapping = {};
  
  // First pass: exact matches
  Object.keys(COLUMN_PATTERNS).forEach(fieldType => {
    const patterns = COLUMN_PATTERNS[fieldType];
    
    for (let i = 0; i < normalizedHeaders.length; i++) {
      const header = normalizedHeaders[i];
      
      // Check for exact matches first
      if (patterns.some(pattern => normalizeHeader(pattern) === header)) {
        if (!mapping[fieldType]) {
          mapping[fieldType] = { index: i, originalHeader: headers[i], confidence: 1.0 };
        }
        continue;
      }
    }
  });
  
  // Second pass: fuzzy matches for unmapped fields
  Object.keys(COLUMN_PATTERNS).forEach(fieldType => {
    if (mapping[fieldType]) return; // Already mapped
    
    const patterns = COLUMN_PATTERNS[fieldType];
    let bestMatch = { index: -1, confidence: 0, originalHeader: '' };
    
    for (let i = 0; i < normalizedHeaders.length; i++) {
      const header = normalizedHeaders[i];
      
      // Skip if this header is already mapped to another field
      const alreadyMapped = Object.values(mapping).some(m => m.index === i);
      if (alreadyMapped) continue;
      
      // Find best pattern match
      patterns.forEach(pattern => {
        const normalizedPattern = normalizeHeader(pattern);
        
        // Check if pattern is contained in header or vice versa
        const containsMatch = header.includes(normalizedPattern) || normalizedPattern.includes(header);
        const similarity = calculateSimilarity(header, normalizedPattern);
        
        let confidence = similarity;
        if (containsMatch) confidence = Math.max(confidence, 0.8);
        
        if (confidence > bestMatch.confidence && confidence > 0.6) {
          bestMatch = { index: i, confidence, originalHeader: headers[i] };
        }
      });
    }
    
    if (bestMatch.index !== -1) {
      mapping[fieldType] = bestMatch;
    }
  });
  
  return mapping;
};

/**
 * Detect and parse time formats (enhanced for Excel compatibility)
 */
const parseTime = (timeStr) => {
  if (!timeStr) return null;
  
  // Debug logging to understand what we're receiving
  console.log('parseTime received:', {
    value: timeStr,
    type: typeof timeStr,
    isDate: timeStr instanceof Date,
    constructor: timeStr?.constructor?.name
  });
  
  // Handle Date objects (from Excel)
  if (timeStr instanceof Date) {
    console.log('Processing Date object:', {
      fullDate: timeStr.toString(),
      hours: timeStr.getHours(),
      minutes: timeStr.getMinutes(),
      year: timeStr.getFullYear(),
      month: timeStr.getMonth(),
      date: timeStr.getDate()
    });
    
    const hours = timeStr.getHours();
    const minutes = timeStr.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const result = `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    console.log('Date object converted to:', result);
    return result;
  }
  
  // Handle Excel serial numbers (fraction of day)
  if (typeof timeStr === 'number') {
    console.log('Processing number:', {
      value: timeStr,
      isFraction: timeStr > 0 && timeStr < 1,
      totalMinutesCalc: Math.round(timeStr * 24 * 60)
    });
    
    if (timeStr > 0 && timeStr < 1) {
      const totalMinutes = Math.round(timeStr * 24 * 60);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      if (hours < 24) {
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        const result = `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
        console.log('Number converted to:', result);
        return result;
      }
    }
  }
  
  if (typeof timeStr !== 'string') {
    console.log('Unhandled type, returning null');
    return null;
  }
  
  const cleaned = timeStr.trim();
  console.log('Processing string:', cleaned);
  
  if (typeof timeStr !== 'string') {
    console.log('Unhandled type, returning null');
    return null;
  }
  
  const cleanedStr = timeStr.trim();
  console.log('Processing string:', cleanedStr);
  
  // Handle Excel time format like "1/0/00" (which represents time on Excel's epoch date)
  if (/^1\/0\/\d{2}$/.test(cleanedStr)) {
    console.log('Detected Excel time format 1/0/XX, treating as time-only value');
    // This is Excel's way of representing time - the last part might be minutes or a time indicator
    // For now, since all your times appear to be the same in the debug, let's try to extract from the original Excel data
    // This suggests the XLSX parsing isn't preserving the actual time values properly
    return null; // Let it fall through to default parsing
  }
  
  // Handle Excel date format like "1/0/00" - this might be a time representation
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(cleanedStr)) {
    console.log('Detected Excel date-like format:', cleanedStr);
    
    // Try parsing as Excel serial date
    try {
      const dateParts = cleanedStr.split('/');
      let month = parseInt(dateParts[0]);
      let day = parseInt(dateParts[1]); 
      let year = parseInt(dateParts[2]);
      
      console.log('Date parts:', { month, day, year });
      
      // If this looks like "1/0/00", it might be hours/minutes/seconds
      // or it could be an Excel time serial representation
      if (month <= 24 && day <= 59 && year <= 59) {
        // Treat as hour/minute/second or hour/minute/00
        const hours = month;
        const minutes = day;
        
        if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
          const ampm = hours >= 12 ? 'PM' : 'AM';
          const displayHours = hours % 12 || 12;
          const result = `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
          console.log('Interpreted as time H:M format:', result);
          return result;
        }
      }
      
      // Fallback: try as actual date
      const fullYear = year < 50 ? 2000 + year : (year < 100 ? 1900 + year : year);
      const dateObj = new Date(fullYear, month - 1, day);
      console.log('Parsed as date:', dateObj.toString());
      
      const hours = dateObj.getHours();
      const minutes = dateObj.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      const result = `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
      console.log('Date converted to time:', result);
      return result;
      
    } catch (error) {
      console.log('Error parsing Excel date format:', error);
    }
  }
  
  // Continue with existing time pattern matching using the cleaned string
  // Try each time pattern
  for (const pattern of TIME_PATTERNS) {
    if (pattern.test(cleanedStr)) {
      // Handle different formats
      if (pattern === TIME_PATTERNS[0] || pattern === TIME_PATTERNS[2]) {
        // Already in good format (9:00 AM, 9.00 AM)
        return cleanedStr.replace('.', ':');
      } else if (pattern === TIME_PATTERNS[1]) {
        // 24-hour format - convert to 12-hour
        const [hours, minutes] = cleanedStr.split(':').map(Number);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
      } else if (pattern === TIME_PATTERNS[3]) {
        // HH:MM:SS format with optional AM/PM - strip seconds
        const timeParts = cleanedStr.split(' ');
        const timeOnly = timeParts[0]; // "9:00:00"
        const modifier = timeParts[1]; // "AM" or "PM" if present
        const [hours, minutes] = timeOnly.split(':').map(Number);
        
        if (modifier) {
          // Already has AM/PM, just remove seconds and keep format
          return `${hours}:${minutes.toString().padStart(2, '0')} ${modifier.toUpperCase()}`;
        } else {
          // Convert from 24-hour to 12-hour
          const ampm = hours >= 12 ? 'PM' : 'AM';
          const displayHours = hours % 12 || 12;
          return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
        }
      } else if (pattern === TIME_PATTERNS[4]) {
        // 9h00 format
        const match = cleanedStr.match(/^(\d{1,2})h(\d{2})$/i);
        if (match) {
          const hours = parseInt(match[1]);
          const minutes = parseInt(match[2]);
          const ampm = hours >= 12 ? 'PM' : 'AM';
          const displayHours = hours % 12 || 12;
          return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
        }
      } else if (pattern === TIME_PATTERNS[5]) {
        // Military time (0900, 1400)
        const timeNum = parseInt(cleanedStr);
        const hours = Math.floor(timeNum / 100);
        const minutes = timeNum % 100;
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
      }
    }
  }
  
  // If no pattern matches, try to extract numbers and make a reasonable guess
  const numbers = cleanedStr.match(/\d+/g);
  if (numbers && numbers.length >= 1) {
    let hours = parseInt(numbers[0]);
    let minutes = numbers.length > 1 ? parseInt(numbers[1]) : 0;
    
    // If single number > 100, treat as military time
    if (numbers.length === 1 && hours > 100) {
      minutes = hours % 100;
      hours = Math.floor(hours / 100);
    }
    
    // Reasonable bounds checking
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    }
  }
  
  return cleanedStr; // Return as-is if we can't parse it
};

/**
 * Parse duration from various formats (enhanced for Excel compatibility)
 */
const parseDuration = (durationStr) => {
  if (!durationStr) return '';
  
  // Handle Excel numbers (duration in minutes)
  if (typeof durationStr === 'number') {
    const num = Math.round(durationStr);
    // Sanity check: duration should be reasonable (0-720 minutes = 12 hours max)
    if (num >= 0 && num <= 720) {
      return num.toString();
    }
    return '';
  }
  
  const str = durationStr.toString().trim();
  
  // Reject values that look like time formats (to prevent time/duration confusion)
  if (/^\d{1,2}:\d{2}(?::\d{2})?\s*(AM|PM)?$/i.test(str)) {
    // console.warn(`Rejecting time-like value for duration: "${str}"`);
    return ''; // Don't parse time values as durations
  }
  
  // First, handle simple numeric values (most common case)
  if (/^\d+$/.test(str)) {
    const num = parseInt(str, 10);
    // Sanity check: duration should be reasonable (0-720 minutes = 12 hours max)
    if (num >= 0 && num <= 720) {
      return str; // Return as-is for simple numbers like "2", "11", "20"
    }
    // console.warn(`Rejecting unreasonable numeric duration: "${str}" (${num} minutes)`);
    return '';
  }
  
  // Try each duration pattern for more complex formats
  for (const pattern of DURATION_PATTERNS) {
    const match = str.match(pattern);
    if (match) {
      if (pattern === DURATION_PATTERNS[0] || pattern === DURATION_PATTERNS[1]) {
        // 30 min, 30m
        return match[1];
      } else if (pattern === DURATION_PATTERNS[2]) {
        // 1 hr
        const hours = parseInt(match[1]) || 0;
        if (hours <= 12) { // Reasonable limit
          return (hours * 60).toString();
        }
        return '';
      } else if (pattern === DURATION_PATTERNS[3]) {
        // 1h30m
        const hours = parseInt(match[1]) || 0;
        const minutes = parseInt(match[2]) || 0;
        if (hours <= 12 && minutes < 60) { // Reasonable limits
          return (hours * 60 + minutes).toString();
        }
        return '';
      } else if (pattern === DURATION_PATTERNS[4]) {
        // 1:30 (hour:minute) - be very careful here as this can match times
        const hours = parseInt(match[1]) || 0;
        const minutes = parseInt(match[2]) || 0;
        // Only accept if it's clearly a duration (small hours value, no AM/PM context)
        if (hours >= 0 && hours <= 4 && minutes >= 0 && minutes < 60) {
          return (hours * 60 + minutes).toString();
        }
        // console.warn(`Rejecting time-like pattern for duration: "${str}"`);
        return ''; // Reject suspicious values that look like times
      } else if (pattern === DURATION_PATTERNS[5]) {
        // Plain number with potential decimal - already handled above
        const num = parseFloat(match[1]);
        if (num >= 0 && num <= 720) {
          return Math.floor(num).toString(); // Remove decimals
        }
        return '';
      }
    }
  }
  
  // Fallback: be very conservative
  const numbers = str.match(/^\d+$/);
  if (numbers) {
    const num = parseInt(numbers[0], 10);
    if (num >= 0 && num <= 720) {
      return numbers[0];
    }
  }
  
  return '';
};

/**
 * Detect data quality issues and provide suggestions
 */
const analyzeDataQuality = (data, mapping) => {
  const issues = [];
  const suggestions = [];
  
  // Check if we found essential columns
  if (!mapping.time) {
    issues.push('No time column detected');
    suggestions.push('Ensure you have a column with headers like: Time, Start, Schedule, etc.');
  }
  
  if (!mapping.segment) {
    issues.push('No segment/session column detected');
    suggestions.push('Ensure you have a column with headers like: Segment, Session, Topic, etc.');
  }
  
  // Check data completeness
  const emptyTimeRows = data.filter(row => !row.time || row.time.trim() === '').length;
  const emptySegmentRows = data.filter(row => !row.segment || row.segment.trim() === '').length;
  
  if (emptyTimeRows > data.length * 0.3) {
    issues.push(`${emptyTimeRows} rows missing time data`);
    suggestions.push('Consider filling in missing time values or removing incomplete rows');
  }
  
  if (emptySegmentRows > data.length * 0.3) {
    issues.push(`${emptySegmentRows} rows missing segment data`);
    suggestions.push('Consider adding descriptive segment names for better schedule clarity');
  }
  
  return { issues, suggestions };
};

/**
 * Enhanced main parsing function
 */
export const parseScheduleFile = (file, options = {}) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      return reject(new Error("No file provided"));
    }

    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = event.target.result;
        const isCSV = file.name.toLowerCase().endsWith('.csv');
        let headers, rawData;

        if (isCSV) {
          // Enhanced CSV parsing
          const lines = data.split(/\r?\n/).filter(line => line.trim());
          if (lines.length === 0) {
            return reject(new Error("Empty CSV file"));
          }
          
          // Detect delimiter more robustly
          const firstLine = lines[0];
          let delimiter = ',';
          const delimiters = ['\t', ';', '|', ','];
          let maxColumns = 0;
          
          delimiters.forEach(del => {
            const columns = firstLine.split(del).length;
            if (columns > maxColumns) {
              maxColumns = columns;
              delimiter = del;
            }
          });
          
          // Parse all rows
          const allRows = lines.map(line => line.split(delimiter).map(cell => cell.trim()));
          
          // Find header row (first row with reasonable content)
          let headerRowIndex = 0;
          for (let i = 0; i < Math.min(allRows.length, 3); i++) {
            const row = allRows[i];
            const hasText = row.some(cell => cell && /[a-zA-Z]/.test(cell));
            if (hasText) {
              headerRowIndex = i;
              break;
            }
          }
          
          headers = allRows[headerRowIndex];
          rawData = allRows.slice(headerRowIndex + 1);
          
        } else {
          // Enhanced XLSX parsing with better date/time handling
          const workbook = XLSX.read(data, { cellDates: true, cellText: false });
          const sheetName = workbook.SheetNames[0];
          
          if (!sheetName) {
            return reject(new Error("No valid sheets found in the file"));
          }
          
          const worksheet = workbook.Sheets[sheetName];
          
          // Get raw data with date conversion AND raw numeric values
          const jsonDataFormatted = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });
          const jsonDataRaw = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: true });
          
          console.log('Raw Excel data before processing (formatted):', {
            totalRows: jsonDataFormatted.length,
            firstFewRows: jsonDataFormatted.slice(0, 5),
          });
          
          console.log('Raw Excel data before processing (raw):', {
            totalRows: jsonDataRaw.length,
            firstFewRows: jsonDataRaw.slice(0, 5),
          });
          
          // Process data using both raw and formatted versions
          const processedJsonData = jsonDataFormatted.map((row, rowIndex) => {
            const rawRow = jsonDataRaw[rowIndex] || [];
            console.log(`Processing Excel row ${rowIndex}:`, { formatted: row, raw: rawRow });
            
            return row.map((cell, colIndex) => {
              const rawCell = rawRow[colIndex];
              console.log(`  Cell [${rowIndex}][${colIndex}]:`, {
                formattedValue: cell,
                rawValue: rawCell,
                formattedType: typeof cell,
                rawType: typeof rawCell,
                isDate: cell instanceof Date,
                rawIsNumber: typeof rawCell === 'number'
              });
              
              // If we have a raw numeric value that could be a time (fraction of day)
              if (typeof rawCell === 'number' && rawCell > 0 && rawCell < 1) {
                console.log(`    Processing raw time fraction: ${rawCell}`);
                const totalMinutes = Math.round(rawCell * 24 * 60);
                const hours = Math.floor(totalMinutes / 60);
                const minutes = totalMinutes % 60;
                if (hours < 24) {
                  const ampm = hours >= 12 ? 'PM' : 'AM';
                  const displayHours = hours % 12 || 12;
                  const result = `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
                  console.log(`    Raw time fraction ${rawCell} converted to: ${result}`);
                  return result;
                }
              }
              
              // Special handling for Excel "time" cells that show as problematic date strings
              if (typeof cell === 'string' && /^1\/0\/\d{2}$/.test(cell) && typeof rawCell === 'number') {
                console.log(`    Converting problematic Excel time format: formatted="${cell}", raw=${rawCell}`);
                if (rawCell > 0 && rawCell < 1) {
                  const totalMinutes = Math.round(rawCell * 24 * 60);
                  const hours = Math.floor(totalMinutes / 60);
                  const minutes = totalMinutes % 60;
                  const ampm = hours >= 12 ? 'PM' : 'AM';
                  const displayHours = hours % 12 || 12;
                  const result = `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
                  console.log(`    Converted to: ${result}`);
                  return result;
                }
              }
              
              // Handle Excel date/time objects
              if (cell instanceof Date) {
                console.log(`    Date processing:`, {
                  fullDate: cell.toString(),
                  year: cell.getFullYear(),
                  month: cell.getMonth(),
                  date: cell.getDate(),
                  hours: cell.getHours(),
                  minutes: cell.getMinutes()
                });
                
                // Check if this looks like a time (hours < 24 and year is 1900)
                if (cell.getFullYear() === 1900 && cell.getMonth() === 0 && cell.getDate() === 1) {
                  // This is likely a time value
                  const hours = cell.getHours();
                  const minutes = cell.getMinutes();
                  const ampm = hours >= 12 ? 'PM' : 'AM';
                  const displayHours = hours % 12 || 12;
                  const result = `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
                  console.log(`    Time-only date converted to: ${result}`);
                  return result;
                } else {
                  // This is likely a full date/time - extract time part
                  const hours = cell.getHours();
                  const minutes = cell.getMinutes();
                  const ampm = hours >= 12 ? 'PM' : 'AM';
                  const displayHours = hours % 12 || 12;
                  const result = `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
                  console.log(`    Full date converted to: ${result}`);
                  return result;
                }
              }
              
              // Handle Excel serial numbers that might be times
              if (typeof cell === 'number' && cell > 0 && cell < 1) {
                console.log(`    Processing formatted fraction: ${cell}`);
                // This could be a time represented as fraction of a day
                const totalMinutes = Math.round(cell * 24 * 60);
                const hours = Math.floor(totalMinutes / 60);
                const minutes = totalMinutes % 60;
                if (hours < 24) {
                  const ampm = hours >= 12 ? 'PM' : 'AM';
                  const displayHours = hours % 12 || 12;
                  const result = `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
                  console.log(`    Formatted fraction converted to: ${result}`);
                  return result;
                }
              }
              
              console.log(`    Returning unchanged: ${cell}`);
              return cell;
            });
          });
          
          const jsonDataToUse = processedJsonData;
          
          if (jsonDataToUse.length === 0) {
            return reject(new Error("Empty worksheet"));
          }
          
          // Find header row
          let headerRowIndex = 0;
          for (let i = 0; i < Math.min(jsonDataToUse.length, 3); i++) {
            const row = jsonDataToUse[i];
            const hasText = row.some(cell => cell && typeof cell === 'string' && /[a-zA-Z]/.test(cell));
            if (hasText) {
              headerRowIndex = i;
              break;
            }
          }
          
          headers = jsonDataToUse[headerRowIndex];
          rawData = jsonDataToUse.slice(headerRowIndex + 1);
        }

        // Map columns intelligently
        const columnMapping = mapColumns(headers);
        
        // Process data with enhanced parsing
        const processedData = rawData
          .filter(row => row.some(cell => cell && cell.toString().trim())) // Remove empty rows
          .map((row, rowIndex) => {
            const processedRow = {};
            
            // Map each field type
            Object.keys(COLUMN_PATTERNS).forEach(fieldType => {
              const mapping = columnMapping[fieldType];
              let value = '';
              
              if (mapping && row[mapping.index] !== undefined) {
                const rawValue = row[mapping.index].toString().trim();
                
                // Apply field-specific processing with strict validation
                if (fieldType === 'time') {
                  value = parseTime(rawValue) || rawValue;
                } else if (fieldType === 'duration') {
                  // Double-check that we're not processing time values as duration
                  if (!/^\d{1,2}:\d{2}(?::\d{2})?\s*(AM|PM)?$/i.test(rawValue)) {
                    value = parseDuration(rawValue) || rawValue;
                  } else {
                    // If a time-like value ended up in duration column, keep it empty
                    value = '';
                    console.warn(`Skipping time-like value "${rawValue}" in duration column for row ${rowIndex + 1}`);
                  }
                } else {
                  value = rawValue;
                }
              }
              
              processedRow[fieldType] = value;
            });
            
            return processedRow;
          })
          .filter(row => row.time || row.segment); // Keep rows with at least time or segment

        // Analyze data quality
        const qualityAnalysis = analyzeDataQuality(processedData, columnMapping);
        
        // Prepare result
        const result = {
          data: processedData.map(row => ({
            time: row.time || '',
            duration: row.duration || '',
            segment: row.segment || '',
            presenter: row.presenter || '',
            notes: row.notes || ''
          })),
          metadata: {
            originalHeaders: headers,
            columnMapping: Object.fromEntries(
              Object.entries(columnMapping).map(([key, value]) => [key, {
                header: value.originalHeader,
                confidence: value.confidence
              }])
            ),
            qualityAnalysis,
            rowCount: processedData.length,
            fileName: file.name
          }
        };
        
        resolve(result);
        
      } catch (error) {
        console.error("Enhanced parsing error:", error);
        reject(new Error(`Failed to parse file: ${error.message}`));
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    // Read file based on type
    if (file.name.toLowerCase().endsWith('.csv')) {
      reader.readAsText(file, 'UTF-8');
    } else {
      reader.readAsArrayBuffer(file);
    }
  });
};

/**
 * Enhanced paste parsing for clipboard data
 */
export const parseClipboardData = (textData) => {
  if (!textData || typeof textData !== 'string') {
    throw new Error("No valid text data provided");
  }
  
  const lines = textData.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) {
    throw new Error("Empty data");
  }
  
  // Detect delimiter
  const firstLine = lines[0];
  let delimiter = '\t'; // Default to tab (common for copy-paste from Excel)
  
  if (firstLine.includes('\t')) delimiter = '\t';
  else if (firstLine.includes('|')) delimiter = '|';
  else if (firstLine.includes(';')) delimiter = ';';
  else if (firstLine.includes(',')) delimiter = ',';
  else if (/\s{2,}/.test(firstLine)) delimiter = /\s{2,}/;
  
  // Parse rows
  const allRows = lines.map(line => 
    typeof delimiter === 'string' 
      ? line.split(delimiter).map(cell => cell.trim())
      : line.split(delimiter).map(cell => cell.trim())
  );
  
  // Assume first row is headers unless it looks like data
  let headerRowIndex = 0;
  const firstRow = allRows[0];
  const looksLikeData = firstRow.some(cell => 
    TIME_PATTERNS.some(pattern => pattern.test(cell)) ||
    DURATION_PATTERNS.some(pattern => pattern.test(cell))
  );
  
  let headers, dataRows;
  if (looksLikeData && allRows.length > 1) {
    // Generate generic headers
    headers = firstRow.map((_, i) => `Column ${i + 1}`);
    dataRows = allRows;
  } else {
    headers = firstRow;
    dataRows = allRows.slice(1);
  }
  
  // Map columns and process data
  const columnMapping = mapColumns(headers);
  
  const processedData = dataRows
    .filter(row => row.some(cell => cell && cell.toString().trim()))
    .map((row, rowIndex) => {
      const processedRow = {};
      
      Object.keys(COLUMN_PATTERNS).forEach(fieldType => {
        const mapping = columnMapping[fieldType];
        let value = '';
        
        if (mapping && row[mapping.index] !== undefined) {
          const rawValue = row[mapping.index].toString().trim();
          
          if (fieldType === 'time') {
            value = parseTime(rawValue) || rawValue;
          } else if (fieldType === 'duration') {
            // Double-check that we're not processing time values as duration
            if (!/^\d{1,2}:\d{2}(?::\d{2})?\s*(AM|PM)?$/i.test(rawValue)) {
              value = parseDuration(rawValue) || rawValue;
            } else {
              // If a time-like value ended up in duration column, keep it empty
              value = '';
              console.warn(`Skipping time-like value "${rawValue}" in duration column for row ${rowIndex + 1}`);
            }
          } else {
            value = rawValue;
          }
        }
        
        processedRow[fieldType] = value;
      });
      
      return processedRow;
    })
    .filter(row => row.time || row.segment);

  const qualityAnalysis = analyzeDataQuality(processedData, columnMapping);
  
  return {
    data: processedData.map(row => ({
      time: row.time || '',
      duration: row.duration || '',
      segment: row.segment || '',
      presenter: row.presenter || '',
      notes: row.notes || ''
    })),
    metadata: {
      originalHeaders: headers,
      columnMapping: Object.fromEntries(
        Object.entries(columnMapping).map(([key, value]) => [key, {
          header: value.originalHeader,
          confidence: value.confidence
        }])
      ),
      qualityAnalysis,
      rowCount: processedData.length,
      source: 'clipboard'
    }
  };
};
