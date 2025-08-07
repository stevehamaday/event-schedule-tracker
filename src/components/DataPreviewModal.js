import React, { useState } from 'react';
import { validateSchedule, generateQualityReport, autoCleanSchedule } from '../utils/dataValidation';

const DataPreviewModal = ({ 
  isOpen, 
  onClose, 
  parseResult, 
  onAccept, 
  onReject 
}) => {
  const [showRawData, setShowRawData] = useState(false);
  const [autoClean, setAutoClean] = useState(true);
  
  if (!isOpen || !parseResult) return null;
  
  const { data, metadata } = parseResult;
  const qualityReport = generateQualityReport(data, metadata);
  const cleanedData = autoClean ? autoCleanSchedule(data) : data;
  
  const handleAccept = () => {
    onAccept(autoClean ? cleanedData : data);
  };
  
  const getQualityColor = (score) => {
    if (score >= 90) return '#22c55e'; // green
    if (score >= 70) return '#f59e0b'; // yellow
    return '#ef4444'; // red
  };
  
  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.9) return '#22c55e';
    if (confidence >= 0.7) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div className="modal-content" style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '24px',
        maxWidth: '90vw',
        maxHeight: '90vh',
        overflow: 'auto',
        width: '800px'
      }}>
        <div className="modal-header" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          borderBottom: '1px solid #e5e7eb',
          paddingBottom: '16px'
        }}>
          <h2 style={{ margin: 0, color: '#1f2937' }}>Import Preview</h2>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#6b7280'
            }}
          >
            ×
          </button>
        </div>

        {/* Quality Score */}
        <div className="quality-overview" style={{
          backgroundColor: '#f9fafb',
          padding: '16px',
          borderRadius: '6px',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
            <h3 style={{ margin: 0 }}>Data Quality Score</h3>
            <div style={{
              padding: '4px 12px',
              borderRadius: '20px',
              backgroundColor: getQualityColor(qualityReport.overview.dataQualityScore),
              color: 'white',
              fontWeight: 'bold'
            }}>
              {Math.round(qualityReport.overview.dataQualityScore)}%
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
            <div>
              <strong>Total Rows:</strong> {qualityReport.overview.totalRows}
            </div>
            <div>
              <strong>Valid Rows:</strong> {qualityReport.overview.validRows}
            </div>
            <div>
              <strong>Errors:</strong> <span style={{ color: qualityReport.issues.errors.length > 0 ? '#ef4444' : '#22c55e' }}>
                {qualityReport.issues.errors.length}
              </span>
            </div>
            <div>
              <strong>Warnings:</strong> <span style={{ color: qualityReport.issues.warnings.length > 0 ? '#f59e0b' : '#22c55e' }}>
                {qualityReport.issues.warnings.length}
              </span>
            </div>
          </div>
        </div>

        {/* Column Mapping */}
        <div className="column-mapping" style={{ marginBottom: '20px' }}>
          <h3>Column Mapping</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
            {Object.entries(metadata.columnMapping || {}).map(([field, mapping]) => (
              <div key={field} style={{
                padding: '8px',
                backgroundColor: '#f3f4f6',
                borderRadius: '4px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontWeight: 'bold', textTransform: 'capitalize' }}>{field}:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{mapping.header}</span>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: getConfidenceColor(mapping.confidence)
                  }} title={`Confidence: ${Math.round(mapping.confidence * 100)}%`} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Issues */}
        {(qualityReport.issues.errors.length > 0 || qualityReport.issues.warnings.length > 0) && (
          <div className="issues" style={{ marginBottom: '20px' }}>
            <h3>Issues Found</h3>
            
            {qualityReport.issues.errors.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <h4 style={{ color: '#ef4444', margin: '0 0 8px 0' }}>Errors</h4>
                {qualityReport.issues.errors.map((error, index) => (
                  <div key={index} style={{
                    padding: '8px',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '4px',
                    marginBottom: '4px',
                    fontSize: '14px'
                  }}>
                    Row {error.row}, {error.field}: {error.message}
                  </div>
                ))}
              </div>
            )}
            
            {qualityReport.issues.warnings.length > 0 && (
              <div>
                <h4 style={{ color: '#f59e0b', margin: '0 0 8px 0' }}>Warnings</h4>
                {qualityReport.issues.warnings.slice(0, 5).map((warning, index) => (
                  <div key={index} style={{
                    padding: '8px',
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fed7aa',
                    borderRadius: '4px',
                    marginBottom: '4px',
                    fontSize: '14px'
                  }}>
                    Row {warning.row}, {warning.field}: {warning.message}
                  </div>
                ))}
                {qualityReport.issues.warnings.length > 5 && (
                  <div style={{ fontSize: '14px', color: '#6b7280', fontStyle: 'italic' }}>
                    ... and {qualityReport.issues.warnings.length - 5} more warnings
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Recommendations */}
        {qualityReport.recommendations.length > 0 && (
          <div className="recommendations" style={{ marginBottom: '20px' }}>
            <h3>Recommendations</h3>
            {qualityReport.recommendations.map((rec, index) => (
              <div key={index} style={{
                padding: '12px',
                backgroundColor: rec.priority === 'high' ? '#fef2f2' : '#f0f9ff',
                border: `1px solid ${rec.priority === 'high' ? '#fecaca' : '#bae6fd'}`,
                borderRadius: '4px',
                marginBottom: '8px'
              }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                  {rec.message}
                </div>
                <div style={{ fontSize: '14px', color: '#6b7280' }}>
                  {rec.action}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Auto-clean option */}
        <div className="auto-clean" style={{ marginBottom: '20px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={autoClean}
              onChange={(e) => setAutoClean(e.target.checked)}
            />
            <span>Automatically clean and fix data issues</span>
          </label>
          <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>
            This will attempt to fix common formatting issues and missing values
          </div>
        </div>

        {/* Data Preview */}
        <div className="data-preview" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3>Data Preview</h3>
            <button
              onClick={() => setShowRawData(!showRawData)}
              style={{
                padding: '4px 12px',
                backgroundColor: '#e5e7eb',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              {showRawData ? 'Show Processed' : 'Show Raw'}
            </button>
          </div>
          
          <div style={{
            maxHeight: '300px',
            overflow: 'auto',
            border: '1px solid #d1d5db',
            borderRadius: '4px'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb' }}>
                  <th style={{ padding: '8px', border: '1px solid #d1d5db', textAlign: 'left' }}>Time</th>
                  <th style={{ padding: '8px', border: '1px solid #d1d5db', textAlign: 'left' }}>Duration</th>
                  <th style={{ padding: '8px', border: '1px solid #d1d5db', textAlign: 'left' }}>Segment</th>
                  <th style={{ padding: '8px', border: '1px solid #d1d5db', textAlign: 'left' }}>Presenter</th>
                  <th style={{ padding: '8px', border: '1px solid #d1d5db', textAlign: 'left' }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {(showRawData ? data : cleanedData).slice(0, 10).map((row, index) => (
                  <tr key={index}>
                    <td style={{ padding: '8px', border: '1px solid #d1d5db' }}>{row.time}</td>
                    <td style={{ padding: '8px', border: '1px solid #d1d5db' }}>{row.duration}</td>
                    <td style={{ padding: '8px', border: '1px solid #d1d5db' }}>{row.segment}</td>
                    <td style={{ padding: '8px', border: '1px solid #d1d5db' }}>{row.presenter}</td>
                    <td style={{ padding: '8px', border: '1px solid #d1d5db' }}>{row.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.length > 10 && (
              <div style={{ padding: '8px', textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>
                ... and {data.length - 10} more rows
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="modal-actions" style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
          paddingTop: '16px',
          borderTop: '1px solid #e5e7eb'
        }}>
          <button
            onClick={onReject || onClose}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleAccept}
            disabled={qualityReport.issues.errors.length > 0}
            style={{
              padding: '8px 16px',
              backgroundColor: qualityReport.issues.errors.length > 0 ? '#d1d5db' : '#3b82f6',
              color: qualityReport.issues.errors.length > 0 ? '#6b7280' : 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: qualityReport.issues.errors.length > 0 ? 'not-allowed' : 'pointer'
            }}
          >
            Import Schedule
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataPreviewModal;
