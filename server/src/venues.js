/** 与小程序 common/venues.uts 保持一致 */
const VENUES = [
  { id: 'football', name: '足球场', desc: '11人制标准足球场，需提前预约', accent: '#1a7f37', emoji: '⚽' },
  { id: 'basketball', name: '篮球场', desc: '室内外场地，请按时段入场', accent: '#c45c26', emoji: '🏀' },
  { id: 'pingpong', name: '乒乓球', desc: '室内球台，含球拍租借说明', accent: '#2563eb', emoji: '🏓' },
  { id: 'badminton', name: '羽毛球', desc: '塑胶场地，请穿运动鞋入场', accent: '#7c3aed', emoji: '🏸' },
];

const byId = new Map(VENUES.map((v) => [v.id, v]));

function getVenue(venueId) {
  return byId.get(venueId) || null;
}

function isValidVenueId(venueId) {
  return byId.has(venueId);
}

module.exports = { VENUES, getVenue, isValidVenueId };
