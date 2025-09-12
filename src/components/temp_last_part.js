            )}
            {/* Desktop Layout Only */}
            {!isMobileDevice && (
            <>
                {/* Desktop: Import Section */}
                <section className="showflow-card">
                  <details>
                    <summary style={{fontSize:'1.1em',fontWeight:'500',padding:'8px 0',cursor:'pointer'}}>
                      📋 Import
                    </summary>
                    <div style={{marginTop:'16px'}}>
                      <p style={{marginBottom: 16}}>
                        <a 
                          href="https://aka.ms/showflowtrackertemplate" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="showflow-btn success template-button"
                          style={{
                            textDecoration: 'none',
                            display: 'block',
                            width: '100%',
                            maxWidth: '300px',
                            margin: '0 auto',
                            padding: '12px 16px',
                            borderRadius: '4px',
                            fontSize: '0.9em',
                            textAlign: 'center',
                            boxSizing: 'border-box'
                          }}
                        >
                          📋 Get Schedule Template
                        </a>
                      </p>
                      <textarea
                        className="showflow-textarea"
                        placeholder="Paste your schedule here..."
                        rows={4}
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                      />
                      <div className="showflow-input-actions" style={{marginTop:'12px'}}>
                        <button className="showflow-btn success" onClick={handleParseSchedule}>Parse Schedule</button>
                        <label className="showflow-file-upload" style={{marginLeft:'8px'}}>
                          <input type="file" accept=".csv" onChange={handleFileUpload} />
                          <span>Upload .csv</span>
                        </label>
                      </div>
                    </div>
                  </details>
                </section>

                {/* Desktop: Original Layout */}
          {/* Floating sticky bar for current segment */}
          {currentIdx !== null && schedule[currentIdx] && (
            <div className="showflow-current-sticky" style={isMobile() ? { position: 'sticky', top: 64, zIndex: 900, background: '#FFB900', color: '#323130' } : {}}>
              <span className="showflow-current-pulse" />
              <strong>Now:</strong> {schedule[currentIdx].segment}
              <span style={{ marginLeft: 8 }}>{schedule[currentIdx].time}</span>
              {/* Session timer widget */}
              <span style={{ marginLeft: 16, color: '#6c7bbd', fontWeight: 500 }}>
                <span role="img" aria-label="timer">⏳</span> {Math.floor(segmentTimer / 60)}:{(segmentTimer % 60).toString().padStart(2, '0')} left
              </span>
              {overrunIdx === currentIdx && <span style={{ color: 'red', marginLeft: 8 }}>Overrun!</span>}
              {schedule[currentIdx + 1] && (
                <span style={{ marginLeft: 24, opacity: 0.7 }}>
                  <strong>Next Up:</strong> {schedule[currentIdx + 1].segment} <span style={{ marginLeft: 8 }}>{schedule[currentIdx + 1].time}</span>
                </span>
              )}
            </div>
          )}

          {/* Shared Events Section */}
          <section className="showflow-card">
            <h2>
              Shared Events
              <span style={{ marginLeft: 8, fontSize: '0.8em', color: connectionStatus === 'connected' ? '#107c10' : connectionStatus === 'error' ? '#d13438' : '#666' }}>
                {connectionStatus === 'connected' && '🟢 Connected'}
                {connectionStatus === 'loading' && '🟡 Loading...'}
                {connectionStatus === 'error' && '🔴 Connection Error'}
                {connectionStatus === 'disconnected' && '⚪ Disconnected'}
              </span>
            </h2>
            <p style={{fontSize: '0.85em', color: '#666', marginBottom: 16}}>
              <em>Collaborate on events with your team • Auto-syncs every 30 seconds</em>
            </p>
            
            {/* Current shared event indicator */}
            {currentSharedEventId && (
              <div style={{ 
                background: '#f3f2f1', 
                border: '1px solid #e1dfdd', 
                borderRadius: '4px', 
                padding: '8px 12px', 
                marginBottom: '12px',
                fontSize: '0.9em'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div>
                    <strong>📤 Currently editing:</strong> {currentSharedEventId}
                    {userSessionId && (
                      <span style={{ marginLeft: '8px', fontSize: '0.8em', color: '#666' }}>
                        (You: {userSessionId})
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      className="showflow-btn" 
                      style={{ padding: '4px 8px', fontSize: '0.8em' }}
                      onClick={updateSharedEvent}
                      disabled={isLoading}
                    >
                      {isLoading ? 'Saving...' : 'Save Changes'}
                    </button>
                    {versionInfo && versionInfo.originalVersion && (
                      <button 
                        className="showflow-btn warning" 
                        style={{ padding: '4px 8px', fontSize: '0.8em' }}
                        onClick={() => restoreOriginalVersion(currentSharedEventId)}
                        disabled={isLoading}
                        title="Restore the original version before any changes"
                      >
                        🔄 Restore Original
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Active users indicator */}
                {activeUsers.length > 1 && (
                  <div style={{ fontSize: '0.8em', color: '#666', marginBottom: '4px' }}>
                    <span style={{ color: '#107c10' }}>👥</span> Active users: {activeUsers.filter(user => user !== userSessionId).join(', ')}
                  </div>
                )}
                
                {/* Version info */}
                {versionInfo && (
                  <div style={{ fontSize: '0.8em', color: '#666' }}>
                    {versionInfo.versions && versionInfo.versions.length > 1 && (
                      <span>📋 {versionInfo.versions.length} versions saved • </span>
                    )}
                    {lastModified && (
                      <span>Last modified: {new Date(lastModified).toLocaleString()}</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Version conflict modal */}
            {conflictInfo && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2000
              }}>
                <div style={{
                  background: 'white',
                  padding: '24px',
                  borderRadius: '8px',
                  maxWidth: '500px',
                  margin: '20px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
                }}>
                  <h3 style={{ marginTop: 0, color: '#d13438' }}>⚠️ Version Conflict Detected</h3>
                  <p>
                    Another user has modified this event since you started editing. 
                  </p>
                  <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '4px', margin: '16px 0' }}>
                    <strong>Your version:</strong> {new Date(conflictInfo.clientLastModified).toLocaleString()}<br/>
                    <strong>Server version:</strong> {new Date(conflictInfo.serverLastModified).toLocaleString()}
                  </div>
                  <p style={{ fontSize: '0.9em', color: '#666' }}>
                    Choose how to resolve this conflict:
                  </p>
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button 
                      className="showflow-btn"
                      onClick={() => handleVersionConflict(conflictInfo.eventId, 'reload')}
                      disabled={isLoading}
                    >
                      📥 Load Latest (Discard My Changes)
                    </button>
                    <button 
                      className="showflow-btn warning"
                      onClick={() => handleVersionConflict(conflictInfo.eventId, 'force-save')}
                      disabled={isLoading}
                    >
                      💾 Force Save (Override Changes)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Shared event controls */}
            <div className="showflow-input-actions" style={{ marginBottom: '16px' }}>
              <button 
                className="showflow-btn success" 
                onClick={() => {
                  const eventName = prompt('Enter name for new shared event:');
                  if (eventName) saveAsSharedEvent(eventName);
                }}
                disabled={isLoading}
              >
                💾 Save as Shared
              </button>
              <button 
                className="showflow-btn" 
                onClick={loadSharedEvents}
                disabled={isLoading}
              >
                🔄 Refresh List
              </button>
              {!currentSharedEventId && (
                <button 
                  className="showflow-btn warning" 
                  onClick={() => {
                    const eventName = prompt('Enter name for new shared event:');
                    if (eventName) saveAsSharedEvent(eventName);
                  }}
                  disabled={isLoading}
                >
                  📤 Share Current
                </button>
              )}
            </div>

            {/* Shared events list */}
            {sharedEvents.length > 0 ? (
              <div style={{ border: '1px solid #e1dfdd', borderRadius: '4px', maxHeight: '200px', overflow: 'auto' }}>
                {sharedEvents.map((event) => (
                  <div 
                    key={event.id} 
                    style={{ 
                      padding: '8px 12px', 
                      borderBottom: '1px solid #f3f2f1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: event.id === currentSharedEventId ? '#fff4ce' : 'white'
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong>{event.name}</strong>
                        {event.versionControl?.isSoftDeleted && (
                          <span style={{ 
                            fontSize: '0.8em', 
                            color: '#d13438', 
                            background: '#fef2f2', 
                            padding: '2px 6px', 
                            borderRadius: '4px',
                            border: '1px solid #fecaca'
                          }}>
                            🗑️ Soft Deleted
                          </span>
                        )}
                        {event.versionControl?.originalVersion && (
                          <span style={{ 
                            fontSize: '0.8em', 
                            color: '#059669', 
                            title: 'Original version is preserved'
                          }}>
                            🛡️
                          </span>
                        )}
                      </div>
                      {event.metadata && (
                        <div style={{ fontSize: '0.8em', color: '#666' }}>
                          Created: {new Date(event.metadata.createdAt).toLocaleDateString()}
                          {event.metadata.lastModified && ` • Modified: ${new Date(event.metadata.lastModified).toLocaleDateString()}`}
                          {event.schedule && ` • ${event.schedule.length} segments`}
                          {event.versionControl?.versions && event.versionControl.versions.length > 1 && (
                            <span> • {event.versionControl.versions.length} versions</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {!event.versionControl?.isSoftDeleted && (
                        <button 
                          className="showflow-btn" 
                          style={{ padding: '4px 8px', fontSize: '0.8em' }}
                          onClick={() => loadSharedEvent(event.id)}
                          disabled={isLoading}
                        >
                          📥 Load
                        </button>
                      )}
                      <button 
                        className="showflow-btn danger" 
                        style={{ padding: '4px 8px', fontSize: '0.8em' }}
                        onClick={() => deleteSharedEvent(event.id)}
                        disabled={isLoading}
                        title={event.versionControl?.isSoftDeleted ? 'Permanently delete (admin required)' : 'Delete event'}
                      >
                        {event.versionControl?.isSoftDeleted ? '💀' : '🗑️'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ 
                textAlign: 'center', 
                padding: '24px', 
                color: '#666', 
                fontSize: '0.9em',
                border: '1px dashed #e1dfdd',
                borderRadius: '4px'
              }}>
                {isLoading ? 'Loading shared events...' : 'No shared events yet. Save your current schedule to get started!'}
              </div>
            )}
          </section>

          {/* Current Schedule - Desktop View */}
          <section className="showflow-card">
            <h2>Current Schedule</h2>
            {schedule.length === 0 ? (              <div className="showflow-empty" style={{textAlign:'center',padding:'32px 0'}}>
                  <p style={{fontSize:'1.08em',marginBottom:16}}>
                    You can build your schedule here by adding segments.<br />
                    <span style={{color:'#6c7bbd',fontSize:'0.98em'}}>Click below to get started!</span>
                  </p>                  <button
                    className="showflow-btn success"
                    style={{fontSize:'1.08em',padding:'12px 32px',marginTop:8}}
                    onClick={() => handleAddSegment(0)}
                  >
                    + Create a New Schedule
                  </button>
                </div>
            ) : (
              <>
                {hasNotesInSchedule() && (
                  <button 
                    className="showflow-btn" 
                    style={{marginBottom:12}} 
                    onClick={handleToggleAllNotes}
                  >
                    {allNotesExpanded ? 'Collapse All Notes' : 'Expand All Notes'}
                  </button>
                )}
              <div className="showflow-table-container">
                <table className="showflow-table">                  <thead>
                    <tr>
                      <th></th> {/* Alert icon column */}
                      <th>Time</th>
                      <th>Duration</th>
                      <th>Segment</th>
                      <th>Presenter</th>
                      <th colSpan={5}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.map((seg, i) => (
                      <React.Fragment key={i}>
                        <tr
                          draggable
                          onDragStart={() => handleDragStart(i)}
                          onDragOver={handleDragOver}
                          onDrop={() => handleDrop(i)}
                          className={
                            (draggedIndex === i ? 'dragged ' : '') +
                            (i === currentIdx ? 'current-segment ' : '') +
                            (i === currentIdx+1 ? 'next-segment ' : '') +
                            (i === overrunIdx ? 'overrun' : '')
                          }
                          style={{ cursor: 'pointer', position: 'relative' }}
                          onClick={() => setExpandedNotesIdx(expandedNotesIdx === i ? null : i)}
                          title="Click to reveal or add notes"
                        >                          {/* Render icons on the right for mobile, left for desktop */}
                          {!isMobile() && (
                            <>
                              {/* Alert icon */}
                              <td style={{textAlign:'center',width:32}}>
                                {i === currentIdx ? (
                                  <span className="showflow-current-pulse" title="Current segment" />
                                ) : (
                                  <button
                                    className="showflow-btn"
                                    style={{background:'none',border:'none',padding:0,cursor:'pointer'}}
                                    title={alertSegments.includes(i) ? 'Alert enabled' : 'Enable alert'}
                                    onClick={e => { e.stopPropagation(); toggleAlertSegment(i); }}
                                    tabIndex={0}
                                  >
                                    <span style={{fontSize:'1.2em',color:alertSegments.includes(i)?'#00A4EF':'#bbb'}}>
                                      {alertSegments.includes(i) ? '🔔' : '🔕'}
                                    </span>
                                  </button>                                )}
                              </td>
                            </>
                          )}                          {/* Editable fields */}
                          {editIdx === i ? (
                            <>
                              <td>
                                <input
                                  name="time"
                                  value={editValues.time || ''}
                                  onChange={handleEditChange}
                                  className="showflow-input"
                                  style={{width:'6em'}}
                                  placeholder="9:00 AM"
                                  title="Edit start time - subsequent segments will be automatically adjusted"
                                  autoFocus
                                />
                              </td>
                              <td>
                                <input
                                  name="duration"
                                  value={editValues.duration || ''}
                                  onChange={handleEditChange}
                                  className="showflow-input"
                                  style={{width:'5em'}}
                                />
                              </td>
                              <td>
                                <input
                                  name="segment"
                                  value={editValues.segment || ''}
                                  onChange={handleEditChange}
                                  className="showflow-input"
                                  style={{width:'12em'}}
                                />
                              </td>
                              <td>
                                <input
                                  name="presenter"
                                  value={editValues.presenter || ''}
                                  onChange={handleEditChange}
                                  className="showflow-input"
                                  style={{width:'10em'}}
                                />
                              </td>
                              {/* Save/Cancel buttons */}
                              <td colSpan={5} style={{minWidth:120}}>
                                <button className="showflow-btn success" onClick={e => { e.stopPropagation(); handleSaveEdit(i); }}>Save</button>
                                <button className="showflow-btn" onClick={e => { e.stopPropagation(); handleCancelEdit(); }}>Cancel</button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td style={{whiteSpace:'nowrap'}}>{seg.time}</td>
                              <td>{seg.duration} min</td>
                              <td style={{minWidth:'200px'}}>
                                <strong>{seg.segment}</strong>
                                {seg.presenter && <div style={{fontSize:'0.8em',color:'#888'}}>by {seg.presenter}</div>}
                              </td>
                              <td>{seg.presenter}</td>
                              <td style={{textAlign:'center',width:40}}>
                                <button
                                  className="showflow-btn"
                                  onClick={e => { e.stopPropagation(); handleEdit(i); }}
                                  title="Edit segment"
                                  tabIndex={0}
                                >
                                  ✏️
                                </button>
                              </td>
                              <td style={{textAlign:'center',width:40}}>
                                <button
                                  className="showflow-btn"
                                  onClick={e => { e.stopPropagation(); handleAddSegment(i); }}
                                  title="Add segment after this one"
                                  tabIndex={0}
                                >
                                  ➕
                                </button>
                              </td>
                              <td style={{textAlign:'center',width:40}}>
                                <button
                                  className="showflow-btn danger"
                                  onClick={e => { e.stopPropagation(); handleRemoveSegment(i); }}
                                  title="Remove segment"
                                  tabIndex={0}
                                >
                                  🗑️
                                </button>
                              </td>
                              <td style={{textAlign:'center',width:40}}>
                                <button
                                  className="showflow-btn"
                                  onClick={e => { e.stopPropagation(); addNote(i); }}
                                  title="Add note"
                                  tabIndex={0}
                                >
                                  📝
                                </button>
                              </td>
                              {/* Icon-only column on mobile for alerts */}
                              {isMobile() && (
                                <td style={{textAlign:'center',width:40}}>
                                  <button
                                    className="showflow-btn"
                                    style={{background:'none',border:'none',padding:0,cursor:'pointer'}}
                                    title={alertSegments.includes(i) ? 'Alert enabled' : 'Enable alert'}
                                    onClick={e => { e.stopPropagation(); toggleAlertSegment(i); }}
                                    tabIndex={0}
                                  >
                                    <span style={{fontSize:'1.2em',color:alertSegments.includes(i)?'#00A4EF':'#bbb'}}>
                                      {alertSegments.includes(i) ? '🔔' : '🔕'}
                                    </span>
                                  </button>
                                </td>
                              )}
                            </>
                          )}
                        </tr>
                        {/* Expandable notes row */}
                        {(allNotesExpanded || expandedNotesIdx === i) && editIdx !== i && (
                          <tr>
                            <td colSpan={isMobile() ? 9 : 8} style={{background:'#f8fafd',padding:'12px'}}>
                              <input
                                type="text"
                                placeholder="Add notes or feedback..."
                                value={seg.notes || ''}
                                onChange={e => {
                                  const updated = schedule.map((s, idx) => idx === i ? { ...s, notes: e.target.value } : s);
                                  pushHistory(schedule);
                                  setSchedule(updated);
                                }}
                                className="showflow-input"
                                style={{width:'100%'}}
                                autoFocus
                              />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Add Segment Button */}
              <button 
                className="showflow-btn success" 
                onClick={() => handleAddSegment(schedule.length)}
                style={{marginTop:'16px'}}
              >
                + Add Segment
              </button>

              {/* Quick Add Options */}
              {schedule.length > 0 && (
                <div style={{
                  marginTop: '12px',
                  padding: '12px',
                  background: '#f8fafd',
                  borderRadius: '6px',
                  border: '1px solid #e1e5e9'
                }}>
                  <div style={{
                    display: 'flex',
                    gap: '8px',
                    marginBottom: '8px',
                    flexWrap: 'wrap',
                    justifyContent: 'center'
                  }}>
                    <button
                      className="showflow-btn success"
                      onClick={() => handleAddSegment(schedule.length)}
                      style={{ fontSize: '0.9em', padding: '8px 16px' }}
                    >
                      + Add at End
                    </button>
                    
                    <button
                      className="showflow-btn success"
                      onClick={() => handleAddSegment(0)}
                      style={{ fontSize: '0.9em', padding: '8px 16px' }}
                    >
                      + Add at Beginning
                    </button>

                    {schedule.length > 1 && (
                      <button
                        className="showflow-btn success"
                        onClick={() => handleAddSegment(Math.floor(schedule.length / 2))}
                        style={{ fontSize: '0.9em', padding: '8px 16px' }}
                      >
                        + Insert in Middle
                      </button>
                    )}
                  </div>

                  <div style={{ fontSize: '0.85em', color: '#64748b', lineHeight: '1.4' }}>
                    <div style={{ marginBottom: '4px' }}>
                      💡 <strong>Quick tips:</strong> Click the <strong>+</strong> button next to any segment to add after it
                    </div>
                    <div>
                      ⌨️ <strong>Keyboard shortcuts:</strong> Press <kbd style={{
                        background: '#e2e8f0',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.8em',
                        border: '1px solid #cbd5e1'
                      }}>Ctrl+Enter</kbd> to add segments quickly
                    </div>
                  </div>
                </div>
              )}
              </>
            )}
            {schedule.length === 0 ? (              <div className="showflow-empty" style={{textAlign:'center',padding:'32px 0'}}>
                  <p style={{fontSize:'1.08em',marginBottom:16}}>
                    You can build your schedule here by adding segments.<br />
                    <span style={{color:'#6c7bbd',fontSize:'0.98em'}}>Click below to get started!</span>
                  </p>                  <button
                    className="showflow-btn success"
                    style={{fontSize:'1.08em',padding:'12px 32px',marginTop:8}}
                    onClick={() => handleAddSegment(0)}
                  >
                    + Create a New Schedule
                  </button>
                </div>
            ) : (
              <>
                {hasNotesInSchedule() && (
                  <button 
                    className="showflow-btn" 
                    style={{marginBottom:12}} 
                    onClick={handleToggleAllNotes}
                  >
                    {allNotesExpanded ? 'Collapse All Notes' : 'Expand All Notes'}
                  </button>
                )}
              <div className="showflow-table-container">
                <table className="showflow-table">                  <thead>
                    <tr>
                      <th></th> {/* Alert icon column */}
                      <th>Time</th>
                      <th>Duration</th>
                      <th>Segment</th>
                      <th>Presenter</th>
                      <th colSpan={5}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.map((seg, i) => (
                      <React.Fragment key={i}>
                        <tr
                          draggable
                          onDragStart={() => handleDragStart(i)}
                          onDragOver={handleDragOver}
                          onDrop={() => handleDrop(i)}
                          className={
                            (draggedIndex === i ? 'dragged ' : '') +
                            (i === currentIdx ? 'current-segment ' : '') +
                            (i === currentIdx+1 ? 'next-segment ' : '') +
                            (i === overrunIdx ? 'overrun' : '')
                          }
                          style={{ cursor: 'pointer', position: 'relative' }}
                          onClick={() => setExpandedNotesIdx(expandedNotesIdx === i ? null : i)}
                          title="Click to reveal or add notes"
                        >                          {/* Render icons on the right for mobile, left for desktop */}
                          {!isMobile() && (
                            <>
                              {/* Alert icon */}
                              <td style={{textAlign:'center',width:32}}>
                                {i === currentIdx ? (
                                  <span className="showflow-current-pulse" title="Current segment" />
                                ) : (
                                  <button
                                    className="showflow-btn"
                                    style={{background:'none',border:'none',padding:0,cursor:'pointer'}}
                                    title={alertSegments.includes(i) ? 'Alert enabled' : 'Enable alert'}
                                    onClick={e => { e.stopPropagation(); toggleAlertSegment(i); }}
                                    tabIndex={0}
                                  >
                                    <span style={{fontSize:'1.2em',color:alertSegments.includes(i)?'#00A4EF':'#bbb'}}>
                                      {alertSegments.includes(i) ? '🔔' : '🔕'}
                                    </span>
                                  </button>                                )}
                              </td>
                            </>
                          )}                          {/* Editable fields */}
                          {editIdx === i ? (
                            <>
                              <td>
                                <input
                                  name="time"
                                  value={editValues.time || ''}
                                  onChange={handleEditChange}
                                  className="showflow-input"
                                  style={{width:'6em'}}
                                  placeholder="9:00 AM"
                                  title="Edit start time - subsequent segments will be automatically adjusted"
                                  autoFocus
                                />
                              </td>
                              <td>
                                <input
                                  name="duration"
                                  value={editValues.duration || ''}
                                  onChange={handleEditChange}
                                  className="showflow-input"
                                  style={{width:'5em'}}
                                />
                              </td>
                              <td>
                                <input
                                  name="segment"
                                  value={editValues.segment || ''}
                                  onChange={handleEditChange}
                                  className="showflow-input"
                                  style={{width:'12em'}}
                                />
                              </td>
                              <td>
                                <input
                                  name="presenter"
                                  value={editValues.presenter || ''}
                                  onChange={handleEditChange}
                                  className="showflow-input"
                                  style={{width:'10em'}}
                                />
                              </td>
                              {/* Save/Cancel buttons */}
                              <td colSpan={5} style={{minWidth:120}}>
                                <button className="showflow-btn success" onClick={e => { e.stopPropagation(); handleSaveEdit(i); }}>Save</button>
                                <button className="showflow-btn" onClick={e => { e.stopPropagation(); handleCancelEdit(); }} style={{marginLeft:8}}>Cancel</button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td>{seg.time}</td>
                              <td>{seg.duration}</td>
                              <td>{seg.segment}</td>
                              <td>{seg.presenter}</td>
                              {/* Duplicate button */}
                              <td>
                                <button className="showflow-btn success" title="Duplicate segment" onClick={e => { e.stopPropagation(); handleDuplicateSegment(i); }}>⧉</button>
                              </td>                              {/* Add segment after */}
                              <td>
                                <button className={`showflow-btn success`} title="Add segment after" onClick={e => { e.stopPropagation(); handleAddSegment(i + 1); }} style={{
                                    ...(schedule.length === 1 && i === 0 ? {
                                      background: '#22c55e',
                                      color: 'white',
                                      fontWeight: 'bold',
                                      animation: 'pulse 2s infinite',
                                      boxShadow: '0 0 0 4px rgba(34, 197, 94, 0.2)'
                                    } : {})
                                  }}
                                >
                                  {schedule.length === 1 && i === 0 ? '+ Add Next' : '+'}
                                </button>
                              </td>
                              {/* Remove segment */}
                              <td>
                                <button className="showflow-btn danger" title="Remove segment" onClick={e => { e.stopPropagation(); handleRemoveSegment(i); }}>-</button>
                              </td>
                              {/* Edit segment */}
                              <td>
                                <button className="showflow-btn" title="Edit segment" onClick={e => { e.stopPropagation(); handleEdit(i); }}>Edit</button>
                              </td>                              {/* On mobile, render icons at the end */}
                              {isMobileDevice && (
                                <td className="showflow-header-icons" style={{
                                  textAlign: 'right',
                                  minWidth: 96, // increased from 64
                                  display: 'flex',
                                  gap: '12px', // increased from 8px
                                  justifyContent: 'flex-end',
                                  alignItems: 'center',
                                  overflowX: 'auto', // allow horizontal scroll if needed
                                  paddingRight: 8
                                }}>
                                  {/* Alert icon removed from mobile view to prevent overlap with Edit button */}
                                </td>
                              )}
                            </>
                          )}
                        </tr>
                        {/* Expandable notes row */}
                        {(allNotesExpanded || expandedNotesIdx === i) && editIdx !== i && (
                          <tr>
                            <td colSpan={12} style={{background:'#f8fafd',padding:'12px 24px'}}>
                              <input
                                type="text"
                                placeholder="Add notes or feedback..."
                                value={seg.notes || ''}
                                onChange={e => {
                                  const updated = schedule.map((s, idx) => idx === i ? { ...s, notes: e.target.value } : s);
                                  pushHistory(schedule);
                                  setSchedule(updated);
                                }}
                                className="showflow-input"
                                style={{width:'100%'}}
                                autoFocus
                              />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}                  </tbody>                </table>
              </div>              {/* Helpful guidance for building schedule */}
              {schedule.length > 0 && schedule.length <= 3 && (
                <div className="showflow-build-guidance" style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '16px',
                  marginTop: '16px',
                  textAlign: 'center',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  opacity: editIdx !== null ? 0.6 : 1,
                  transition: 'opacity 0.3s ease',
                  pointerEvents: editIdx !== null ? 'none' : 'auto'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '1.2em' }}>🎯</span>                    <strong style={{ color: '#1e293b' }}>
                      {schedule.length === 1 ? 'Great start! Keep building your schedule' : 'Looking good! Add more segments to complete your schedule'}
                    </strong>
                  </div>
                  
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginBottom: '12px' }}>
                    <button
                      className="showflow-btn success"
                      onClick={() => handleAddSegment(schedule.length)}
                      style={{ fontSize: '0.9em', padding: '8px 16px' }}
                    >
                      + Add Next Segment
                    </button>
                    
                    <button
                      className="showflow-btn success"
                      onClick={() => handleAddSegment(0)}
                      style={{ fontSize: '0.9em', padding: '8px 16px' }}
                    >
                      + Add at Beginning
                    </button>

                    {schedule.length > 1 && (
                      <button
                        className="showflow-btn success"
                        onClick={() => handleAddSegment(Math.floor(schedule.length / 2))}
                        style={{ fontSize: '0.9em', padding: '8px 16px' }}
                      >
                        + Insert in Middle
                      </button>
                    )}
                  </div>

                  <div style={{ fontSize: '0.85em', color: '#64748b', lineHeight: '1.4' }}>
                    <div style={{ marginBottom: '4px' }}>
                      💡 <strong>Quick tips:</strong> Click the <strong>+</strong> button next to any segment to add after it
                    </div>
                    <div>
                      ⌨️ <strong>Keyboard shortcuts:</strong> Press <kbd style={{
                        background: '#e2e8f0',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.8em',
                        border: '1px solid #cbd5e1'
                      }}>Ctrl+Enter</kbd> to add segments quickly
                    </div>
                  </div>
                </div>
              )}
              </>
            )}
          </section>
          {/* Summary/Action Log Section */}
          <section className="showflow-card">
            <h2>Action Log</h2>
            <div className="showflow-summary-container">
              <div className="showflow-summary-column">
                <h3>Recent Actions</h3>
                <ul className="showflow-summary-list">
                  {summary.length === 0 && (
                    <div className="showflow-empty" style={{textAlign:'center',padding:'16px 0'}}>
                      <span style={{fontSize:'0.9em',color:'#666'}}>No recent actions to show.</span>
                    </div>
                  )}
                  {summary.slice(-5).map((s, idx) => (
                    <li key={idx} className="showflow-summary-item">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="showflow-summary-column">
                <h3>Scheduled Alerts</h3>
                <ul className="showflow-summary-list">
                  {alerts.length === 0 && (
                    <div className="showflow-empty" style={{textAlign:'center',padding:'16px 0'}}>
                      <span style={{fontSize:'0.9em',color:'#666'}}>No alerts scheduled.</span>
                    </div>
                  )}
                  {alerts.map((a, idx) => (
                    <li key={idx} className="showflow-summary-item">
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
          {/* Debug/Settings Section (hidable) */}
          {showDebug && (
            <section className="showflow-card" style={{marginTop:24}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <h2 style={{margin:0}}>Settings & Debug</h2>
                <button className="showflow-btn" onClick={handleDebugNow} style={{marginLeft:8}}>Set Debug Now</button>
                <button className="showflow-btn" onClick={() => setShowDebug(false)} style={{marginLeft:8}}>Hide Debug</button>
              </div>
              <div style={{marginTop:16}}>
                <label style={{display:'block',marginBottom:8}}>
                  Font Size:
                  <input
                    type="range"
                    min="0.8"
                    max="1.5"
                    step="0.1"
                    value={fontSize}
                    onChange={e => setFontSize(parseFloat(e.target.value))}
                    style={{marginLeft:8,width:'calc(100% - 32px)',display:'inline-block'}}
                  />
                </label>
                <label style={{display:'block',marginBottom:8}}>
                  High Contrast:
                  <input
                    type="checkbox"
                    checked={highContrast}
                    onChange={e => setHighContrast(e.target.checked)}
                    style={{marginLeft:8}}
                  />
                </label>
              </div>
              {/* Debug controls (hidden by default) */}
              <div style={{marginTop:16}}>
                <button className="showflow-btn" onClick={handleResetDebugNow} style={{marginRight:8}}>Reset Debug Now</button>
                <button className="showflow-btn" onClick={() => setDebugNow(new Date())}>Set Now to Current Time</button>
              </div>
            </section>
          )}
            </>
          )}
        </main>
        )}
        {/* Undo/Redo/Reset Footer Controls + Dark Mode Toggle */}
        {!presenterViewMode && (
          <>
            {isMobileDevice ? (
          <footer className="showflow-footer-controls" style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'rgba(255,255,255,0.95)',
            borderTop: '2px solid rgba(108,123,189,0.3)',
            padding: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            boxShadow: '0 -4px 12px rgba(0,0,0,0.15)',
            backdropFilter: 'blur(10px)'
          }}>
            <button
              className="showflow-btn"
              style={{ 
                width: '100%', 
                fontSize: '1.2em', 
                fontWeight: '600',
                padding: '16px 0', 
                borderRadius: 0, 
                background: 'none', 
                border: 'none', 
                textAlign: 'center',
                color: '#6c7bbd'
              }}
              onClick={() => setMobileFooterMenuOpen(v => !v)}
              aria-label="Show controls"
            >
              ☰ Menu
            </button>
            {mobileFooterMenuOpen && (
              <div style={{
                position: 'fixed',
                bottom: 56,
                left: 0,
                right: 0,
                background: '#fff',
                zIndex: 2002,
                boxShadow: '0 -2px 8px rgba(0,0,0,0.08)',
                borderTop: '1px solid #e0e4f7',
                padding: '12px 16px',
                maxWidth: '100vw',
                boxSizing: 'border-box'
              }}>
                <button className="showflow-btn" onClick={toggleTheme} style={{ width: '100%', margin: '8px 0', display: 'block', boxSizing: 'border-box' }}>
                  {theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
                </button>
                <button className="showflow-btn" onClick={() => setShowMobileEdit(true)} style={{ width: '100%', margin: '8px 0', display: 'block', boxSizing: 'border-box' }}>
                  ⚙️ Edit Mode
                </button>
                <button className="showflow-btn" onClick={handleUndo} disabled={history.length === 0} style={{ width: '100%', margin: '8px 0', display: 'block', boxSizing: 'border-box' }}>Undo</button>
                <button className="showflow-btn" onClick={handleRedo} disabled={future.length === 0} style={{ width: '100%', margin: '8px 0', display: 'block', boxSizing: 'border-box' }}>Redo</button>
                <button className="showflow-btn danger" onClick={handleResetAll} style={{ width: '100%', margin: '8px 0', display: 'block', boxSizing: 'border-box' }}>Reset All</button>
                <button className="showflow-btn" onClick={() => setMobileFooterMenuOpen(false)} style={{ width: '100%', margin: '8px 0', display: 'block', boxSizing: 'border-box' }}>Close</button>
              </div>
            )}
          </footer>
        ) : (
          // Desktop Footer Controls
          <footer className="showflow-footer-controls" style={{position:'fixed',bottom:0,left:0,right:0,background:'#f8fafd',borderTop:'1px solid #e0e4f7',padding:'12px 0',display:'flex',justifyContent:'center',alignItems:'center',zIndex:1000,boxShadow:'0 -2px 8px rgba(60,80,160,0.04)'}}>
            <button
              className="showflow-btn success"
              style={{ marginRight: 16 }}
              onClick={handleExportSchedule}
              title="Export schedule as CSV"
            >
              Export CSV
            </button>
            <button className="showflow-btn" onClick={handleUndo} disabled={history.length === 0} style={{marginRight:16}}>Undo</button>
            <button className="showflow-btn" onClick={handleRedo} disabled={future.length === 0} style={{marginRight:16}}>Redo</button>
            <button className="showflow-btn danger" onClick={handleResetAll} style={{marginRight:24}}>Reset All</button>
            <button className="showflow-btn" onClick={togglePresenterView} style={{marginRight:8, backgroundColor: presenterViewMode ? '#6c7bbd' : '', color: presenterViewMode ? '#fff' : ''}}>
              {presenterViewMode ? '← Normal View' : '👁️ Presenter View'}
            </button>
            <button className="showflow-btn" onClick={toggleTheme} style={{marginLeft:8}}>
              {theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
            </button>
            <a
              href="https://aka.ms/sfbugtracker"
              target="_blank"
              rel="noopener noreferrer"
              className="showflow-btn"
              style={{ marginLeft: 8 }}
            >
              🐞 Report a Bug
            </a>
          </footer>
        )}
        {/* QR Code & Share Modal */}
        {showQR && (
          <div className="showflow-qr-modal">
            <div className="showflow-qr-content">
              <h2>Share Schedule</h2>
              <p>Share this link with others to view the schedule:</p>
              <input
                type="text"
                value={shareLink}
                readOnly
                className="showflow-input"
                style={{width:'100%',marginBottom:16}}
              />
              <QRCodeSVG
                value={shareLink}
                size={128}
                style={{marginBottom:16}}
              />
              <button className="showflow-btn primary" onClick={() => navigator.clipboard.writeText(shareLink)}>
                Copy Link to Clipboard
              </button>
              <button className="showflow-btn" onClick={handleShowQR} style={{marginTop:8}}>
                Close
              </button>
            </div>
          </div>
        )}
        {/* Shortcuts Help Modal */}
        {showShortcuts && (
          <div className="showflow-shortcuts-modal">
            <div className="showflow-shortcuts-content">
              <h2>Keyboard Shortcuts</h2>
              <button className="showflow-btn" onClick={() => setShowShortcuts(false)} style={{position:'absolute',top:8,right:8}}>✖️</button>
              <div style={{maxHeight:'70vh',overflowY:'auto'}}>
                <h3>Navigation</h3>
                <div className="showflow-shortcut-item">
                  <div className="showflow-shortcut-key">⌨️</div>
                  <div className="showflow-shortcut-desc">Focus on schedule table</div>
                </div>
                <div className="showflow-shortcut-item">
                  <div className="showflow-shortcut-key">↑ ↓</div>
                  <div className="showflow-shortcut-desc">Navigate segments</div>
                </div>
                <div className="showflow-shortcut-item">
                  <div className="showflow-shortcut-key">← →</div>
                  <div className="showflow-shortcut-desc">Adjust time/duration</div>
                </div>
                <div className="showflow-shortcut-item">
                  <div className="showflow-shortcut-key">Enter</div>
                  <div className="showflow-shortcut-desc">Edit selected segment</div>
                </div>
                <div className="showflow-shortcut-item">
                  <div className="showflow-shortcut-key">Esc</div>
                  <div className="showflow-shortcut-desc">Cancel edit or close modal</div>
                </div>
                <h3 style={{marginTop:24}}>Editing</h3>
                <div className="showflow-shortcut-item">
                  <div className="showflow-shortcut-key">Tab</div>
                  <div className="showflow-shortcut-desc">Next field</div>
                </div>
                <div className="showflow-shortcut-item">
                  <div className="showflow-shortcut-key">Shift + Tab</div>
                  <div className="showflow-shortcut-desc">Previous field</div>
                </div>
                <div className="showflow-shortcut-item">
                  <div className="showflow-shortcut-key">Ctrl + Z</div>
                  <div className="showflow-shortcut-desc">Undo</div>
                </div>
                <div className="showflow-shortcut-item">
                  <div className="showflow-shortcut-key">Ctrl + Y</div>
                  <div className="showflow-shortcut-desc">Redo</div>
                </div>
                <div className="showflow-shortcut-item">
                  <div className="showflow-shortcut-key">Ctrl + A</div>
                  <div className="showflow-shortcut-desc">Select all</div>
                </div>
                <div className="showflow-shortcut-item">
                  <div className="showflow-shortcut-key">Delete</div>
                  <div className="showflow-shortcut-desc">Remove segment</div>
                </div>
                <h3 style={{marginTop:24}}>Miscellaneous</h3>
                <div className="showflow-shortcut-item">
                  <div className="showflow-shortcut-key">F1</div>
                  <div className="showflow-shortcut-desc">Show this help</div>
                </div>
                <div className="showflow-shortcut-item">
                  <div className="showflow-shortcut-key">F2</div>
                  <div className="showflow-shortcut-desc">Toggle theme</div>
                </div>
                <div className="showflow-shortcut-item">
                  <div className="showflow-shortcut-key">F3</div>
                  <div className="showflow-shortcut-desc">Toggle Presenter View</div>
                </div>
                <div className="showflow-shortcut-item">
                  <div className="showflow-shortcut-key">F5</div>
                  <div className="showflow-shortcut-desc">Refresh schedule</div>
                </div>
                <div className="showflow-shortcut-item">
                  <div className="showflow-shortcut-key">Ctrl + P</div>
                  <div className="showflow-shortcut-desc">Print schedule</div>
                </div>
                <div className="showflow-shortcut-item">
                  <div className="showflow-shortcut-key">Ctrl + Shift + D</div>
                  <div className="showflow-shortcut-desc">Toggle debug settings (hidden)</div>
                </div>
              </div>
            </div>
          </div>        )}

        {/* Mobile Floating Action Button for adding segments */}
        {isMobileDevice && schedule.length > 0 && schedule.length <= 3 && (
          <button
            onClick={() => handleAddSegment(schedule.length)}
            style={{
              position: 'fixed',
              bottom: '20px',
              right: '20px',
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              backgroundColor: '#22c55e',
              color: 'white',
              border: 'none',
              fontSize: '24px',
              fontWeight: 'bold',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              cursor: 'pointer',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease'
            }}
            title="Add next segment"
          >
            +
          </button>
        )}

        {/* Enhanced Data Preview Modal */}
        <DataPreviewModal
          isOpen={showPreviewModal}
          onClose={handleRejectPreview}
          parseResult={previewData}
          onAccept={handleAcceptPreview}
          onReject={handleRejectPreview}
        />
          </>
        )}
      </div>
    </MobileErrorBoundary>
  );
};

export default ShowFlowAgent;
