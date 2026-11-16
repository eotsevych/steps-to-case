export interface BookingData {
  title: string;
  /** Time label of a free slot: '10:30', '13:00' or '15:30'. */
  slot: string;
  attendees: string[];
  videoCall: boolean;
}

/** Valid booking with a unique title; override only what the test is about. */
export function bookingData(overrides: Partial<BookingData> = {}): BookingData {
  return {
    title: `Sprint planning ${Date.now().toString(36)}`,
    slot: '10:30',
    attendees: ['sam@roomdesk.test'],
    videoCall: false,
    ...overrides,
  };
}
