/** Visible option labels of the search form. */
export type Office = 'Any office' | 'Berlin' | 'Lisbon';
export type Day = 'Today' | 'Tomorrow' | 'Friday';
export type People = 'Any size' | '4 or more' | '8 or more';

export interface RoomSearch {
  office?: Office;
  day?: Day;
  people?: People;
}

/** Rooms served by docs/demo/api/rooms.json. */
export const rooms = {
  atlas: { id: 'atlas', name: 'Atlas', office: 'Berlin', floor: '3rd floor', seats: 8 },
  fjord: { id: 'fjord', name: 'Fjord', office: 'Berlin', floor: '3rd floor', seats: 4 },
  harbor: { id: 'harbor', name: 'Harbor', office: 'Berlin', floor: '5th floor', seats: 12 },
  tejo: { id: 'tejo', name: 'Tejo', office: 'Lisbon', floor: '1st floor', seats: 6 },
  alfama: { id: 'alfama', name: 'Alfama', office: 'Lisbon', floor: '2nd floor', seats: 10 },
  nook: { id: 'nook', name: 'Nook', office: 'Lisbon', floor: '2nd floor', seats: 2 },
} as const;
