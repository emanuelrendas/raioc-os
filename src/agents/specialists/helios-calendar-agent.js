/**
 * RAIOC Specialist Agent: HELIOS (Advisory Calendar & Scheduling)
 * Manages Google Calendar advisory bookings, client appointment links, and consultation time slots.
 */

import { BaseSpecialistAgent } from './base-agent.js';

export class HeliosCalendarAgent extends BaseSpecialistAgent {
  constructor() {
    super({
      id: 'helios',
      name: 'HELIOS',
      role: 'Advisory Calendar & Scheduling Specialist',
      capabilities: ['calendar_booking', 'appointment_coordination', 'google_meet_generation', 'availability_management'],
      systemPrompt: 'You coordinate private real estate advisory consultations, generate Google Meet links, and manage advisory calendar slots.',
    });
  }

  async processTask(task, context = {}) {
    const { attendeeEmail, summary, durationMinutes = 45, startIso } = task;

    const bookingResult = await this.invokeTool('schedule_calendar_advisory', {
      attendeeEmail,
      summary: summary || 'Private UAE Real Estate Advisory Session — Emanuel Rendas',
      durationMinutes,
      startIso,
    });

    this.logDecision(
      `Scheduled advisory consultation for ${attendeeEmail || 'Client'}: Google Meet generated, calendar synchronized`,
      'CONFIRM_ADVISORY_APPOINTMENT',
      {
        objectiveId: context.correlationId,
        confidenceScore: 0.98,
        impactLevel: 'MEDIUM',
        metadata: { meetLink: bookingResult.meetLink, start: bookingResult.start },
      }
    );

    this.storeMemory(`calendar_booking_${attendeeEmail || Date.now()}`, bookingResult, {
      tags: ['calendar', 'booking', 'consultation', attendeeEmail || ''],
    });

    return bookingResult;
  }
}

export const heliosCalendarAgent = new HeliosCalendarAgent();
