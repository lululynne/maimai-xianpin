export type MenuDaypart = 'breakfast' | 'regular';

// McDonald's store snapshots and the demo both use Beijing time.
export function menuDaypart(at: number): MenuDaypart {
  if (!Number.isFinite(at)) throw new Error('INVALID_MENU_TIME');
  const beijing = new Date(at + 8 * 60 * 60_000);
  return beijing.getUTCHours() * 60 + beijing.getUTCMinutes() < 10 * 60 + 30 ? 'breakfast' : 'regular';
}

export function capturedDaypart(iso?: string): MenuDaypart | undefined {
  const at = Date.parse(iso ?? '');
  return Number.isFinite(at) ? menuDaypart(at) : undefined;
}
