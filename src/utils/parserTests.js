/**
 * Test suite for enhanced parser capabilities
 * Demonstrates handling of various edge cases and formats
 */

import { parseClipboardData, parseScheduleFile } from '../utils/enhancedParser';
import { validateSchedule, autoCleanSchedule } from '../utils/dataValidation';

// Test data samples representing common problematic formats
const testSamples = {
  // Inconsistent headers and formats
  messyClipboardData: `Start Time	How Long	What	Who's Presenting	Additional Info
9:00 AM	30 min	Welcome & Introductions	John Smith	Coffee will be served
930	45	Keynote Speech	Dr. Sarah Johnson	Main auditorium
10:15 AM	1h	Workshop Session A	Mike Davis	Room 101
11:30 AM	30m	Break	
12:00 PM	1:30	Lunch & Networking	Multiple Speakers	Cafeteria
1:30 PM	90	Panel Discussion	Various	Q&A included
3:00	1h30m	Closing Remarks	CEO	Awards ceremony`,

  // European format with semicolons
  europeanFormat: `Heure;Durée;Séance;Présentateur;Remarques
09:00;30;Accueil;Jean Dupont;Café disponible
09:30;45;Conférence;Dr. Marie Martin;Salle principale
10:15;60;Atelier A;Pierre Durand;Salle 101`,

  // Minimal headers
  minimalHeaders: `Time	Session	Speaker
9:00 AM	Opening	John
10:00 AM	Talk 1	Sarah
11:00 AM	Break	
12:00 PM	Lunch	Multiple`,

  // No headers (data only)
  noHeaders: `9:00 AM	30	Welcome Session	John Smith	Room A
10:00 AM	45	Keynote	Dr. Johnson	Main Hall
11:00 AM	15	Break		Lobby`,

  // Mixed time formats
  mixedTimeFormats: `Time	Duration	Event	Facilitator
9:00 AM	30	Morning Session	John
1000	45	Mid-morning Talk	Sarah
10:45 AM	15	Coffee Break	
11.00 AM	60	Workshop	Mike
1200	90	Lunch Session	Team`,

  // Very messy real-world data
  realWorldMessy: `   Time    	Duration (mins)   	   Session / Activity   	Presenter/Facilitator	Notes & Comments
  8:30 AM   	  30 minutes  	Registration & Coffee	Front Desk Staff	Please arrive early  
9:00	45min	Opening Keynote Address	Dr. Smith, PhD	Main auditorium, no recording
  9:45 AM  	15	  BREAK  		Networking encouraged
10:00AM	1hr 30min	Workshop: Data Analysis	Prof. Johnson	Hands-on session
11:30 AM	30 mins	Panel Discussion	Multiple speakers	Q&A at end
12:00 PM	1.5 hours	Lunch & Networking		Sponsored by TechCorp`,
};

/**
 * Test enhanced parser with various problematic inputs
 */
export const runParserTests = () => {
  console.log('🧪 Running Enhanced Parser Tests...\n');

  Object.entries(testSamples).forEach(([testName, data]) => {
    console.log(`\n📝 Testing: ${testName}`);
    console.log('=' .repeat(50));
    
    try {
      const result = parseClipboardData(data);
      
      console.log(`✅ Parse successful!`);
      console.log(`📊 Rows parsed: ${result.data.length}`);
      console.log(`🗂️  Original headers: ${result.metadata.originalHeaders.join(', ')}`);
      
      // Show column mapping
      console.log('\n🔗 Column Mapping:');
      Object.entries(result.metadata.columnMapping).forEach(([field, mapping]) => {
        const confidence = Math.round(mapping.confidence * 100);
        const indicator = confidence >= 90 ? '🟢' : confidence >= 70 ? '🟡' : '🔴';
        console.log(`  ${indicator} ${field}: "${mapping.header}" (${confidence}% confidence)`);
      });
      
      // Run validation
      const validation = validateSchedule(result.data);
      console.log(`\n🔍 Validation Results:`);
      console.log(`  Quality Score: ${Math.round(validation.summary.totalRows > 0 ? 
        ((validation.summary.totalRows - validation.summary.errorCount) / validation.summary.totalRows) * 100 : 0)}%`);
      console.log(`  Errors: ${validation.errors.length}`);
      console.log(`  Warnings: ${validation.warnings.length}`);
      
      if (validation.errors.length > 0) {
        console.log('\n❌ Errors found:');
        validation.errors.slice(0, 3).forEach(error => {
          console.log(`  Row ${error.row}: ${error.message}`);
        });
      }
      
      if (validation.warnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        validation.warnings.slice(0, 3).forEach(warning => {
          console.log(`  Row ${warning.row}: ${warning.message}`);
        });
      }
      
      // Show first few parsed rows
      console.log('\n📋 Sample parsed data:');
      result.data.slice(0, 3).forEach((row, index) => {
        console.log(`  Row ${index + 1}: ${row.time} | ${row.duration} | ${row.segment} | ${row.presenter}`);
      });
      
      // Test auto-cleaning
      const cleaned = autoCleanSchedule(result.data);
      const cleanedValidation = validateSchedule(cleaned);
      const improvementScore = Math.round(cleanedValidation.summary.totalRows > 0 ? 
        ((cleanedValidation.summary.totalRows - cleanedValidation.summary.errorCount) / cleanedValidation.summary.totalRows) * 100 : 0);
      
      console.log(`\n🧹 After auto-cleaning: ${improvementScore}% quality`);
      
    } catch (error) {
      console.log(`❌ Parse failed: ${error.message}`);
    }
  });
  
  console.log('\n\n🏁 Parser tests completed!');
};

/**
 * Simulate file upload scenarios
 */
export const testFileScenarios = () => {
  console.log('\n🗂️  Testing File Upload Scenarios...\n');
  
  // Simulate problematic file scenarios
  const scenarios = [
    {
      name: 'Large file with many columns',
      description: 'File with 15+ columns, only some relevant',
      headers: ['Timestamp', 'Event ID', 'Category', 'Start Time', 'Duration (min)', 
                'Event Title', 'Location', 'Capacity', 'Speaker Name', 'Bio', 
                'Equipment', 'Notes', 'Status', 'Created By', 'Last Modified'],
      sampleRow: ['2024-01-15', 'EV001', 'Workshop', '9:00 AM', '60', 
                  'Data Analysis Workshop', 'Room 101', '30', 'Dr. Smith', 
                  'Expert in data science', 'Projector, Laptop', 'Hands-on session', 
                  'Confirmed', 'admin', '2024-01-10']
    },
    {
      name: 'Inconsistent time formats in same file',
      description: 'Mix of 12hr, 24hr, and abbreviated formats',
      headers: ['Time', 'Duration', 'Session', 'Presenter'],
      rows: [
        ['9:00 AM', '30', 'Opening', 'John'],
        ['930', '45', 'Keynote', 'Sarah'],
        ['10:15', '30', 'Break', ''],
        ['10.45 AM', '60', 'Workshop', 'Mike']
      ]
    },
    {
      name: 'Missing required data',
      description: 'File with many empty cells and missing times',
      headers: ['Start', 'Length', 'Topic', 'Who', 'Where'],
      rows: [
        ['9:00 AM', '30', 'Opening Session', 'John Smith', 'Main Hall'],
        ['', '45', 'Keynote Address', '', 'Auditorium'],
        ['10:30 AM', '', 'Coffee Break', '', ''],
        ['', '', 'Workshop A', 'Dr. Johnson', 'Room 101']
      ]
    }
  ];
  
  scenarios.forEach(scenario => {
    console.log(`\n📄 Scenario: ${scenario.name}`);
    console.log(`📝 ${scenario.description}`);
    console.log('-'.repeat(40));
    
    // Create mock CSV data
    let csvData = scenario.headers.join(',') + '\n';
    
    if (scenario.sampleRow) {
      csvData += scenario.sampleRow.map(cell => `"${cell}"`).join(',');
    } else if (scenario.rows) {
      csvData += scenario.rows.map(row => 
        row.map(cell => `"${cell}"`).join(',')
      ).join('\n');
    }
    
    try {
      const result = parseClipboardData(csvData.replace(/,/g, '\t')); // Convert to tab-delimited
      
      console.log(`✅ Headers detected: ${Object.keys(result.metadata.columnMapping).length} fields mapped`);
      console.log(`📊 Data rows: ${result.data.length}`);
      
      // Check mapping confidence
      const lowConfidence = Object.entries(result.metadata.columnMapping)
        .filter(([_, mapping]) => mapping.confidence < 0.8);
      
      if (lowConfidence.length > 0) {
        console.log(`⚠️  Low confidence mappings: ${lowConfidence.map(([field, _]) => field).join(', ')}`);
      }
      
      const validation = validateSchedule(result.data);
      console.log(`🔍 Quality: ${validation.summary.errorCount} errors, ${validation.summary.warningCount} warnings`);
      
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
    }
  });
};

/**
 * Performance test with large dataset
 */
export const performanceTest = () => {
  console.log('\n⚡ Performance Testing...\n');
  
  // Generate large dataset
  const generateLargeDataset = (rows) => {
    const headers = 'Time\tDuration\tSession\tPresenter\tNotes';
    const dataRows = [];
    
    for (let i = 0; i < rows; i++) {
      const hour = 9 + Math.floor(i / 4);
      const minute = (i % 4) * 15;
      const time = `${hour}:${minute.toString().padStart(2, '0')} AM`;
      const duration = 15 + (i % 4) * 15;
      const session = `Session ${i + 1}`;
      const presenter = `Speaker ${String.fromCharCode(65 + (i % 26))}`;
      const notes = `Notes for session ${i + 1}`;
      
      dataRows.push(`${time}\t${duration}\t${session}\t${presenter}\t${notes}`);
    }
    
    return headers + '\n' + dataRows.join('\n');
  };
  
  const testSizes = [100, 500, 1000, 2000];
  
  testSizes.forEach(size => {
    console.log(`\n📏 Testing ${size} rows...`);
    
    const dataset = generateLargeDataset(size);
    const startTime = performance.now();
    
    try {
      const result = parseClipboardData(dataset);
      const parseTime = performance.now() - startTime;
      
      const validationStart = performance.now();
      const validation = validateSchedule(result.data);
      const validationTime = performance.now() - validationStart;
      
      console.log(`⏱️  Parse time: ${parseTime.toFixed(2)}ms`);
      console.log(`⏱️  Validation time: ${validationTime.toFixed(2)}ms`);
      console.log(`📊 Rows processed: ${result.data.length}/${size}`);
      console.log(`✅ Success rate: ${((result.data.length / size) * 100).toFixed(1)}%`);
      
    } catch (error) {
      console.log(`❌ Failed at ${size} rows: ${error.message}`);
    }
  });
};

// Export test runner
export const runAllTests = () => {
  console.log('🚀 Enhanced Parser Test Suite');
  console.log('='.repeat(60));
  
  runParserTests();
  testFileScenarios();
  performanceTest();
  
  console.log('\n' + '='.repeat(60));
  console.log('✨ All tests completed!');
  console.log('\nNext steps:');
  console.log('1. Review any failed tests or low confidence scores');
  console.log('2. Add more header variations if needed');
  console.log('3. Adjust validation rules based on your requirements');
  console.log('4. Test with real user data files');
};
