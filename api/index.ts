import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import { User, Product, PaymentMethod } from "../src/types";

const sanitize = (str: any) => typeof str === 'string' ? str.trim().replace(/[<>]/g, '') : str;

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  console.log(`Request: ${req.method} ${req.url}`);
  next();
});

// Mock Database
let users: User[] = [
  { 
    id: 1, 
    name: "Admin", 
    email: "admin", 
    password: bcrypt.hashSync("admin", 10), 
    wallet_balance: 1000000, 
    role: "admin", 
    full_name: "System Administrator", 
    contact_info: "admin@hdefexchange.com", 
    profile_image_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Admin",
    is_verified: true
  }
];

const sendEmail = (to: string, subject: string, body: string) => {
  console.log(`\n--- EMAIL NOTIFICATION ---\nTo: ${to}\nSubject: ${subject}\nBody: ${body}\n--------------------------\n`);
};

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Middleware to check if user is admin
const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }
  const user = users.find(u => u.id === parseInt(userId as string));
  if (user && user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ success: false, message: "Admin access required" });
  }
};

let products: Product[] = [
  { id: 1, name: "Premium Headphones", description: "High-fidelity wireless noise-cancelling headphones.", image_urls: ["https://picsum.photos/seed/audio/800/600"], quantity: 15, quantity_unit: 1, price: 2500, category: "Electronics", seller_id: 1, status: 'approved', payment_mode: 'coin' },
  { id: 2, name: "Mechanical Keyboard", description: "Tactile RGB mechanical keyboard for professionals.", image_urls: ["https://picsum.photos/seed/keyboard/800/600"], quantity: 8, quantity_unit: 1, price: 1200, category: "Electronics", seller_id: 1, status: 'approved', payment_mode: 'coin' }
];

let transactions: any[] = [];
let paymentMode: 'coin' | 'manual' = 'manual';
let paymentMethods: PaymentMethod[] = [
  { id: 1, name: 'bKash', number: '01700000000', instructions: 'Send money to this number.' },
  { id: 2, name: 'Nagad', number: '01800000000', instructions: 'Send money to this number.' }
];

  // Settings Routes
  app.get("/api/settings/payment-mode", (req, res) => {
    res.json({ paymentMode });
  });

  app.post("/api/admin/settings/payment-mode", requireAdmin, (req, res) => {
    const { mode } = req.body;
    if (mode === 'coin' || mode === 'manual') {
      paymentMode = mode;
      res.json({ success: true, paymentMode });
    } else {
      res.status(400).json({ success: false, message: "Invalid payment mode" });
    }
  });

  app.get("/api/payment-methods", (req, res) => {
    res.json(paymentMethods);
  });

  app.post("/api/admin/payment-methods", requireAdmin, (req, res) => {
    const newId = paymentMethods.length > 0 ? Math.max(...paymentMethods.map(m => m.id)) + 1 : 1;
    const newMethod = { id: newId, ...req.body };
    paymentMethods.push(newMethod);
    res.json({ success: true, method: newMethod });
  });

  app.put("/api/admin/payment-methods/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const index = paymentMethods.findIndex(m => m.id === id);
    if (index === -1) return res.status(404).json({ success: false, message: "Method not found" });
    paymentMethods[index] = { ...paymentMethods[index], ...req.body };
    res.json({ success: true, method: paymentMethods[index] });
  });

  app.delete("/api/admin/payment-methods/:id", (req, res) => {
    const id = parseInt(req.params.id);
    paymentMethods = paymentMethods.filter(m => m.id !== id);
    res.json({ success: true });
  });

  // Auth Routes
  app.post("/api/auth/sync-user", (req, res) => {
    const { name, email, role } = req.body;
    const sanitizedEmail = email.trim().toLowerCase();
    
    let user = users.find(u => u.email === sanitizedEmail);
    
    if (!user) {
      const newId = users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1;
      user = {
        id: newId,
        name: name || sanitizedEmail.split('@')[0],
        email: sanitizedEmail,
        password: bcrypt.hashSync(Math.random().toString(36), 10), // Random password
        wallet_balance: role === 'admin' ? 0 : 1000,
        role: role || 'user',
        is_verified: true
      };
      users.push(user);
    }
    
    res.json({ success: true, user });
  });

  app.post("/api/auth/login", (req, res) => {
    const { name, email, password, role } = req.body;
    const sanitizedEmail = email.trim().toLowerCase();
    
    let user = users.find(u => u.email === sanitizedEmail);
    
    // If user not in mock DB, sync them (assuming Supabase auth already passed)
    if (!user) {
      const newId = users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1;
      user = {
        id: newId,
        name: name || sanitizedEmail.split('@')[0],
        email: sanitizedEmail,
        password: bcrypt.hashSync(password, 10),
        wallet_balance: role === 'admin' ? 0 : 1000,
        role: role || 'user',
        is_verified: true
      };
      users.push(user);
      return res.json({ success: true, user });
    }

    if (user.role !== role) {
      return res.status(401).json({ success: false, message: "Invalid role for this account" });
    }
    
    if (bcrypt.compareSync(password, user.password)) {
      if (!user.is_verified) {
        return res.status(403).json({ success: false, message: "Please verify your email first", needsVerification: true });
      }
      res.json({ success: true, user });
    } else {
      res.status(401).json({ success: false, message: "Invalid password" });
    }
  });

  app.post("/api/auth/register", (req, res) => {
    const { name, email, password, role } = req.body;
    const sanitizedName = name.trim().replace(/[<>]/g, '');
    const sanitizedEmail = email.trim().replace(/[<>]/g, '').toLowerCase();

    if (users.find(u => u.email === sanitizedEmail)) {
      return res.status(400).json({ success: false, message: "User already exists" });
    }

    const otp = generateOTP();
    const expiry = Date.now() + 10 * 60 * 1000; // 10 minutes

    const newId = users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1;
    const newUser: User = {
      id: newId,
      name: sanitizedName,
      email: sanitizedEmail,
      password: bcrypt.hashSync(password, 10),
      wallet_balance: role === 'admin' ? 0 : 1000,
      role,
      is_verified: false,
      verification_code: otp,
      verification_expiry: expiry
    };

    users.push(newUser);
    sendEmail(email, "Account Verification Code", `Your verification code is: ${otp}. It expires in 10 minutes.`);
    res.json({ success: true, message: "Registration successful. Please check your email for verification code.", email });
  });

  app.post("/api/auth/verify-email", (req, res) => {
    const { email, code } = req.body;
    const userIndex = users.findIndex(u => u.email === email);
    
    if (userIndex === -1) return res.status(404).json({ success: false, message: "User not found" });
    const user = users[userIndex];

    if (user.verification_code === code && user.verification_expiry && user.verification_expiry > Date.now()) {
      users[userIndex].is_verified = true;
      users[userIndex].verification_code = undefined;
      users[userIndex].verification_expiry = undefined;
      res.json({ success: true, message: "Email verified successfully. You can now login.", user: users[userIndex] });
    } else {
      res.status(400).json({ success: false, message: "Invalid or expired verification code" });
    }
  });

  app.post("/api/auth/forgot-password", (req, res) => {
    const { email } = req.body;
    const userIndex = users.findIndex(u => u.email === email);
    if (userIndex === -1) return res.status(404).json({ success: false, message: "User not found" });

    const otp = generateOTP();
    const expiry = Date.now() + 10 * 60 * 1000;

    users[userIndex].reset_code = otp;
    users[userIndex].reset_expiry = expiry;

    sendEmail(email, "Password Reset Code", `Your password reset code is: ${otp}. It expires in 10 minutes.`);
    res.json({ success: true, message: "Reset code sent to your email." });
  });

  app.post("/api/auth/reset-password", (req, res) => {
    const { email, code, newPassword } = req.body;
    const userIndex = users.findIndex(u => u.email === email);
    if (userIndex === -1) return res.status(404).json({ success: false, message: "User not found" });
    
    const user = users[userIndex];
    if (user.reset_code === code && user.reset_expiry && user.reset_expiry > Date.now()) {
      users[userIndex].password = bcrypt.hashSync(newPassword, 10);
      users[userIndex].reset_code = undefined;
      users[userIndex].reset_expiry = undefined;
      sendEmail(email, "Password Changed", "Your password has been successfully reset. If you didn't do this, please contact support.");
      res.json({ success: true, message: "Password reset successful." });
    } else {
      res.status(400).json({ success: false, message: "Invalid or expired reset code" });
    }
  });

  app.post("/api/auth/change-password", (req, res) => {
    const { userId, oldPassword, newPassword } = req.body;
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) return res.status(404).json({ success: false, message: "User not found" });

    const user = users[userIndex];
    if (bcrypt.compareSync(oldPassword, user.password)) {
      users[userIndex].password = bcrypt.hashSync(newPassword, 10);
      sendEmail(user.email, "Security Notification", "Your password was recently changed from your account settings.");
      res.json({ success: true, message: "Password updated successfully." });
    } else {
      res.status(400).json({ success: false, message: "Incorrect current password" });
    }
  });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  app.get("/api/products", (req, res) => {
    res.json(products);
  });

  app.post("/api/products", (req, res) => {
    const unit = req.body.quantity_unit || 1;
    if (req.body.quantity % unit !== 0) {
      return res.status(400).json({ success: false, message: `Quantity must be a multiple of ${unit}` });
    }
    const newId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;
    const newProduct = { id: newId, ...req.body, quantity_unit: unit };
    products.push(newProduct);
    res.json({ success: true, product: newProduct });
  });

  app.put("/api/products/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const index = products.findIndex(p => p.id === id);
    if (index === -1) return res.status(404).json({ success: false, message: "Product not found" });
    
    const unit = req.body.quantity_unit || products[index].quantity_unit || 1;
    const quantity = req.body.quantity !== undefined ? req.body.quantity : products[index].quantity;
    if (quantity % unit !== 0) {
      return res.status(400).json({ success: false, message: `Quantity must be a multiple of ${unit}` });
    }

    products[index] = { ...products[index], ...req.body, quantity_unit: unit };
    res.json({ success: true, product: products[index] });
  });

  app.delete("/api/products/:id", (req, res) => {
    const id = parseInt(req.params.id);
    products = products.filter(p => p.id !== id);
    res.json({ success: true });
  });

  app.get("/api/users/:id", (req, res) => {
    console.log(`API call: /api/users/${req.params.id}`);
    const user = users.find(u => u.id === parseInt(req.params.id));
    res.json(user || null);
  });

  app.post("/api/users/update", (req, res) => {
    const { userId, full_name, whatsapp_number, contact_info, profile_details, profile_image_url } = req.body;
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) return res.status(404).json({ success: false, message: "User not found" });

    users[userIndex] = {
      ...users[userIndex],
      full_name,
      whatsapp_number,
      contact_info,
      profile_details,
      profile_image_url
    };
    res.json({ success: true, user: users[userIndex] });
  });

  app.get("/api/transactions/:userId", (req, res) => {
    console.log(`API call: /api/transactions/${req.params.userId}`);
    const userId = parseInt(req.params.userId);
    const productMap = new Map(products.map(p => [p.id, p.name]));
    
    const userTransactions = transactions
      .filter(t => t.user_id === userId)
      .map(t => ({
        ...t,
        product_name: productMap.get(t.product_id) || "Unknown Product"
      }))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    res.json(userTransactions);
  });

  app.get("/api/admin/users", requireAdmin, (req, res) => {
    console.log(`API call: /api/admin/users`);
    res.json(users.map(u => {
      const { password, ...userWithoutPassword } = u;
      return userWithoutPassword;
    }));
  });

  app.put("/api/admin/users/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const index = users.findIndex(u => u.id === id);
    if (index !== -1) {
      users[index] = { ...users[index], ...req.body };
      res.json({ success: true, user: users[index] });
    } else {
      res.status(404).json({ success: false, message: "User not found" });
    }
  });

  app.delete("/api/admin/users/:id", (req, res) => {
    const id = parseInt(req.params.id);
    users = users.filter(u => u.id !== id);
    res.json({ success: true });
  });

  app.get("/api/admin/transactions", requireAdmin, (req, res) => {
    console.log(`API call: /api/admin/transactions`);
    
    // Create lookup maps for performance
    const userMap = new Map(users.map(u => [u.id, u.name]));
    const productMap = new Map(products.map(p => [p.id, p.name]));

    const allTransactions = transactions
      .map(t => ({
        ...t,
        user_name: userMap.get(t.user_id) || "Unknown User",
        product_name: productMap.get(t.product_id) || "Unknown Product"
      }))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    res.json(allTransactions);
  });

  app.post("/api/admin/transactions/:id/status", requireAdmin, (req, res) => {
    const { status } = req.body;
    const transactionIndex = transactions.findIndex(t => t.id === parseInt(req.params.id));
    if (transactionIndex === -1) return res.status(404).json({ success: false, message: "Transaction not found" });

    const transaction = transactions[transactionIndex];
    
    // If cancelling a buy transaction, restore stock and refund coins
    if (status === 'cancelled' && transaction.status !== 'cancelled' && (transaction.type === 'buy' || transaction.type === 'manual_buy')) {
      const productIndex = products.findIndex(p => p.id === transaction.product_id);
      if (productIndex !== -1) {
        products[productIndex].quantity += transaction.quantity;
      }
      if (transaction.type === 'buy') {
        const userIndex = users.findIndex(u => u.id === transaction.user_id);
        if (userIndex !== -1) users[userIndex].wallet_balance += transaction.amount;
        const adminIndex = users.findIndex(u => u.id === 1);
        if (adminIndex !== -1) users[adminIndex].wallet_balance -= transaction.amount;
      }
    } 
    // If un-cancelling a buy transaction, deduct stock and coins again
    else if (status !== 'cancelled' && transaction.status === 'cancelled' && (transaction.type === 'buy' || transaction.type === 'manual_buy')) {
      const productIndex = products.findIndex(p => p.id === transaction.product_id);
      if (productIndex !== -1) {
        // Check if enough stock is available
        if (products[productIndex].quantity < transaction.quantity) {
          return res.status(400).json({ success: false, message: "Not enough stock to un-cancel this order" });
        }
        products[productIndex].quantity -= transaction.quantity;
      }
      if (transaction.type === 'buy') {
        const userIndex = users.findIndex(u => u.id === transaction.user_id);
        if (userIndex !== -1) {
          // Check if user has enough balance
          if (users[userIndex].wallet_balance < transaction.amount) {
            // Revert stock deduction if balance is insufficient
            if (productIndex !== -1) products[productIndex].quantity += transaction.quantity;
            return res.status(400).json({ success: false, message: "User does not have enough coins to un-cancel this order" });
          }
          users[userIndex].wallet_balance -= transaction.amount;
        }
        const adminIndex = users.findIndex(u => u.id === 1);
        if (adminIndex !== -1) users[adminIndex].wallet_balance += transaction.amount;
      }
    }

    transactions[transactionIndex].status = status;
    res.json({ success: true, message: "Transaction status updated" });
  });

  app.post("/api/admin/transactions/:id/verify", requireAdmin, (req, res) => {
    const id = parseInt(req.params.id);
    const index = transactions.findIndex(t => t.id === id);
    if (index === -1) return res.status(404).json({ success: false, message: "Transaction not found" });
    
    transactions[index].status = 'processing';
    res.json({ success: true, transaction: transactions[index] });
  });

  app.post("/api/admin/transactions/:id/reject", requireAdmin, (req, res) => {
    const id = parseInt(req.params.id);
    const index = transactions.findIndex(t => t.id === id);
    if (index === -1) return res.status(404).json({ success: false, message: "Transaction not found" });
    
    const transaction = transactions[index];
    if (transaction.status !== 'cancelled' && (transaction.type === 'buy' || transaction.type === 'manual_buy')) {
      const productIndex = products.findIndex(p => p.id === transaction.product_id);
      if (productIndex !== -1) {
        products[productIndex].quantity += transaction.quantity;
      }
    }

    transactions[index].status = 'cancelled';
    res.json({ success: true, transaction: transactions[index] });
  });

  app.post("/api/exchange", (req, res) => {
    const { userId, productId } = req.body;
    const userIndex = users.findIndex(u => u.id === userId);
    const productIndex = products.findIndex(p => p.id === productId);

    if (userIndex === -1 || productIndex === -1) {
      return res.status(404).json({ success: false, message: "User or Product not found" });
    }

    const user = users[userIndex];
    const product = products[productIndex];

    if (product.quantity < (product.quantity_unit || 1)) {
      return res.status(400).json({ success: false, message: "Product out of stock" });
    }

    const price = product.price;
    const discount = product.discount || 0;
    const discountedPrice = price - (price * (discount / 100));

    if (paymentMode === 'coin') {
      if (user.wallet_balance < discountedPrice) {
        return res.status(400).json({ success: false, message: "Insufficient coins" });
      }

      // Process Transaction
      users[userIndex].wallet_balance -= discountedPrice;
      const adminIndex = users.findIndex(u => u.id === 1);
      if (adminIndex !== -1) users[adminIndex].wallet_balance += discountedPrice;
    }
    
    products[productIndex].quantity -= (product.quantity_unit || 1);

    const newId = transactions.length > 0 ? Math.max(...transactions.map(t => t.id)) + 1 : 1;
    const transaction = {
      id: newId,
      user_id: userId,
      product_id: productId,
      amount: discountedPrice,
      quantity: (product.quantity_unit || 1),
      type: paymentMode === 'coin' ? 'buy' : 'manual_buy',
      timestamp: new Date().toISOString(),
      status: paymentMode === 'coin' ? 'pending' : 'pending_manual_payment',
      tracking_id: 'TRK-' + Math.random().toString(36).substr(2, 9).toUpperCase()
    };
    transactions.push(transaction);

    res.json({ success: true, message: paymentMode === 'coin' ? "Purchase successful!" : "Order placed. Please complete manual payment." });
  });

  app.post("/api/checkout", (req, res) => {
    const { userId, items, manualTransactionId, paymentScreenshotUrl } = req.body; // items: { productId: number, quantity: number }[]
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) return res.status(404).json({ success: false, message: "User not found" });

    const user = users[userIndex];
    const productMap = new Map(products.map(p => [p.id, p]));
    let totalCost = 0;

    // Validate stock and calculate total cost
    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) return res.status(404).json({ success: false, message: `Product ${item.productId} not found` });
      if (product.quantity < item.quantity) return res.status(400).json({ success: false, message: `Not enough stock for ${product.name}` });
      if (item.quantity % (product.quantity_unit || 1) !== 0) return res.status(400).json({ success: false, message: `Quantity for ${product.name} must be a multiple of ${product.quantity_unit || 1}` });
      
      const price = product.price;
      const discount = product.discount || 0;
      const discountedPrice = price - (price * (discount / 100));
      totalCost += (item.quantity / (product.quantity_unit || 1)) * discountedPrice;
    }

    if (paymentMode === 'manual') {
      if (!manualTransactionId || !paymentScreenshotUrl) {
        return res.status(400).json({ success: false, message: "Manual payment details (Transaction ID and Screenshot) are required" });
      }
    }

    if (paymentMode === 'coin') {
      if (user.wallet_balance < totalCost) {
        return res.status(400).json({ success: false, message: "Insufficient coins" });
      }

      // Process transaction
      users[userIndex].wallet_balance -= totalCost;
      const adminIndex = users.findIndex(u => u.id === 1);
      if (adminIndex !== -1) users[adminIndex].wallet_balance += totalCost;
    }

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) continue; // Should not happen as we validated above
      
      product.quantity -= item.quantity;

      const price = product.price;
      const discount = product.discount || 0;
      const discountedPrice = price - (price * (discount / 100));

      const newId = transactions.length > 0 ? Math.max(...transactions.map(t => t.id)) + 1 : 1;
      transactions.push({
        id: newId,
        user_id: userId,
        product_id: item.productId,
        amount: (item.quantity / (product.quantity_unit || 1)) * discountedPrice,
        quantity: item.quantity,
        type: paymentMode === 'coin' ? 'buy' : 'manual_buy',
        timestamp: new Date().toISOString(),
        status: paymentMode === 'coin' ? 'pending' : 'pending_manual_payment',
        tracking_id: 'TRK-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
        manual_transaction_id: paymentMode === 'manual' ? manualTransactionId : undefined,
        payment_screenshot_url: paymentMode === 'manual' ? paymentScreenshotUrl : undefined
      });
    }

    res.json({ success: true, message: paymentMode === 'coin' ? "Purchase successful!" : "Order placed. Please wait for admin approval." });
  });

  // Sell Request Routes
  app.post("/api/sell-request", (req, res) => {
    const { name, description, image_urls, quantity, quantity_unit, price, price_type, category, seller_id, payment_mode } = req.body;
    const unit = quantity_unit || 1;
    if (quantity % unit !== 0) {
      return res.status(400).json({ success: false, message: `Quantity must be a multiple of ${unit}` });
    }
    const newId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;
    const newProduct: Product = {
      id: newId,
      name,
      description,
      image_urls: image_urls || [],
      quantity,
      quantity_unit: unit,
      price,
      price_type,
      payment_mode: payment_mode || 'coin',
      category: category || "Uncategorized",
      seller_id,
      status: 'pending'
    };
    products.push(newProduct);
    res.json({ success: true, product: newProduct });
  });

  app.post("/api/admin/sell-request/approve", requireAdmin, (req, res) => {
    const { productId } = req.body;
    const productIndex = products.findIndex(p => p.id === productId);
    if (productIndex === -1) return res.status(404).json({ success: false, message: "Product not found" });

    const product = products[productIndex];
    if (product.status !== 'pending') return res.status(400).json({ success: false, message: "Request already processed" });

    const sellerIndex = users.findIndex(u => u.id === product.seller_id);
    if (sellerIndex === -1) return res.status(404).json({ success: false, message: "Seller not found" });

    // Automated Workflow:
    // 1. Add coins to seller's account if payment mode is 'coin'
    const totalValue = (product.quantity / (product.quantity_unit || 1)) * product.price;
    if (product.payment_mode === 'coin') {
      users[sellerIndex].wallet_balance += totalValue;
      const adminIndex = users.findIndex(u => u.id === 1);
      if (adminIndex !== -1) {
        users[adminIndex].wallet_balance -= totalValue;
      }
    }

    // 2. Update product status to approved (Marketplace addition)
    products[productIndex].status = 'approved';

    // 3. Record transaction for seller
    const newId = transactions.length > 0 ? Math.max(...transactions.map(t => t.id)) + 1 : 1;
    transactions.push({
      id: newId,
      user_id: product.seller_id,
      product_id: productId,
      amount: totalValue,
      quantity: product.quantity,
      type: 'sell',
      timestamp: new Date().toISOString(),
      status: 'delivered',
      tracking_id: 'SELL-' + Math.random().toString(36).substr(2, 9).toUpperCase()
    });

    res.json({ 
      success: true, 
      message: product.payment_mode === 'coin' 
        ? "Sell request approved and coins added to seller's wallet!" 
        : "Sell request approved. Please ensure manual payment is sent to the seller."
    });
  });

  app.post("/api/admin/sell-request/reject", requireAdmin, (req, res) => {
    const { productId } = req.body;
    const productIndex = products.findIndex(p => p.id === productId);
    if (productIndex === -1) return res.status(404).json({ success: false, message: "Product not found" });

    products[productIndex].status = 'rejected';
    res.json({ success: true, message: "Sell request rejected" });
  });

  // Admin Routes
  app.post("/api/admin/products", requireAdmin, (req, res) => {
    const { name, description, image_urls, quantity, quantity_unit, price, price_type, payment_mode, category } = req.body;
    const unit = quantity_unit || 1;
    if (quantity % unit !== 0) {
      return res.status(400).json({ success: false, message: `Quantity must be a multiple of ${unit}` });
    }
    const newId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;
    const newProduct = {
      id: newId,
      name,
      description,
      image_urls,
      quantity,
      quantity_unit: unit,
      price,
      price_type,
      payment_mode: payment_mode || 'coin',
      category: category || "Uncategorized",
      seller_id: 1
    };
    products.push(newProduct);
    res.json({ success: true, product: newProduct });
  });

  app.put("/api/admin/products/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const index = products.findIndex(p => p.id === id);
    if (index !== -1) {
      const unit = req.body.quantity_unit || products[index].quantity_unit || 1;
      const quantity = req.body.quantity !== undefined ? req.body.quantity : products[index].quantity;
      if (quantity % unit !== 0) {
        return res.status(400).json({ success: false, message: `Quantity must be a multiple of ${unit}` });
      }
      products[index] = { ...products[index], ...req.body, quantity_unit: unit };
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false });
    }
  });

  app.delete("/api/admin/products/:id", requireAdmin, (req, res) => {
    const id = parseInt(req.params.id);
    const initialLength = products.length;
    products = products.filter(p => p.id !== id);
    if (products.length < initialLength) {
      res.json({ success: true, message: "Product deleted successfully" });
    } else {
      res.status(404).json({ success: false, message: "Product not found" });
    }
  });

  app.post("/api/coins/transfer", (req, res) => {
    const { fromUserId, toUsername, amount } = req.body;
    const fromIndex = users.findIndex(u => u.id === fromUserId);
    const toIndex = users.findIndex(u => u.email === toUsername);

    if (fromIndex === -1) return res.status(404).json({ success: false, message: "Sender not found" });
    if (toIndex === -1) return res.status(404).json({ success: false, message: "Recipient not found" });
    if (fromIndex === toIndex) return res.status(400).json({ success: false, message: "Cannot transfer to yourself" });
    if (amount <= 0) return res.status(400).json({ success: false, message: "Invalid amount" });
    if (users[fromIndex].wallet_balance < amount) return res.status(400).json({ success: false, message: "Insufficient balance" });

    users[fromIndex].wallet_balance -= amount;
    users[toIndex].wallet_balance += amount;

    const newId1 = transactions.length > 0 ? Math.max(...transactions.map(t => t.id)) + 1 : 1;
    transactions.push({
      id: newId1,
      user_id: fromUserId,
      amount: amount,
      type: 'transfer_out',
      timestamp: new Date().toISOString(),
      status: 'completed',
      tracking_id: 'XFER-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
      recipient_name: toUsername
    });

    const newId2 = transactions.length > 0 ? Math.max(...transactions.map(t => t.id)) + 1 : 1;
    transactions.push({
      id: newId2,
      user_id: users[toIndex].id,
      amount: amount,
      type: 'transfer_in',
      timestamp: new Date().toISOString(),
      status: 'completed',
      tracking_id: 'XFER-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
      sender_name: users[fromIndex].name
    });

    res.json({ success: true, message: `Successfully transferred ${amount} coins to ${toUsername}` });
  });

  // Catch-all for undefined API routes - MUST be before Vite/SPA fallback
  app.all("/api/*", (req, res) => {
    console.log(`API route not found: ${req.method} ${req.url}`);
    res.status(404).json({ 
      success: false, 
      message: `API route not found: ${req.method} ${req.url}`,
      path: req.url,
      method: req.method
    });
  });

  // Global error handler for API routes
  app.use("/api", (err: any, req: any, res: any, next: any) => {
    console.error("API Error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Internal Server Error", 
      error: err.message 
    });
  });

export default app;
