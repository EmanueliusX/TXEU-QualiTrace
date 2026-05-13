const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'qualitrace-secret';

function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token lipsă sau invalid' });
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Token expirat sau invalid' });
  }
}

function requireRoles(...roles) {
  return (req, res, next) => {
    requireAuth(req, res, () => {
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Acces interzis pentru rolul curent.' });
      }
      next();
    });
  };
}

const requireAdmin = requireRoles('admin');
const requireQualityAdminOrAdmin = requireRoles('admin', 'quality_admin');

module.exports = { requireAuth, requireAdmin, requireQualityAdminOrAdmin, requireRoles };
