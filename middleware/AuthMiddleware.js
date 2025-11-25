const admin = require("../config/firebase");

exports.verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    const decoded = await admin.auth().verifyIdToken(token);

    // 🔹 Attach both original decoded object and a clean user object
    req.user = {
      ...decoded,
      id: decoded.uid, // ensures req.user.id is available
    };

    next();
  } catch (err) {
    console.error("Auth error:", err);
    res.status(401).json({ message: "Invalid or expired token" });
  }
};
