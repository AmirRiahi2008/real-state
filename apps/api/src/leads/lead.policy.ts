import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { LeadStatus, LeadType, Role } from '@prisma/client';
import { CreateLeadDto, UpdateLeadDto } from './leads.dto';

export function validateLeadInput(dto: CreateLeadDto, now = new Date()): void {
  if (Object.values(dto).some((value) => value === null))
    throw new BadRequestException('Lead fields cannot be null');
  const listingTarget = dto.type === LeadType.ENQUIRY || dto.type === LeadType.VIEWING;
  const projectTarget = dto.type === LeadType.PROJECT;
  if (listingTarget && (!dto.listingId || dto.projectId))
    throw new BadRequestException(
      'Property enquiries and viewings require exactly one listing target',
    );
  if (projectTarget && (!dto.projectId || dto.listingId))
    throw new BadRequestException('Project enquiries require exactly one project target');
  if (!listingTarget && !projectTarget && (dto.listingId || dto.projectId))
    throw new BadRequestException(
      'General valuation and mortgage requests cannot specify a target',
    );
  if (dto.type === LeadType.VIEWING) {
    const preferred = dto.preferredAt ? new Date(dto.preferredAt).getTime() : Number.NaN;
    if (
      !Number.isFinite(preferred) ||
      preferred <= now.getTime() ||
      preferred > now.getTime() + 365 * 86400000
    )
      throw new BadRequestException('Choose a viewing time in the next 365 days');
  } else if (dto.preferredAt !== undefined)
    throw new BadRequestException('Preferred time is only supported for a viewing request');
}

export function validateLeadUpdate(current: LeadStatus, dto: UpdateLeadDto, role: Role): void {
  if (dto.status === null || dto.internalNotes === null)
    throw new BadRequestException('Status and notes cannot be null');
  if (dto.status === undefined && dto.internalNotes === undefined && dto.assignedToId === undefined)
    throw new BadRequestException('Provide a status, internal notes or assignment');
  if (role !== Role.ADMIN && dto.assignedToId !== undefined)
    throw new ForbiddenException('Only administrators can assign leads');
  if (!dto.status || dto.status === current) return;
  const next: Record<LeadStatus, LeadStatus[]> = {
    NEW: [LeadStatus.CONTACTED, LeadStatus.CLOSED],
    CONTACTED: [LeadStatus.QUALIFIED, LeadStatus.CLOSED],
    QUALIFIED: [LeadStatus.CLOSED],
    CLOSED: role === Role.ADMIN ? [LeadStatus.NEW] : [],
  };
  if (!next[current].includes(dto.status))
    throw new BadRequestException('Unsupported lead status transition');
}
