# Battle Testing Scenarios for Time Editing

## Scenario 1: "The Running Late Speaker"
1. Load your full event schedule
2. Start live tracking (green play button)
3. Wait until 2nd or 3rd segment is active
4. **Edit the CURRENT active segment** time to 15 minutes later
5. **Verify**: All future segments cascade forward properly
6. **Check**: Live tracking still works correctly

## Scenario 2: "The Early Finisher" 
1. Load schedule and start tracking
2. When lunch break starts, edit its time to start 20 minutes early
3. **Verify**: All afternoon sessions move up accordingly
4. **Check**: Times stay in PM, don't wrap to AM

## Scenario 3: "The Schedule Chaos"
1. Load schedule
2. Edit time of segment 3 to much later (e.g., 10:30 AM → 1:30 PM)
3. **Verify**: Segments 4+ all cascade to afternoon properly
4. Edit duration of segment 5 to 60 minutes
5. **Verify**: Uses cascade mode, recalculates from beginning
6. Edit time of segment 7
7. **Verify**: Uses smart-edit mode, preserves segments 1-6

## Scenario 4: "The Boundary Crosser"
1. Create/load schedule with segments around noon
2. Edit 11:45 AM segment to 12:15 PM
3. **Verify**: Subsequent segments stay in PM correctly
4. Edit 11:30 PM segment to 11:45 PM (if you have evening events)
5. **Verify**: No midnight wraparound issues

## Scenario 5: "The Undo Stress Test"
1. Make 5-6 time edits across different segments
2. Use Ctrl+Z to undo each one
3. Use Ctrl+Y to redo them
4. **Verify**: History tracking works correctly
5. Make new edit → verify redo stack clears

## Scenario 6: "The Import/Export Challenge"
1. Load schedule and make multiple time edits
2. Export to Excel
3. Close browser/reload page
4. Import the same Excel file
5. **Verify**: All your time edits persisted correctly
6. Make more time edits on imported schedule

## Expected Results:
- ✅ Time edits should trigger "smart-edit" mode
- ✅ Duration edits should trigger "cascade" mode  
- ✅ Times should never wrap from PM to AM incorrectly
- ✅ Live tracking should handle time changes gracefully
- ✅ Console should show debug output during edits

## Red Flags to Watch For:
- ❌ Times jumping from PM to AM unexpectedly
- ❌ Time edits not triggering recalculation
- ❌ Segments reverting to original times
- ❌ Live tracking breaking after time edits
- ❌ Undo/redo causing data corruption
