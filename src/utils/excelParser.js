import XLSX from 'xlsx';

// A more robust parser that handles XLSX, CSV, and common data issues.
export const parseExcelFile = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      return reject(new Error("No file provided."));
    }

    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = event.target.result;
        const isCSV = file.name.endsWith('.csv');
        let workbook, worksheet, headerRows, jsonData;

        if (isCSV) {
          // Parse CSV as text, robustly handle extra columns/rows
          const allRows = data.split(/\r?\n/).map(row => row.split(','));
          // Find the first non-empty row as header
          let headerIdx = allRows.findIndex(row => row.some(cell => cell.trim() !== ''));
          if (headerIdx === -1) return reject(new Error("No valid header row found in CSV."));
          headerRows = allRows[headerIdx].map(h => h.trim());
          // Build headerMap as before
          const normalizeHeader = (h) => h.toString().trim().toLowerCase().replace(/[^a-z0-9]/gi, '');
          const headerMap = {};
          headerRows.forEach(h => {
            const normalized = normalizeHeader(h);
            if (normalized.includes('time')) headerMap.time = h;
            else if (normalized.includes('duration')) headerMap.duration = h;
            else if (normalized.includes('segment')) headerMap.segment = h;
            else if (normalized.includes('presenter') || normalized.includes('speaker') || normalized.includes('host')) headerMap.presenter = h;
            else if (normalized.includes('note')) headerMap.notes = h;
          });
          // Parse data rows
          jsonData = allRows.slice(headerIdx + 1).map(row => {
            // Pad row to header length
            while (row.length < headerRows.length) row.push('');
            return headerRows.reduce((acc, h, i) => {
              acc[h] = (row[i] || '').trim();
              return acc;
            }, {});
          }).filter(row => {
            // Only keep rows with at least time or duration
            return (row[headerMap.time] && row[headerMap.time].trim() !== '') || (row[headerMap.duration] && row[headerMap.duration].trim() !== '');
          });
          // Map to output format
          const filtered = jsonData.map(row => {
            let duration = row[headerMap.duration] || '';
            if (typeof duration === 'string') duration = duration.replace(/[^0-9.]/g, '');
            let time = row[headerMap.time] || '';
            return {
              time: time.toString(),
              duration: duration.toString(),
              segment: (row[headerMap.segment] || '').toString(),
              presenter: (row[headerMap.presenter] || '').toString(),
              notes: (row[headerMap.notes] || '').toString(),
            };
          });
          resolve(filtered);
          return;
        }
        // XLSX parsing logic
        workbook = XLSX.read(data, { cellDates: true });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          return reject(new Error("No valid sheets found in the file."));
        }
        worksheet = workbook.Sheets[sheetName];
        headerRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 0 })[0];
        if (!headerRows) {
            return reject(new Error("Could not detect headers in the sheet."));
        }
        const normalizeHeader = (h) => h.toString().trim().toLowerCase().replace(/[^a-z0-9]/gi, '');
        const headerMap = {};
        headerRows.forEach(h => {
            const normalized = normalizeHeader(h);
            if (normalized.includes('time')) headerMap.time = h;
            else if (normalized.includes('duration')) headerMap.duration = h;
            else if (normalized.includes('segment')) headerMap.segment = h;
            else if (normalized.includes('presenter') || normalized.includes('speaker') || normalized.includes('host')) headerMap.presenter = h;
            else if (normalized.includes('note')) headerMap.notes = h;
        });
        jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        const filtered = jsonData.map(row => {
          let duration = row[headerMap.duration] || '';
          if (typeof duration === 'string') {
            duration = duration.replace(/[^0-9.]/g, '');
          }
          let time = row[headerMap.time] || '';
          if (time instanceof Date) {
            time = time.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            });
          }
          return {
            time: time.toString(),
            duration: duration.toString(),
            segment: (row[headerMap.segment] || '').toString(),
            presenter: (row[headerMap.presenter] || '').toString(),
            notes: (row[headerMap.notes] || '').toString(),
          };
        });
        resolve(filtered);
      } catch (error) {
        console.error("Error parsing file:", error);
        reject(new Error("Failed to process the file. Please ensure it's a valid XLSX or CSV."));
      }
    };

    reader.onerror = (error) => {
      reject(error);
    };

    // Use the correct reader method based on file type.
    if (file.name.endsWith('.csv')) {
      // Use readAsText for CSV files to better handle text encoding.
      reader.readAsText(file);
    } else {
      // Use readAsArrayBuffer for binary files like XLSX.
      reader.readAsArrayBuffer(file);
    }
  });
};

export const formatEventData = (data) => {
    return data.map(event => ({
        id: event.ID,
        title: event.Title,
        startTime: new Date(event.StartTime),
        duration: event.Duration,
        status: event.Status || 'Upcoming'
    }));
};