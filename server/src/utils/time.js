function timeToMinutes(time) {
  const [h, m] = String(time).split(':').map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
  return h * 60 + m;
}

function minutesToTime(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function buildTimeRange(startTime, durationHours) {
  const start = timeToMinutes(startTime);
  if (start == null) return null;
  const end = start + Math.floor(Number(durationHours) * 60);
  return {
    start,
    end,
    label: `${startTime} - ${minutesToTime(end)}`,
  };
}

function parseTimeRangeLabel(timeSlot) {
  const parts = String(timeSlot).split(' - ');
  const start = timeToMinutes(parts[0]);
  const end = parts.length > 1 ? timeToMinutes(parts[1]) : null;
  if (start == null) return null;
  return {
    start,
    end: end == null ? start + 60 : end,
  };
}

function rangesOverlap(a, b) {
  return a.start < b.end && b.start < a.end;
}

module.exports = {
  timeToMinutes,
  minutesToTime,
  buildTimeRange,
  parseTimeRangeLabel,
  rangesOverlap,
};
