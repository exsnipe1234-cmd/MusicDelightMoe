'use client';

import { memo, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import type { DatesSetArg, EventChangeArg, EventInput } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { DateClickArg } from '@fullcalendar/interaction';
import { Loader2, MapPin } from 'lucide-react';
import type { LessonRow } from '../../../providers/AppDataProvider';
import { mapsUrl } from './calendarUtils';
import { teacherInitials } from './teacherInitials';
import styles from './calendar.module.css';

type Props = {
  calendarRef: React.Ref<FullCalendar>;
  events: EventInput[];
  loading: boolean;
  mobileCalendar: boolean;
  nativeCalendar: boolean;
  dayMaxEvents: number;
  onDatesSet: (arg: DatesSetArg) => void;
  onDateClick: (date: string) => void;
  onEventClick: (lesson: LessonRow) => void;
  onMove: (arg: EventChangeArg) => Promise<void>;
};

export default memo(CalendarView);

function CalendarView({ calendarRef, events, loading, mobileCalendar, nativeCalendar, dayMaxEvents, onDatesSet, onDateClick, onEventClick, onMove }: Props) {
  const eventContent = useCallback((arg: { event: { extendedProps: LessonRow }; view: { type: string } }) => {
    const lesson = arg.event.extendedProps;
    const month = arg.view.type === 'dayGridMonth';
    const initials = teacherInitials(lesson.teacher_name);
    const teacherName = lesson.teacher_name ?? 'Unassigned';
    return month ? (
      <div className="eventCard compact" title={`${lesson.school} \u00b7 ${lesson.class_name} \u00b7 ${teacherName}`}>
        <span>{lesson.start_time.slice(0, 5)}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3, minWidth: 0 }}>
          <strong style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lesson.school}</strong>
          <a href={mapsUrl(lesson.school)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ flexShrink: 0, color: 'inherit', opacity: 0.65, display: 'flex' }} aria-label={`Open ${lesson.school} in Google Maps`}>
            <MapPin size={10} aria-hidden="true" />
          </a>
        </span>
        <small style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span className="teacherBadge" aria-hidden="true">{initials}</span>
          {teacherName}
        </small>
      </div>
    ) : (
      <div className="eventCard detailed">
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <strong>{lesson.school}</strong>
          <a href={mapsUrl(lesson.school)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: 'inherit', opacity: 0.65, display: 'flex' }} aria-label={`Open ${lesson.school} in Google Maps`}>
            <MapPin size={11} aria-hidden="true" />
          </a>
        </span>
        <span>{lesson.class_name}</span>
        <small style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span className="teacherBadge" aria-hidden="true">{initials}</span>
          {lesson.start_time.slice(0, 5)}-{lesson.end_time.slice(0, 5)} \u00b7 {teacherName}
        </small>
      </div>
    );
  }, []);

  const eventDidMount = useCallback((info: { event: { extendedProps: { teacherColour?: string } }; el: HTMLElement }) => {
    const color = info.event.extendedProps.teacherColour;
    if (color) {
      info.el.style.setProperty('background-color', color, 'important');
      info.el.style.setProperty('color', '#1a1a2e', 'important');
    }
  }, []);

  const handleDateClick = useCallback((arg: DateClickArg) => onDateClick(arg.dateStr.slice(0, 10)), [onDateClick]);
  const handleEventClick = useCallback((arg: { event: { extendedProps: unknown } }) => onEventClick(arg.event.extendedProps as LessonRow), [onEventClick]);
  return (
    <section className={styles.calendarCard} aria-label="Lesson calendar">
      {loading && events.length === 0 ? (
        <div className={styles.loading} role="status">
          <Loader2 className={styles.spin} aria-hidden="true" /> Loading calendar...
        </div>
      ) : (
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: mobileCalendar || nativeCalendar ? 'dayGridMonth,timeGridDay' : 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          buttonText={{ today: 'Today', month: 'Month', week: 'Week', day: 'Day' }}
          editable
          selectable
          height="auto"
          fixedWeekCount={false}
          showNonCurrentDates={false}
          dayMaxEvents={dayMaxEvents}
          lazyFetching
          events={events}
          datesSet={onDatesSet}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          eventDrop={onMove}
          eventResize={onMove}
          eventContent={eventContent}
          eventDidMount={eventDidMount}
          nowIndicator
          slotMinTime="06:00:00"
          slotMaxTime="22:00:00"
        />
      )}
    </section>
  );
}