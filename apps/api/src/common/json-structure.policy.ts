import { BadRequestException } from '@nestjs/common';

/** Bound JSON before class-transformer performs its own recursive traversal. */
export function assertJsonStructure(input: unknown): void {
  const maximumDepth = 32,
    maximumValues = 100000;
  const pending: { value: unknown; depth: number }[] = [{ value: input, depth: 0 }];
  let count = 0;
  while (pending.length) {
    const { value, depth } = pending.pop()!;
    if (depth > maximumDepth || ++count > maximumValues)
      throw new BadRequestException('Request structure is too complex');
    if (value === null || typeof value !== 'object') continue;
    const children = Array.isArray(value) ? value : Object.values(value);
    if (children.length + count + pending.length > maximumValues)
      throw new BadRequestException('Request structure is too complex');
    for (const child of children) pending.push({ value: child, depth: depth + 1 });
  }
}
