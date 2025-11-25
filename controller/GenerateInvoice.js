const PDFDocument = require("pdfkit");
const sharp = require("sharp");
const QRCode = require("qrcode");
const axios = require("axios");
const Purchase = require("../models/PurchaseModel");
const Book = require("../models/BookModel");
const path = require("path");

exports.generateInvoice = async (req, res) => {
  try {
    const purchaseId = req.params.id;

    const purchase = await Purchase.findById(purchaseId).populate("book");
    if (!purchase)
      return res
        .status(404)
        .json({ success: false, message: "Purchase not found" });

    const book = purchase.book;

    const primaryColor = "#d62828";
    const textDark = "#374151";

    // ---------------------------------------
    // Reverse Geocoding
    // ---------------------------------------
    let sellerCity = "Unknown";
    if (book.location?.coordinates) {
      const [lng, lat] = book.location.coordinates;
      try {
        const geoRes = await axios.get(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
          { timeout: 500 }
        );
        sellerCity =
          geoRes.data.address?.city ||
          geoRes.data.address?.town ||
          geoRes.data.address?.state ||
          "Unknown";
      } catch {}
    }

    // ---------------------------------------
    // QR Code
    // ---------------------------------------
    const qrData = `Payment ID: ${purchase.paymentId}\nOrder ID: ${purchase.orderId}`;
    const qrBase64 = await QRCode.toDataURL(qrData, { margin: 0, scale: 2 });
    const qrBuffer = Buffer.from(qrBase64.split(",")[1], "base64");

    // ---------------------------------------
    // PDF Setup
    // ---------------------------------------
    const doc = new PDFDocument({ margin: 40, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=invoice-${purchaseId}.pdf`
    );

    doc.pipe(res);

    // ---------------------------------------
    // HEADER
    // ---------------------------------------
    const logoPath = path.join(__dirname, "../public/logo.png");
    try {
      doc.image(logoPath, 40, 40, { width: 70 });
    } catch {}

    doc
      .fontSize(28)
      .fillColor(primaryColor)
      .text("BookShare Invoice", 130, 45);

    doc
      .moveTo(40, 120)
      .lineTo(550, 120)
      .stroke(primaryColor);

    // ---------------------------------------
    // INVOICE DETAILS + QR
    // ---------------------------------------
    doc.fontSize(12).fillColor(textDark);

    doc.text(`Invoice Number: ${purchase._id}`, 40, 140);
    doc.text(`Order ID: ${purchase.orderId}`, 40, 160);
    doc.text(`Payment ID: ${purchase.paymentId}`, 40, 180);
    doc.text(`Status: ${purchase.status}`, 40, 200);
    doc.text(
      `Date: ${new Date(purchase.createdAt).toLocaleString()}`,
      40,
      220
    );

    doc.image(qrBuffer, 420, 145, { width: 130 });

    // ---------------------------------------
    // BUYER & SELLER SECTION
    // ---------------------------------------
    doc
      .fontSize(16)
      .fillColor(primaryColor)
      .text("Buyer & Seller Information", 40, 270);

    doc.moveTo(40, 295).lineTo(550, 295).stroke(primaryColor);

    doc.fontSize(12).fillColor(textDark);
    doc.text(`Buyer UID: ${purchase.buyer}`, 40, 315);
    doc.text(`Seller Name: ${book.seller?.name || "Unknown"}`, 40, 335);
    doc.text(`Seller Email: ${book.seller?.email || "N/A"}`, 40, 355);
    doc.text(`Seller Location: ${sellerCity}`, 40, 375);

    // ---------------------------------------
    // BOOK DETAILS
    // ---------------------------------------
    doc.fontSize(16).fillColor(primaryColor).text("Book Details", 40, 415);

    doc.moveTo(40, 440).lineTo(550, 440).stroke(primaryColor);

    const imgY = 460;

    // ---- FIXED BOOK IMAGE LOADING ----
    if (book.imageUrl) {

try {
  const resImg = await axios.get(book.imageUrl, {
    responseType: "arraybuffer",
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  let buffer = Buffer.from(resImg.data);

  // Convert WEBP → JPEG automatically
  const contentType = resImg.headers["content-type"];
  if (contentType === "image/webp") {
    buffer = await sharp(buffer).jpeg().toBuffer();
  }

  doc.image(buffer, 40, imgY, { width: 100, height: 140 });
} catch (err) {
  console.log("IMAGE LOAD ERROR:", err.message);
  doc.rect(40, imgY, 100, 140).stroke(primaryColor);
  doc.text("Image Unavailable", 45, imgY + 55);
}


    } else {
      doc.rect(40, imgY, 100, 140).stroke(primaryColor);
      doc.text("No Image", 60, imgY + 55);
    }

    // ---- Book Text ----
    const textX = 160;

    doc.fontSize(12).fillColor(textDark);
    doc.text(`Title: ${book.title}`, textX, imgY);
    doc.text(`Author: ${book.author}`, textX, imgY + 20);
    doc.text(`Category: ${book.category || "N/A"}`, textX, imgY + 40);
    doc.text(`Price: ${book.price}`, textX, imgY + 60);

    doc.text(
      `Description: ${book.description?.substring(0, 150) || "N/A"}...`,
      textX,
      imgY + 90,
      { width: 360 }
    );

    // ---------------------------------------
    // PAYMENT SUMMARY BOX
    // ---------------------------------------
    doc.fontSize(16).fillColor(primaryColor).text("Payment Summary", 40, 640);

    doc.roundedRect(40, 670, 510, 110, 10).stroke(primaryColor);

    const amount = purchase.amount;
    const gst = (amount * 0.05).toFixed(2);
    const total = (amount + Number(gst)).toFixed(2);

    doc.fontSize(12).fillColor(textDark);
    doc.text(`Book Price: ${amount}`, 60, 690);
    doc.text(`GST (5%): ${gst}`, 60, 710);

    doc.font("Helvetica-Bold").text(`TOTAL PAID: ${total}`, 60, 740);

    // ---------------------------------------
    // FOOTER
    // ---------------------------------------
    doc
      .fontSize(12)
      .fillColor(primaryColor)
      .text("Thank you for purchasing from BookShare!", 40, 790, {
        align: "center",
      });

    doc
      .fontSize(10)
      .fillColor("#777")
      .text("This is a system-generated invoice. No signature required.", {
        align: "center",
      });

    doc.end();
  } catch (error) {
    console.log("INVOICE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Could not generate invoice",
    });
  }
};
