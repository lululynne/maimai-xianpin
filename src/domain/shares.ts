// Drafted by real MiMo CLI; reviewed and integrated by Codex.
export interface ShareMember {
  id: string;
  items: { unitPriceCents: number | null; quantity: number }[];
}

export function allocateShares(
  totalCents: number,
  members: ShareMember[],
  initiatorId: string
): { method: 'weighted' | 'equal-items'; shares: { id: string; cents: number }[] } {
  if (
    typeof totalCents !== 'number' ||
    !Number.isSafeInteger(totalCents) ||
    totalCents < 0 ||
    totalCents > 10_000_000
  ) {
    throw new Error('totalCents must be a safe integer in 0..10000000');
  }
  if (!Array.isArray(members)) {
    throw new Error('members must be an array');
  }
  if (typeof initiatorId !== 'string') {
    throw new Error('initiatorId must be a string');
  }

  const seenIds = new Set<string>();
  let totalQuantity = 0;
  let hasUnknownPrice = false;

  for (const member of members) {
    if (member === null || typeof member !== 'object' || typeof member.id !== 'string') {
      throw new Error('each member must have a string id');
    }
    if (seenIds.has(member.id)) {
      throw new Error(`duplicate member id: ${member.id}`);
    }
    seenIds.add(member.id);
    if (!Array.isArray(member.items)) {
      throw new Error(`member ${member.id}: items must be an array`);
    }
    for (const item of member.items) {
      if (item === null || typeof item !== 'object') {
        throw new Error(`member ${member.id}: item must be an object`);
      }
      const { unitPriceCents, quantity } = item;
      if (unitPriceCents !== null) {
        if (
          typeof unitPriceCents !== 'number' ||
          !Number.isSafeInteger(unitPriceCents) ||
          unitPriceCents < 0
        ) {
          throw new Error(
            `member ${member.id}: unitPriceCents must be null or a non-negative safe integer`
          );
        }
      } else {
        hasUnknownPrice = true;
      }
      if (
        typeof quantity !== 'number' ||
        !Number.isSafeInteger(quantity) ||
        quantity < 1 ||
        quantity > 100
      ) {
        throw new Error(`member ${member.id}: quantity must be a safe integer in 1..100`);
      }
      totalQuantity += quantity;
    }
  }

  if (!seenIds.has(initiatorId)) {
    throw new Error('initiatorId must be one of the members');
  }
  if (totalQuantity <= 0) {
    throw new Error('total item count must be greater than 0');
  }

  let method: 'weighted' | 'equal-items';
  let weights: bigint[];

  if (hasUnknownPrice) {
    method = 'equal-items';
    weights = members.map((m) =>
      m.items.reduce((sum, item) => sum + BigInt(item.quantity), 0n)
    );
  } else {
    weights = members.map((m) => {
      let w = 0n;
      for (const item of m.items) {
        w += BigInt(item.unitPriceCents as number) * BigInt(item.quantity);
      }
      return w;
    });
    const totalWeight = weights.reduce((a, b) => a + b, 0n);
    if (totalWeight === 0n) {
      method = 'equal-items';
      weights = members.map((m) =>
        m.items.reduce((sum, item) => sum + BigInt(item.quantity), 0n)
      );
    } else {
      method = 'weighted';
    }
  }

  const totalWeight = weights.reduce((a, b) => a + b, 0n);
  const total = BigInt(totalCents);
  const shares = members.map((member, i) => ({
    id: member.id,
    cents: Number((total * weights[i]!) / totalWeight),
  }));

  let allocated = 0;
  for (const s of shares) allocated += s.cents;
  const remainder = totalCents - allocated;
  for (const s of shares) {
    if (s.id === initiatorId) {
      s.cents += remainder;
      break;
    }
  }

  return { method, shares };
}
