const jwt = require('jsonwebtoken');
const config = require('./config');
const { getUserById } = require('./db');

function signToken(user) {
  return jwt.sign(
    {
      uid: user.id,
      role: user.role,
    },
    config.jwtSecret,
    { expiresIn: '30d' }
  );
}

function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

function authMiddleware(requiredRole) {
  return async (req, res, next) => {
    const h = req.headers.authorization || '';
    const m = h.match(/^Bearer\s+(.+)$/i);
    if (!m) {
      return res.status(401).json({ error: '缺少 Authorization: Bearer token' });
    }
    try {
      const payload = verifyToken(m[1]);
      const user = await getUserById(payload.uid);
      if (!user) {
        return res.status(401).json({ error: '用户不存在' });
      }
      if (user.role !== payload.role) {
        return res.status(401).json({ error: '登录已失效，请重新登录' });
      }
      if (requiredRole && user.role !== requiredRole) {
        return res.status(403).json({ error: '无权访问' });
      }
      req.user = user;
      next();
    } catch (e) {
      return res.status(401).json({ error: 'token 无效或已过期' });
    }
  };
}

const requireUser = authMiddleware(null);
const requireAdmin = authMiddleware('admin');

module.exports = {
  signToken,
  verifyToken,
  authMiddleware,
  requireUser,
  requireAdmin,
};
