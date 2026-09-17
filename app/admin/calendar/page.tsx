'use client';

import Link from 'next/link';
import { CalendarDays, CalendarPlus, List, Plus, WifiOff } from 'lucide-react';
import { useCalendarState } from './_components/useCalendarState';
import SmartDashboard from '../components/SmartDashboard';
import CalendarView from './_components/CalendarView';
import DayPanel from './_components/DayPanel';
import LessonEditorDrawer from './_components/LessonEditorDrawer';
import QuickAddDrawer from './_components/QuickAddDrawer';
import RecurringDrawer from './_components/RecurringDrawer';
import FilterBar from './_components/FilterBar';
import BulkToolbar from './_components/BulkToolbar';
import WorkloadPanels from './_components/WorkloadPanels';
import UndoBanner from './_components/UndoBanner';
import styles from './_components/calendar.module.css';

export default function CalendarPage() {
  const state = useCalendarState();

  return (
    <main className={styles.editorShell}>
      <SmartDashboard />
      <datalist id="calendar-school-options">
        {state.schools.map((school) => (
          <option key={school} value={school} />
        ))}
      </datalist>
      <datalist id="calendar-class-options">
        {state.classesForSchool(state.draft.school).map((className) => (
          <option key={className} value={className} />
        ))}
      </datalist>

      <header className={styles.editorHeader}>
        <div>
          <p>MOE SCHEDULE</p>
          <h1>Calendar</h1>
          <span
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            aria-live="polite"
            role={state.messageType === 'error' ? 'alert' : 'status'}
          >
            {!state.connected && (
              <span title="Live sync disconnected">
                <WifiOff size={14} style={{ color: '#fb7185', flexShrink: 0 }} />
              </span>
            )}
            {state.loading ? (
              'Loading\u2026'
            ) : (
              <>
                {state.message}
                {state.messageType === 'error' && state.failedPayload.current && (
                  <button
                    onClick={() => void state.retryFailed()}
                    style={{
                      marginLeft: 8,
                      padding: '3px 8px',
                      border: '1px solid #fb7185',
                      borderRadius: 6,
                      background: 'rgba(251,113,133,.12)',
                      color: '#fb7185',
                      cursor: 'pointer',
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    Retry
                  </button>
                )}
              </>
            )}
          </span>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.quickAddButton} onClick={state.openQuickAdd}>
            <Plus size={17} /> Quick add
          </button>
          <button
            className={styles.exportButton}
            onClick={() => {
              state.setRecurringDraft({
                school: '',
                className: '',
                startTime: '08:00',
                endTime: '09:00',
                teacher: '',
                startDate: '',
                endDate: '',
                weekdays: [],
              });
              state.setRecurringOpen(true);
            }}
          >
            <CalendarPlus size={17} /> Recurring
          </button>
          <button className={styles.exportButton} onClick={state.exportCalendarPdf}>
            <CalendarDays size={17} /> Calendar PDF
          </button>
          <button className={styles.exportButton} onClick={state.exportSchedulePdf}>
            <List size={17} /> Schedule PDF
          </button>
          <Link href="/admin/conflicts" className={styles.conflictLink}>
            Conflicts
          </Link>
        </div>
      </header>

      <UndoBanner
        action={state.topAction}
        stackDepth={state.undoStack.length}
        undoing={state.undoing}
        onUndo={() => void state.undoLast()}
        onDismiss={state.dismissAllUndo}
      />

      <FilterBar
        search={state.search}
        onSearchChange={state.setSearch}
        filter={state.filter}
        onFilterChange={state.setFilter}
        schoolFilter={state.schoolFilter}
        onSchoolFilterChange={state.setSchoolFilter}
        teachers={state.teachers}
        schools={state.schools}
        visibleCount={state.visible.length}
        onClear={() => {
          state.setSearch('');
          state.setFilter('all');
          state.setSchoolFilter('all');
        }}
        searchInputRef={state.searchInputRef}
      />

      <BulkToolbar
        selectedCount={state.selectedLessons.length}
        visibleCount={state.visible.length}
        onSelectVisible={state.selectVisible}
        bulkDate={state.bulkDate}
        onBulkDateChange={state.setBulkDate}
        bulkTeacher={state.bulkTeacher}
        onBulkTeacherChange={state.setBulkTeacher}
        teachers={state.teachers}
        onMove={() => void state.bulkMove()}
        onAssign={() =>
          void state.bulkUpdate({ teacher_name: state.bulkTeacher, unavailable: false }, 'assigned')
        }
        onCancel={() => {
          if (
            !state.selectedLessons.length ||
            !window.confirm(`Cancel ${state.selectedLessons.length} selected lessons?`)
          )
            return;
          void state.bulkUpdate({ cancelled: true }, 'cancelled');
        }}
        onDelete={() => void state.bulkDelete()}
      />

      <WorkloadPanels
        teacherWorkload={state.workload}
        schoolWorkload={state.schoolWorkload}
        cancelledCount={state.cancelledCount}
        filter={state.filter}
        onTeacherFilter={(name) => state.setFilter(name)}
        onSchoolFilter={state.setSchoolFilter}
        onCancelledFilter={() => state.setFilter('cancelled')}
        teacherColour={state.colour}
        workloadCollapsed={state.workloadCollapsed}
        onToggleWorkload={() => state.setWorkloadCollapsed((v) => !v)}
        schoolWorkloadCollapsed={state.schoolWorkloadCollapsed}
        onToggleSchoolWorkload={() => state.setSchoolWorkloadCollapsed((v) => !v)}
      />

      <CalendarView
        calendarRef={state.calendarRef}
        events={state.events}
        loading={state.loading}
        mobileCalendar={state.mobileCalendar}
        nativeCalendar={state.nativeCalendar}
        onDatesSet={state.onDatesSet}
        onDateClick={state.setDay}
        onEventClick={state.openLesson}
        onMove={state.move}
        dayMaxEvents={state.dayMaxEvents}
      />

      {state.day && (
        <DayPanel
          day={state.day}
          dayLessons={state.dayLessons}
          onClose={() => state.setDay(null)}
          onAddLesson={state.addLesson}
          onOpenLesson={state.openLesson}
          onCopyToQuickAdd={state.copyDayLessons}
          onCopyToDates={state.copyDayToDates}
          onNavigateDay={state.navigateDay}
          teacherColour={state.colour}
        />
      )}

      {state.drawer && (
        <LessonEditorDrawer
          draft={state.draft}
          onDraftChange={state.setDraft}
          teachers={state.teachers}
          onSave={() => void state.save()}
          onDelete={() => void state.remove()}
          onDuplicate={state.duplicateLesson}
          onClose={() => state.setDrawer(false)}
        />
      )}

      {state.recurringOpen && (
        <RecurringDrawer
          draft={state.recurringDraft}
          onDraftChange={state.setRecurringDraft}
          teachers={state.teachers}
          onSave={() => void state.saveRecurring()}
          saving={state.recurringSaving}
          onClose={() => state.setRecurringOpen(false)}
        />
      )}

      {state.quickAdd && (
        <QuickAddDrawer
          quickRows={state.quickRows}
          onUpdateRow={state.updateQuickRow}
          onRemoveRow={state.removeQuickRow}
          onAddRow={state.addQuickRow}
          onSave={() => void state.saveQuickRows()}
          saving={state.quickSaving}
          onClose={() => state.setQuickAdd(false)}
          teachers={state.teachers}
          copySourceCount={state.copySourceLessons.length}
          copyDateInput={state.copyDateInput}
          onCopyDateInputChange={state.setCopyDateInput}
          onAddCopyDate={state.addCopyDate}
          copyDates={state.copyDates}
          onSaveCopies={() => void state.saveCopyDates()}
        />
      )}
    </main>
  );
}
