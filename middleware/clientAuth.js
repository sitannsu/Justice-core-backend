const jwt = require('jsonwebtoken');

const clientAuthMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Client authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    if (!decoded.role || decoded.role !== 'client' || !decoded.id) {
      return res.status(401).json({ message: 'Invalid client token' });
    }
    req.user = { id: decoded.id, clientId: decoded.id, role: decoded.role, email: decoded.email };
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

module.exports = clientAuthMiddleware;
