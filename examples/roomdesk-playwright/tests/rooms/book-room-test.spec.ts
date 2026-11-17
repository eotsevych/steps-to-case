import { test } from '@fixtures';
import { bookingData } from '@data/booking';
import { rooms } from '@data/rooms';

test('Book Room Test', async ({ roomsPage, bookPage, confirmedPage }) => {
  const booking = bookingData({ slot: '10:30' });

  await roomsPage.open();
  await roomsPage.selectOffice('Berlin');
  await roomsPage.selectDay('Friday');
  await roomsPage.selectPeople('8 or more');
  await roomsPage.clickOnSearch();
  await roomsPage.clickOnBook(rooms.atlas.name);
  await bookPage.fillMeetingTitle(booking.title);
  await bookPage.selectTimeFor(booking.slot);
  await bookPage.fillInvitePeople(booking.attendees[0]); // typed only, no Enter: nobody is added
  await bookPage.checkAddAVideoCallLink();
  await bookPage.clickOnConfirmBooking();
  await confirmedPage.assertBookingIsConfirmedWithAMessageDetails(
    `${rooms.atlas.name}, Friday ${booking.slot}, "${booking.title}", just you, video call`,
  );
});
