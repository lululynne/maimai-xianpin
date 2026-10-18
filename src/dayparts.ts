export type MenuDaypart = 'breakfast' | 'regular';
export type MenuPeriod = 'breakfast' | 'lunch' | 'dinner';

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

export function menuPeriod(at: number): MenuPeriod {
  if (menuDaypart(at) === 'breakfast') return 'breakfast';
  return new Date(at + 8 * 60 * 60_000).getUTCHours() < 17 ? 'lunch' : 'dinner';
}

export function serviceTime(reservationDate?: unknown, capturedAt?: string): number {
  if (typeof reservationDate === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(reservationDate)) return Date.parse(reservationDate.replace(' ', 'T') + ':00+08:00');
  return Date.parse(capturedAt ?? '');
}
