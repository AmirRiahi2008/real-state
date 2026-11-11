import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { LeadStatus, LeadType, Role } from '@prisma/client';
import { CreateLeadDto } from './leads.dto';
import { validateLeadInput, validateLeadUpdate } from './lead.policy';
import { leadOwnerScope } from './leads.repository';
const dto = (extra: Partial<CreateLeadDto>): CreateLeadDto => ({
  type: LeadType.ENQUIRY,
  name: 'Example buyer',
  email: 'buyer@example.test',
  phone: '+971501234567',
  message: 'Please share more details.',
  consent: true,
  listingId: 'a',
  ...extra,
});
describe('lead domain boundaries', () => {
  it('requires exactly the appropriate target', () => {
    expect(() => validateLeadInput(dto({ projectId: 'b' }))).toThrow(BadRequestException);
    expect(() => validateLeadInput(dto({ type: LeadType.VALUATION }))).toThrow(BadRequestException);
    expect(() =>
      validateLeadInput(dto({ type: LeadType.PROJECT, listingId: undefined, projectId: 'b' })),
    ).not.toThrow();
  });
  it('requires a future bounded viewing appointment, with timezone checked at DTO validation', () => {
    const now = new Date('2026-11-11T10:00:00Z');
    expect(() => validateLeadInput(dto({ type: LeadType.VIEWING }), now)).toThrow(
      BadRequestException,
    );
    expect(() =>
      validateLeadInput(dto({ type: LeadType.VIEWING, preferredAt: '2026-11-11T09:00:00Z' }), now),
    ).toThrow(BadRequestException);
    expect(() =>
      validateLeadInput(dto({ type: LeadType.VIEWING, preferredAt: '2026-11-12T10:00:00Z' }), now),
    ).not.toThrow();
  });
  it('does not allow a non-viewing request to smuggle an appointment', () =>
    expect(() => validateLeadInput(dto({ preferredAt: '2027-01-01T10:00:00Z' }))).toThrow(
      BadRequestException,
    ));
  it('allows staff to progress a lead but only admins may reassign or reopen', () => {
    expect(() =>
      validateLeadUpdate(LeadStatus.NEW, { status: LeadStatus.CONTACTED }, Role.AGENT),
    ).not.toThrow();
    expect(() => validateLeadUpdate(LeadStatus.NEW, { assignedToId: null }, Role.AGENT)).toThrow(
      ForbiddenException,
    );
    expect(() =>
      validateLeadUpdate(LeadStatus.CLOSED, { status: LeadStatus.NEW }, Role.AGENT),
    ).toThrow(BadRequestException);
    expect(() =>
      validateLeadUpdate(LeadStatus.CLOSED, { status: LeadStatus.NEW }, Role.ADMIN),
    ).not.toThrow();
  });
  it('scopes non-admin lead retrieval to the current agent', () => {
    expect(
      leadOwnerScope({
        id: 'agent-a',
        role: Role.AGENT,
        email: 'a@example.test',
        sessionId: 'session',
      }),
    ).toEqual({ assignedToId: 'agent-a' });
    expect(
      leadOwnerScope({
        id: 'admin',
        role: Role.ADMIN,
        email: 'admin@example.test',
        sessionId: 'session',
      }),
    ).toEqual({});
  });
});
