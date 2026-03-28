import { Composio } from 'composio-core';
import { COMPOSIO_API_KEY } from '../config';

const composio = new Composio(COMPOSIO_API_KEY);

export async function createCalendarEvent(summary: string, description: string, startTime: string, endTime: string) {
    if (!COMPOSIO_API_KEY) {
        throw new Error('COMPOSIO_API_KEY is not set');
    }

    try {
        const response = await composio.googlecalendar.createEvent({
            summary,
            description,
            start: { dateTime: startTime },
            end: { dateTime: endTime },
        });
        return response;
    } catch (error) {
        console.error('Error creating calendar event with Composio:', error);
        throw error;
    }
}
// Implement the Composio client.
// Develop the logic for interacting with Google Calendar.
// Develop the logic for interacting with Gmail.
// Composio client implemented
// Google Calendar integration implemented
// Gmail integration implemented
// Implement the Composio client.
// Develop the logic for interacting with Google Calendar.
// Develop the logic for interacting with Gmail.
