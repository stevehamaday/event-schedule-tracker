import XLSX from 'xlsx';

export const parseExcelFile = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
            // Normalize headers for presenter and notes/feedback
            const getPresenter = row =>
                row['Presenter'] || row['presenter'] || row['Speaker'] || row['speaker'] || row['Host'] || row['host'] || row['Presenter/Facilitator'] || row['presenter/facilitator'] || '';
            const getNotes = row => {
                // Combine Notes and Feedback if both exist
                let notes = row['Notes'] || row['notes'] || '';
                let feedback = row['Feedback'] || row['feedback'] || '';
                if (notes && feedback) return notes + ' | Feedback: ' + feedback;
                return notes || feedback || '';
            };
            // Only keep relevant fields: Time, Duration, Segment, Presenter, Notes
            const filtered = jsonData.map(row => ({
                time: row['Time'] || row['time'] || '',
                duration: row['Duration'] || row['duration'] || '',
                segment: row['Segment'] || row['segment'] || '',
                presenter: getPresenter(row),
                notes: getNotes(row)
            }));
            resolve(filtered);
        };
        reader.onerror = (error) => {
            reject(error);
        };
        reader.readAsArrayBuffer(file);
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