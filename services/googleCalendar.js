const { google } = require('googleapis');
const { OAuth2 } = google.auth;

class GoogleCalendarService {
  constructor() {
    this.oauth2Client = new OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }

  setCredentials(tokens) {
    this.oauth2Client.setCredentials(tokens);
  }

  async listEvents() {
    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
    try {
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: new Date().toISOString(),
        maxResults: 100,
        singleEvents: true,
        orderBy: 'startTime',
      });
      return response.data.items;
    } catch (error) {
      console.error('Error fetching Google Calendar events:', error);
      throw error;
    }
  }

  async createEvent(event) {
    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
    try {
      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
          summary: event.title,
          description: event.description,
          location: event.location,
          start: {
            dateTime: event.startTime,
            timeZone: 'Asia/Kolkata',
          },
          end: {
            dateTime: event.endTime,
            timeZone: 'Asia/Kolkata',
          },
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error creating Google Calendar event:', error);
      throw error;
    }
  }

  async updateEvent(eventId, event) {
    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
    try {
      const response = await calendar.events.update({
        calendarId: 'primary',
        eventId: eventId,
        requestBody: {
          summary: event.title,
          description: event.description,
          location: event.location,
          start: {
            dateTime: event.startTime,
            timeZone: 'Asia/Kolkata',
          },
          end: {
            dateTime: event.endTime,
            timeZone: 'Asia/Kolkata',
          },
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error updating Google Calendar event:', error);
      throw error;
    }
  }

  async deleteEvent(eventId) {
    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
    try {
      await calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId,
      });
    } catch (error) {
      console.error('Error deleting Google Calendar event:', error);
      throw error;
    }
  }

  getAuthUrl() {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/calendar'],
    });
  }

  async getTokens(code) {
    const { tokens } = await this.oauth2Client.getToken(code);
    return tokens;
  }
}

module.exports = new GoogleCalendarService();
