/**
 * Data validation and cleaning utilities for schedule data
 */

export const ValidationRules = {
  TIME: {
    name: 'Time Format',
    validate: (value) => {
      if (!value) return { valid: false, message: 'Time is required' };
      
      const timePatterns = [
        /^\d{1,2}:\d{2}\s*(AM|PM)$/i,
        /^\d{1,2}:\d{2}$/,
        /^\d{1,2}\.\d{2}\s*(AM|PM)$/i,
      ];
      
      const isValid = timePatterns.some(pattern => pattern.test(value.trim()));
      return {
        valid: isValid,
        message: isValid ? '' : 'Invalid time format. Use formats like "9:00 AM" or "14:30"'
      };
    },
    suggest: (value) => {
      if (!value) return '9:00 AM';
      
      // Try to extract numbers and format properly
      const numbers = value.match(/\d+/g);
      if (numbers && numbers.length >= 1) {
        let hours = parseInt(numbers[0]);
        let minutes = numbers.length > 1 ? parseInt(numbers[1]) : 0;
        
        if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
          const ampm = hours >= 12 ? 'PM' : 'AM';
          const displayHours = hours % 12 || 12;
          return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
        }
      }
      
      return value;
    }
  },

  DURATION: {
    name: 'Duration Format',
    validate: (value) => {
      if (!value) return { valid: true, message: '' }; // Duration is optional
      
      const durationPatterns = [
        /^\d+$/,                    // Plain number
        /^\d+\s*min/i,             // 30 min
        /^\d+\s*m$/i,              // 30m
        /^\d+:\d+$/,               // 1:30
        /^\d+h\s*\d*m?$/i,         // 1h30m
      ];
      
      const isValid = durationPatterns.some(pattern => pattern.test(value.trim()));
      return {
        valid: isValid,
        message: isValid ? '' : 'Invalid duration format. Use formats like "30", "30 min", or "1:30"'
      };
    },
    suggest: (value) => {
      if (!value) return '30';
      
      // Extract just the numbers for a clean duration
      const numbers = value.match(/\d+/g);
      if (numbers && numbers.length > 0) {
        return numbers[0];
      }
      
      return '30';
    }
  },

  SEGMENT: {
    name: 'Segment Name',
    validate: (value) => {
      if (!value || value.trim() === '') {
        return { valid: false, message: 'Segment name is required' };
      }
      
      if (value.length > 200) {
        return { valid: false, message: 'Segment name is too long (max 200 characters)' };
      }
      
      return { valid: true, message: '' };
    },
    suggest: (value) => {
      if (!value || value.trim() === '') return 'Untitled Segment';
      return value.trim().slice(0, 200);
    }
  },

  PRESENTER: {
    name: 'Presenter Name',
    validate: (value) => {
      // Presenter is optional but should be reasonable if provided
      if (value && value.length > 100) {
        return { valid: false, message: 'Presenter name is too long (max 100 characters)' };
      }
      
      return { valid: true, message: '' };
    },
    suggest: (value) => {
      if (!value) return '';
      return value.trim().slice(0, 100);
    }
  },

  NOTES: {
    name: 'Notes',
    validate: (value) => {
      // Notes are optional but should be reasonable if provided
      if (value && value.length > 500) {
        return { valid: false, message: 'Notes are too long (max 500 characters)' };
      }
      
      return { valid: true, message: '' };
    },
    suggest: (value) => {
      if (!value) return '';
      return value.trim().slice(0, 500);
    }
  }
};

/**
 * Validate a single schedule row
 */
export const validateScheduleRow = (row, index) => {
  const errors = [];
  const warnings = [];
  const suggestions = {};

  Object.keys(ValidationRules).forEach(field => {
    const fieldName = field.toLowerCase();
    const rule = ValidationRules[field];
    const value = row[fieldName];
    
    const validation = rule.validate(value);
    
    if (!validation.valid) {
      errors.push({
        field: fieldName,
        message: validation.message,
        row: index
      });
      
      // Provide suggestion for fixing
      suggestions[fieldName] = rule.suggest(value);
    }
  });

  // Additional business logic validations
  if (row.time && row.duration) {
    const timeValue = row.time.toString().trim();
    const durationValue = row.duration.toString().trim();
    
    // Check for reasonable durations - improved parsing
    let durationNum = 0;
    
    // First try direct integer parsing for simple cases
    if (/^\d+$/.test(durationValue)) {
      durationNum = parseInt(durationValue, 10);
    } else {
      // For more complex formats, extract just numbers
      const numericOnly = durationValue.replace(/[^0-9]/g, '');
      durationNum = parseInt(numericOnly, 10) || 0;
    }
    
    // More reasonable threshold for duration warnings
    if (durationNum > 480) { // More than 8 hours (480 minutes)
      warnings.push({
        field: 'duration',
        message: `Duration seems unusually long (${durationNum} minutes = ${Math.round(durationNum/60*10)/10} hours)`,
        row: index
      });
    }
    
    if (durationNum === 0 && durationValue !== '0') {
      warnings.push({
        field: 'duration',
        message: 'Duration could not be parsed or is zero',
        row: index
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions
  };
};

/**
 * Validate entire schedule
 */
export const validateSchedule = (schedule) => {
  const allErrors = [];
  const allWarnings = [];
  const allSuggestions = [];
  
  schedule.forEach((row, index) => {
    const validation = validateScheduleRow(row, index + 1);
    
    if (validation.errors.length > 0) {
      allErrors.push(...validation.errors);
    }
    
    if (validation.warnings.length > 0) {
      allWarnings.push(...validation.warnings);
    }
    
    if (Object.keys(validation.suggestions).length > 0) {
      allSuggestions.push({
        row: index + 1,
        suggestions: validation.suggestions
      });
    }
  });

  // Check for schedule-level issues
  if (schedule.length === 0) {
    allErrors.push({
      field: 'schedule',
      message: 'Schedule is empty',
      row: 0
    });
  }

  // Check for duplicate segments
  const segmentNames = schedule.map(row => row.segment?.toLowerCase().trim()).filter(Boolean);
  const duplicates = segmentNames.filter((name, index) => segmentNames.indexOf(name) !== index);
  
  if (duplicates.length > 0) {
    allWarnings.push({
      field: 'schedule',
      message: `Duplicate segments found: ${[...new Set(duplicates)].join(', ')}`,
      row: 0
    });
  }

  // Check for time gaps or overlaps (if times are provided)
  const timesWithIndex = schedule
    .map((row, index) => ({ ...row, originalIndex: index + 1 }))
    .filter(row => row.time);
    
  if (timesWithIndex.length > 1) {
    // Sort by time to check for overlaps
    // This is a simplified check - could be enhanced
    const timeConflicts = checkTimeConflicts(timesWithIndex);
    allWarnings.push(...timeConflicts);
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
    suggestions: allSuggestions,
    summary: {
      totalRows: schedule.length,
      errorCount: allErrors.length,
      warningCount: allWarnings.length,
      suggestionCount: allSuggestions.length
    }
  };
};

/**
 * Check for time conflicts in schedule
 */
const checkTimeConflicts = (scheduleWithTimes) => {
  const conflicts = [];
  
  // Convert times to minutes for comparison
  const toMinutes = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string') return null;
    
    let [time, modifier] = timeStr.split(' ');
    if (!time.includes(':')) return null;
    
    let [hours, minutes] = time.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return null;

    if (modifier) {
      if (modifier.toUpperCase() === 'PM' && hours !== 12) hours += 12;
      if (modifier.toUpperCase() === 'AM' && hours === 12) hours = 0;
    }
    
    return hours * 60 + minutes;
  };

  for (let i = 0; i < scheduleWithTimes.length - 1; i++) {
    const current = scheduleWithTimes[i];
    const next = scheduleWithTimes[i + 1];
    
    const currentStartMinutes = toMinutes(current.time);
    const nextStartMinutes = toMinutes(next.time);
    
    if (currentStartMinutes !== null && nextStartMinutes !== null) {
      const currentDuration = parseInt(current.duration?.toString().replace(/[^0-9]/g, '') || '0');
      const currentEndMinutes = currentStartMinutes + currentDuration;
      
      if (currentEndMinutes > nextStartMinutes) {
        conflicts.push({
          field: 'schedule',
          message: `Potential time conflict between "${current.segment}" and "${next.segment}"`,
          row: current.originalIndex
        });
      }
      
      // Check for very large gaps (more than 2 hours)
      const gap = nextStartMinutes - currentEndMinutes;
      if (gap > 120) {
        conflicts.push({
          field: 'schedule',
          message: `Large time gap (${Math.floor(gap / 60)}h ${gap % 60}m) between "${current.segment}" and "${next.segment}"`,
          row: current.originalIndex
        });
      }
    }
  }
  
  return conflicts;
};

/**
 * Auto-clean schedule data using suggestions
 */
export const autoCleanSchedule = (schedule) => {
  return schedule.map((row, index) => {
    const validation = validateScheduleRow(row, index + 1);
    
    if (Object.keys(validation.suggestions).length > 0) {
      return {
        ...row,
        ...validation.suggestions
      };
    }
    
    return row;
  });
};

/**
 * Generate data quality report
 */
export const generateQualityReport = (schedule, metadata = {}) => {
  const validation = validateSchedule(schedule);
  
  const report = {
    timestamp: new Date().toISOString(),
    fileName: metadata.fileName || 'Unknown',
    dataSource: metadata.source || 'Unknown',
    
    overview: {
      totalRows: validation.summary.totalRows,
      validRows: validation.summary.totalRows - validation.summary.errorCount,
      dataQualityScore: Math.max(0, Math.min(100, 
        ((validation.summary.totalRows - validation.summary.errorCount) / Math.max(1, validation.summary.totalRows)) * 100
      ))
    },
    
    issues: {
      errors: validation.errors,
      warnings: validation.warnings,
      suggestions: validation.suggestions
    },
    
    columnMapping: metadata.columnMapping || {},
    
    recommendations: generateRecommendations(validation, metadata)
  };
  
  return report;
};

/**
 * Generate recommendations based on validation results
 */
const generateRecommendations = (validation, metadata) => {
  const recommendations = [];
  
  if (validation.summary.errorCount > 0) {
    recommendations.push({
      priority: 'high',
      category: 'data_errors',
      message: `Fix ${validation.summary.errorCount} data errors before proceeding`,
      action: 'Review and correct the highlighted errors in your data'
    });
  }
  
  if (validation.summary.warningCount > validation.summary.totalRows * 0.3) {
    recommendations.push({
      priority: 'medium',
      category: 'data_quality',
      message: 'High number of warnings detected',
      action: 'Consider reviewing your source data format and standardizing column headers'
    });
  }
  
  if (metadata.columnMapping) {
    const lowConfidenceColumns = Object.entries(metadata.columnMapping)
      .filter(([_, mapping]) => mapping.confidence < 0.8);
      
    if (lowConfidenceColumns.length > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'column_mapping',
        message: 'Some columns were mapped with low confidence',
        action: `Review mapping for: ${lowConfidenceColumns.map(([key]) => key).join(', ')}`
      });
    }
  }
  
  if (validation.summary.totalRows === 0) {
    recommendations.push({
      priority: 'high',
      category: 'no_data',
      message: 'No valid data rows found',
      action: 'Check that your file contains proper headers and data rows'
    });
  }
  
  return recommendations;
};
