const { verifyToken } = require("../utils/jwt");

function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const [scheme, token] = authHeader.split(" ");
    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ message: "Authentication required." });
    }

    const payload = verifyToken(token);
    req.user = {
      id: payload.id,
      name: payload.name,
      email: payload.email,
      role: payload.role
    };
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required." });
    }

    if (roles.length > 0 && !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "You are not authorized for this action." });
    }

    return next();
  };
}

module.exports = {
  authenticate,
  authorize
};
