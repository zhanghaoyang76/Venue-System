/** Keep in sync with frontend common/venues.uts. */
const VENUES = [
  {
    id: 'football',
    name: '足球场',
    desc: '11 人制标准场地，支持半场 / 全场预约。',
    accent: '#1d1d1f',
    emoji: '⚽',
    halfCourtEnabled: true,
  },
  {
    id: 'basketball',
    name: '篮球场',
    desc: '室内外场地开放，按时段入场。',
    accent: '#1d1d1f',
    emoji: '🏀',
    halfCourtEnabled: true,
  },
  {
    id: 'pingpong',
    name: '乒乓球场',
    desc: '室内球台，适合短时训练与课后活动。',
    accent: '#1d1d1f',
    emoji: '🏓',
    halfCourtEnabled: false,
  },
  {
    id: 'badminton',
    name: '羽毛球场',
    desc: '塑胶场地，请穿运动鞋入场。',
    accent: '#1d1d1f',
    emoji: '🏸',
    halfCourtEnabled: false,
  },
];

const byId = new Map(VENUES.map((v) => [v.id, v]));

function getVenue(venueId) {
  return byId.get(venueId) || null;
}

function isValidVenueId(venueId) {
  return byId.has(venueId);
}

module.exports = { VENUES, getVenue, isValidVenueId };
