# Enhanced Schedule Parsing - Robust Data Import System

## Overview

The enhanced parsing system provides robust handling of various file formats, column headers, and data quality issues to ensure reliable schedule imports even with inconsistent or poorly formatted data.

## Key Features

### 🔍 **Intelligent Column Detection**
- **Fuzzy Matching**: Uses string similarity algorithms to match column headers even when they don't match exactly
- **Multiple Header Variations**: Recognizes dozens of common header variations for each field type
- **Confidence Scoring**: Provides confidence scores for column mappings to alert users to potential issues

#### Supported Header Variations

**Time Columns**: `time`, `start`, `begin`, `when`, `schedule`, `hour`, `clock`, `starttime`, `start_time`, `session_time`, etc.

**Duration Columns**: `duration`, `length`, `minutes`, `mins`, `runtime`, `period`, `session_length`, `event_duration`, etc.

**Segment Columns**: `segment`, `session`, `topic`, `title`, `subject`, `activity`, `event`, `agenda`, `item`, `description`, etc.

**Presenter Columns**: `presenter`, `speaker`, `host`, `facilitator`, `instructor`, `leader`, `moderator`, `teacher`, etc.

**Notes Columns**: `notes`, `comments`, `remarks`, `details`, `info`, `information`, `feedback`, `observations`, etc.

### 📅 **Advanced Time Format Recognition**

The system recognizes multiple time formats:

- **12-hour**: `9:00 AM`, `12:30 PM`, `9.00 AM`
- **24-hour**: `09:00`, `14:30`, `23:45`
- **Military**: `0900`, `1430`, `2345`
- **Variations**: `9h00`, `14:30:00`

### ⏱️ **Flexible Duration Parsing**

Supports various duration formats:

- **Plain numbers**: `30`, `45`, `120`
- **With units**: `30 min`, `45 minutes`, `1 hr`, `2 hours`
- **Abbreviated**: `30m`, `1h`, `90m`
- **Combined**: `1h30m`, `2h15m`
- **Time format**: `1:30`, `0:45`

### 🎯 **Data Quality Analysis**

#### Automatic Issue Detection
- **Missing required fields** (time, segment)
- **Invalid format** issues
- **Unusually long durations** (>8 hours)
- **Zero durations** that might cause issues
- **Time conflicts** and overlaps
- **Large time gaps** (>2 hours)
- **Duplicate segments**

#### Quality Scoring
- **Overall data quality score** (0-100%)
- **Error vs. warning classification**
- **Row-level validation**
- **Field-specific suggestions**

### 🔧 **Auto-Cleaning Features**

#### Smart Data Correction
- **Time format standardization** to 12-hour AM/PM format
- **Duration normalization** to minute values
- **Text trimming** and whitespace cleanup
- **Field length limiting** to prevent UI issues
- **Default value assignment** for missing durations

#### Validation Rules
- **Time format validation** with helpful error messages
- **Duration range checking** (reasonable limits)
- **Required field validation**
- **Character limit enforcement**

### 📊 **Enhanced File Support**

#### Multiple File Formats
- **Excel files** (.xlsx) with advanced worksheet parsing
- **CSV files** with intelligent delimiter detection
- **Tab-separated** clipboard data
- **Pipe-delimited** formats
- **Multi-space** separated data

#### Robust CSV Handling
- **Multiple delimiter detection** (comma, tab, semicolon, pipe)
- **Header row detection** (smart detection of first data row)
- **Text encoding support** (UTF-8)
- **Quote handling** for fields with embedded delimiters

### 🖥️ **Interactive Preview System**

#### Before-Import Preview
- **Data quality overview** with visual indicators
- **Column mapping display** with confidence indicators
- **Error and warning summaries**
- **Raw vs. processed data comparison**
- **Auto-clean toggle** option

#### Preview Features
- **Quality score visualization** with color coding
- **Issue categorization** (errors vs. warnings)
- **Recommendations** for data improvement
- **Accept/reject workflow**
- **Metadata display** (file info, row counts)

### 🚀 **Performance Optimizations**

#### Efficient Processing
- **Streaming file reading** for large files
- **Lazy evaluation** of quality checks
- **Optimized string matching** algorithms
- **Memory-efficient** data structures

#### Error Resilience
- **Graceful fallback** to original parser if enhanced parsing fails
- **Partial success handling** (import valid rows, report invalid ones)
- **User-friendly error messages**
- **Detailed logging** for debugging

## Usage Examples

### Basic File Upload
```javascript
// Enhanced parser automatically handles various formats
const result = await parseScheduleFile(file);
// result.data contains cleaned schedule data
// result.metadata contains parsing information
```

### Clipboard Data Parsing
```javascript
// Parse copied data from Excel, Google Sheets, etc.
const result = parseClipboardData(clipboardText);
// Handles tab-separated, comma-separated, and other formats
```

### Data Validation
```javascript
import { validateSchedule, generateQualityReport } from './utils/dataValidation';

const validation = validateSchedule(scheduleData);
const report = generateQualityReport(scheduleData, metadata);
```

## Configuration Options

### Parser Settings
```javascript
const options = {
  strictMode: false,        // Allow fuzzy matching
  autoClean: true,          // Apply automatic corrections
  requireTime: true,        // Require time column
  requireSegment: true,     // Require segment column
  maxDuration: 480,         // Maximum duration in minutes
  timeFormat: '12hour'      // Preferred time format
};
```

### Validation Rules
```javascript
const customRules = {
  maxSegmentLength: 200,    // Characters
  maxPresenterLength: 100,  // Characters
  maxNotesLength: 500,      // Characters
  warnOnLongDuration: 240,  // Minutes
  flagTimeGaps: 120         // Minutes
};
```

## Integration Guide

### 1. Replace File Upload Handler
```javascript
// Old approach
const handleFileUpload = async (file) => {
  const data = await parseExcelFile(file);
  setSchedule(data);
};

// New enhanced approach
const handleFileUpload = async (file) => {
  const result = await parseScheduleFile(file);
  setPreviewData(result);
  setShowPreviewModal(true);
};
```

### 2. Add Preview Modal
```jsx
<DataPreviewModal
  isOpen={showPreviewModal}
  onClose={handleRejectPreview}
  parseResult={previewData}
  onAccept={handleAcceptPreview}
  onReject={handleRejectPreview}
/>
```

### 3. Handle Preview Results
```javascript
const handleAcceptPreview = (cleanedData) => {
  const withDefaults = cleanedData.map(seg => ({
    ...seg,
    duration: seg.duration || '30'
  }));
  
  const recalculated = recalculateTimes(withDefaults, 'preserve');
  setSchedule(recalculated);
  setShowPreviewModal(false);
};
```

## Error Handling

### Common Issues and Solutions

#### "No time column detected"
- **Cause**: Time column header not recognized
- **Solution**: Add more time header variations or use manual mapping
- **Prevention**: Ensure time columns have recognizable headers

#### "High number of warnings"
- **Cause**: Inconsistent data formatting
- **Solution**: Use auto-clean feature or manually clean source data
- **Prevention**: Standardize data format before import

#### "Low confidence column mapping"
- **Cause**: Ambiguous or unusual column headers
- **Solution**: Review and confirm column mappings
- **Prevention**: Use standard column names

### Debug Information

The enhanced parser provides detailed debug information:

```javascript
const debugInfo = {
  originalHeaders: ['Time', 'Session', 'Who', 'How Long'],
  columnMapping: {
    time: { header: 'Time', confidence: 1.0 },
    segment: { header: 'Session', confidence: 0.95 },
    presenter: { header: 'Who', confidence: 0.85 },
    duration: { header: 'How Long', confidence: 0.90 }
  },
  qualityAnalysis: {
    issues: [...],
    suggestions: [...],
    recommendations: [...]
  }
};
```

## Best Practices

### For Users
1. **Use descriptive column headers** that include key words like "time", "duration", "session"
2. **Keep time formats consistent** within a single file
3. **Include units for durations** when possible (e.g., "30 min" vs just "30")
4. **Review the preview** before accepting data imports
5. **Use the auto-clean feature** for quick fixes

### For Developers
1. **Always use the preview modal** for user imports
2. **Handle parsing errors gracefully** with fallback options
3. **Provide clear error messages** based on validation results
4. **Monitor column mapping confidence** scores
5. **Test with various file formats** and edge cases

## Performance Considerations

### File Size Limits
- **Recommended**: <10MB files for optimal performance
- **Maximum**: 50MB files supported
- **Large files**: Consider chunked processing for >100MB

### Memory Usage
- **Efficient**: Uses streaming for file reading
- **Memory footprint**: ~2x file size during processing
- **Cleanup**: Automatic garbage collection after processing

## Future Enhancements

### Planned Features
- **Custom column mapping** interface
- **Template saving** for recurring import formats
- **Batch file processing**
- **Advanced time zone handling**
- **Integration with calendar systems**
- **Export format validation**

### API Improvements
- **Plugin architecture** for custom parsers
- **Machine learning** for improved column detection
- **Real-time validation** as users type
- **Collaborative parsing** with team templates
