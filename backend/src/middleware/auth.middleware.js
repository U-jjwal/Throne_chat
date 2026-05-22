import jwt from "jsonwebtoken";

export const authenticateToken = (req, res, next) => {
  try {
    // Get token from cookie or Authorization header
    let token = req.cookies.token;

    if (!token && req.headers.authorization) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ message: "Unauthorized: No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.userId, email: decoded.email };
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
