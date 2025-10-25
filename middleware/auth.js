import jwt from "jsonwebtoken";
import User from "../models/user.js";

const JWT_SECRET = process.env.JWT_SECRET || "manishexpensetracker";

export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization; // no await

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ message: "Unauthorized: No token provided" });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, JWT_SECRET);
    

    const user = await User.findById(decoded.userId);
    if (!user)
      return res.status(401).json({ message: "Unauthorized: User not found" });

    req.user = user; // attach user info to request
    next();
  } catch (err) {
    console.error(err);
    return res.status(401).json({ message: "Unauthorized: Invalid token" });
  }
};
