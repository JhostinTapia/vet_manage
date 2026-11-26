import { BadRequestException } from '@nestjs/common';

export function calendarPeriod(fecha: string, vista: 'dia' | 'semana' | 'mes') {
  const date = new Date(`${fecha}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(fecha) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== fecha ||
    !['dia', 'semana', 'mes'].includes(vista)
  ) {
    throw new BadRequestException('Fecha o vista de calendario inválida');
  }
  if (vista === 'semana')
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  if (vista === 'mes') date.setUTCDate(1);
  const start = new Date(date);
  if (vista === 'mes') date.setUTCMonth(date.getUTCMonth() + 1);
  else date.setUTCDate(date.getUTCDate() + (vista === 'semana' ? 7 : 1));
  const days: string[] = [];
  for (let day = start.getTime(); day < date.getTime(); day += 86400000)
    days.push(new Date(day).toISOString().slice(0, 10));
  return {
    desde: days[0],
    hastaExclusiva: date.toISOString().slice(0, 10),
    days,
    inicio: new Date(`${days[0]}T00:00:00-05:00`),
    fin: new Date(`${date.toISOString().slice(0, 10)}T00:00:00-05:00`),
  };
}
