import '@fullcalendar/interaction';
import type { EventApi } from '@fullcalendar/core';

declare module '@fullcalendar/interaction' {
  export type EventDropArg = {
    event: EventApi;
    revert: () => void;
  };
}
