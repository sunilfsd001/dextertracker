const jwt = require("jsonwebtoken");
const { env } = require("../config/env");

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    },
    env.jwt.secret,
    { expiresIn: env.jwt.expiresIn }
  );
}

function verifyToken(token) {
  return jwt.verify(token, env.jwt.secret);
}

module.exports = {
  signToken,
  verifyToken
};
