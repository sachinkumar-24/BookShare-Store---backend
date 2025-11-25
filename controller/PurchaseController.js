const Purchase = require("../models/PurchaseModel");
const Order = require("../models/OrderModel")

// 🧾 Get all purchases for logged-in user
exports.getUserPurchases = async (req, res) => {
  try {
    const userId = req.user.uid;
    console.log(userId);
    

    const purchases = await Purchase.find({ buyer: userId })
      .populate("book")
      .sort({ createdAt: -1 });

      console.log(purchases);
      
    res.json({ success: true, purchases });
  } catch (error) {
    console.error("Error fetching purchases:", error);
    res.status(500).json({ success: false, message: "Failed to fetch purchases" });
  }
};
