const Razorpay = require("razorpay");
const Order = require("../models/OrderModel");
const Purchase = require("../models/PurchaseModel");

// 🔑 Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

console.log(razorpay);

// 🧾 Step 1: Create Order
exports.createOrder = async (req, res) => {
  try {
    const { amount, bookId } = req.body;
    const user = req.user.uid; // From Firebase middleware

    console.log({ amount, bookId, user });

    if (!amount || !bookId)
      return res.status(400).json({ success: false, message: "Missing fields" });

    const options = {
      amount: amount * 100, // Razorpay takes paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    };

    console.log(options);
    

    const order = await razorpay.orders.create(options);
    console.log(order);
    

    // ✅ Save order in DB
    await Order.create({
      orderId: order.id,
      amount,
      currency: order.currency,
      book: bookId,
      user,
      status: "created",
    });

    res.json({
      success: true,
      order,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.warn("Razorpay order error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Step 2: Verify Payment
exports.verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      amount,
      bookId,
    } = req.body;

    const user = req.user.uid;

    if (!razorpay_order_id || !razorpay_payment_id || !bookId || !amount) {
      return res.status(400).json({
        success: false,
        message: "Missing required payment fields",
      });
    }

    // Update order status
    await Order.findOneAndUpdate(
      { orderId: razorpay_order_id },
      {
        status: "paid",
        razorpayPaymentId: razorpay_payment_id,
      }
    );

    // Save Purchase
    const purchase = await Purchase.create({
      buyer: user,
      book: bookId,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      amount,
      status: "Completed",
    });

    console.log("Purchase Saved --->", purchase);

    res.json({ success: true });
  } catch (err) {
    console.error("Payment verification failed:", err);
    if (err.errors) console.error("Validation errors:", err.errors);
    res.status(500).json({ success: false, message: err.message });
  }
};
