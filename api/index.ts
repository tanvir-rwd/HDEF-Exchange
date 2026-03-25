import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { User, Product, PaymentMethod } from "../src/types";

let supabaseClient: SupabaseClient | null = null;

const getSupabase = (): SupabaseClient => {
  if (!supabaseClient) {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[SUPABASE] Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
      throw new Error("Supabase credentials are not configured.");
    }

    console.log(`[SUPABASE] Initializing with URL: ${supabaseUrl ? 'SET' : 'NOT SET'}`);
    console.log(`[SUPABASE] Initializing with Service Key: ${supabaseServiceKey ? 'SET' : 'NOT SET'}`);
    
    supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
  }
  return supabaseClient;
};

const sanitize = (str: any) => typeof str === 'string' ? str.trim().replace(/[<>]/g, '') : str;

const logError = (context: string, error: any) => {
  const message = error?.message || (typeof error === 'string' ? error : JSON.stringify(error));
  console.error(`[ERROR] ${context}:`, message);
  if (error?.details) console.error(`[DETAILS]:`, error.details);
  if (error?.hint) console.error(`[HINT]:`, error.hint);
  if (error?.code) console.error(`[CODE]:`, error.code);
  if (error?.stack) console.error(`[STACK]:`, error.stack);
};

const parseId = (id: any) => {
  if (typeof id === 'string' && id.includes('-')) return id; // Likely a UUID
  const parsed = parseInt(id);
  return isNaN(parsed) ? id : parsed;
};

const isMissingTableError = (error: any) => {
  if (!error) return false;
  const code = error.code;
  const message = (error.message || "").toLowerCase();
  const details = (error.details || "").toLowerCase();
  const hint = (error.hint || "").toLowerCase();
  
  return code === '42P01' || 
         code === 'PGRST103' || // Another common PostgREST error code for missing resources
         message.includes("schema cache") || 
         message.includes("relation does not exist") ||
         message.includes("could not find the table") ||
         details.includes("schema cache") ||
         details.includes("relation does not exist") ||
         hint.includes("schema cache") ||
         hint.includes("relation does not exist");
};

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  console.log(`Request: ${req.method} ${req.url}`);
  next();
});

// Helper to get settings
const getSetting = async (key: string, defaultValue: any) => {
  try {
    const { data, error } = await getSupabase().from('settings').select('value').eq('key', key).limit(1);
    if (error) {
      if (!isMissingTableError(error)) {
        console.error(`Error fetching setting ${key}:`, error.message);
      }
      return defaultValue;
    }
    if (!data || data.length === 0) return defaultValue;
    return data[0].value;
  } catch (err: any) {
    console.error(`Exception fetching setting ${key}:`, err.message);
    return defaultValue;
  }
};

// Helper to update settings
const updateSetting = async (key: string, value: any) => {
  try {
    const { data: existing, error: fetchError } = await getSupabase().from('settings').select('id').eq('key', key).limit(1);
    
    if (fetchError && fetchError.code !== '42P01') {
      console.error(`Error checking existing setting ${key}:`, fetchError.message);
    }

    let error;
    if (existing && existing.length > 0) {
      const res = await getSupabase().from('settings').update({ value }).eq('key', key);
      error = res.error;
    } else {
      const res = await getSupabase().from('settings').insert([{ key, value }]);
      error = res.error;
    }
    
    if (error) {
      console.error(`Error updating setting ${key}:`, error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error(`Exception updating setting ${key}:`, err.message);
    return false;
  }
};

const sendEmail = (to: string, subject: string, body: string) => {
  console.log(`\n--- EMAIL NOTIFICATION ---\nTo: ${to}\nSubject: ${subject}\nBody: ${body}\n--------------------------\n`);
};

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Middleware to check if user is admin
const requireAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }
    const id = parseId(userId);
    const { data: user, error } = await getSupabase().from('users').select('*').eq('id', id).single();
    
    if (error) {
      if (error.code === '42P01') {
        console.warn("[SUPABASE] users table missing in requireAdmin.");
        return res.status(403).json({ success: false, message: "Admin access required (Database not initialized)" });
      }
      throw error;
    }

    if (user && user.role === 'admin') {
      next();
    } else {
      res.status(403).json({ success: false, message: "Admin access required" });
    }
  } catch (error: any) {
    logError("requireAdmin middleware", error);
    res.status(500).json({ success: false, message: "Internal server error during authorization" });
  }
};

  // Settings Routes
  app.get("/api/settings/payment-mode", async (req, res) => {
    const paymentMode = await getSetting('paymentMode', 'manual');
    res.json({ paymentMode });
  });

  app.get("/api/settings/enabled-payment-methods", async (req, res) => {
    const enabledMethods = await getSetting('enabledPaymentMethods', []);
    res.json({ enabledMethods });
  });

  app.post("/api/admin/settings/enabled-payment-methods", requireAdmin, async (req, res) => {
    const { methods } = req.body;
    if (Array.isArray(methods)) {
      const success = await updateSetting('enabledPaymentMethods', methods);
      if (success) {
        res.json({ success: true, enabledMethods: methods });
      } else {
        res.status(500).json({ success: false, message: "Failed to update setting in database" });
      }
    } else {
      res.status(400).json({ success: false, message: "Invalid methods array" });
    }
  });

  app.post("/api/admin/settings/payment-mode", requireAdmin, async (req, res) => {
    const { mode } = req.body;
    if (mode === 'coin' || mode === 'manual') {
      const success = await updateSetting('paymentMode', mode);
      if (success) {
        res.json({ success: true, paymentMode: mode });
      } else {
        res.status(500).json({ success: false, message: "Failed to update setting in database" });
      }
    } else {
      res.status(400).json({ success: false, message: "Invalid payment mode" });
    }
  });

  app.get("/api/health", async (req, res) => {
    try {
      const { data, error } = await getSupabase().from('users').select('count', { count: 'exact', head: true });
      if (error && !isMissingTableError(error)) throw error;
      res.json({ success: true, message: "Supabase connected", userCount: data || 0 });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Supabase connection failed", error: err.message });
    }
  });

  app.get("/api/payment-methods", async (req, res) => {
    try {
      const { data, error } = await getSupabase().from('payment_methods').select('*');
      if (error) {
        if (isMissingTableError(error)) {
          console.warn("[SUPABASE] payment_methods table missing. Returning defaults.");
          return res.json([
            { id: 1, name: 'bKash', number: '01XXXXXXXXX', instructions: 'Send money to this personal number', type: 'manual' },
            { id: 2, name: 'Nagad', number: '01XXXXXXXXX', instructions: 'Send money to this personal number', type: 'manual' },
            { id: 3, name: 'Rocket', number: '01XXXXXXXXX', instructions: 'Send money to this personal number', type: 'manual' }
          ]);
        }
        throw error;
      }
      res.json(data || []);
    } catch (error: any) {
      logError("fetching payment methods", error);
      res.status(500).json({ success: false, message: "Failed to fetch payment methods" });
    }
  });

  app.post("/api/admin/payment-methods", requireAdmin, async (req, res) => {
    try {
      const { data, error } = await getSupabase().from('payment_methods').insert([req.body]).select().single();
      if (error) return res.status(500).json({ success: false, message: error.message });
      res.json({ success: true, method: data });
    } catch (error: any) {
      logError("adding payment method", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.put("/api/admin/payment-methods/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseId(req.params.id);
      const { data, error } = await getSupabase().from('payment_methods').update(req.body).eq('id', id).select().single();
      if (error) return res.status(404).json({ success: false, message: "Method not found" });
      res.json({ success: true, method: data });
    } catch (error: any) {
      logError("updating payment method", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.delete("/api/admin/payment-methods/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseId(req.params.id);
      const { error } = await getSupabase().from('payment_methods').delete().eq('id', id);
      if (error) return res.status(500).json({ success: false, message: error.message });
      res.json({ success: true });
    } catch (error: any) {
      logError("deleting payment method", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // Auth Routes
  app.post("/api/auth/sync-user", async (req, res) => {
    try {
      const { name, email, role, uid } = req.body;
      const sanitizedEmail = email.trim().toLowerCase();
      
      let { data: user, error } = await getSupabase().from('users').select('*').or(`email.eq.${sanitizedEmail}${uid ? `,id.eq.${uid}` : ''}`).maybeSingle();
      
      if (error && error.code !== '42P01') throw error;

      if (!user) {
        const newUser = {
          id: uid || undefined, // Let Supabase generate UUID if not provided
          name: name || sanitizedEmail.split('@')[0],
          email: sanitizedEmail,
          password: bcrypt.hashSync(Math.random().toString(36), 10), // Random password
          wallet_balance: role === 'admin' ? 0 : 1000,
          role: role || 'user',
          is_verified: true
        };
        const { data, error: insertError } = await getSupabase().from('users').insert([newUser]).select().single();
        if (insertError) return res.status(500).json({ success: false, message: insertError.message });
        user = data;
      } else if (uid && user.id !== uid) {
        const { data, error: updateError } = await getSupabase().from('users').update({ id: uid }).eq('email', sanitizedEmail).select().single();
        if (updateError) return res.status(500).json({ success: false, message: updateError.message });
        user = data;
      }
      
      res.json({ success: true, user });
    } catch (error: any) {
      logError("sync-user", error);
      res.status(500).json({ success: false, message: "Internal server error during user sync" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { name, email, password, role, uid } = req.body;
      const sanitizedEmail = email.trim().toLowerCase();
      
      let { data: user, error } = await getSupabase().from('users').select('*').or(`email.eq.${sanitizedEmail}${uid ? `,id.eq.${uid}` : ''}`).maybeSingle();
      
      if (error && error.code !== '42P01') throw error;

      if (!user) {
        const newUser = {
          id: uid || undefined,
          name: name || sanitizedEmail.split('@')[0],
          email: sanitizedEmail,
          password: bcrypt.hashSync(password, 10),
          wallet_balance: role === 'admin' ? 0 : 1000,
          role: role || 'user',
          is_verified: true
        };
        const { data, error: insertError } = await getSupabase().from('users').insert([newUser]).select().single();
        if (insertError) return res.status(500).json({ success: false, message: insertError.message });
        user = data;
      } else if (uid && user.id !== uid) {
        const { data, error: updateError } = await getSupabase().from('users').update({ id: uid }).eq('email', sanitizedEmail).select().single();
        if (updateError) return res.status(500).json({ success: false, message: updateError.message });
        user = data;
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
    } catch (error: any) {
      logError("login", error);
      res.status(500).json({ success: false, message: "Internal server error during login" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { name, email, password, role } = req.body;
      const sanitizedName = name.trim().replace(/[<>]/g, '');
      const sanitizedEmail = email.trim().replace(/[<>]/g, '').toLowerCase();

      const { data: existingUser, error: fetchError } = await getSupabase().from('users').select('id').eq('email', sanitizedEmail).maybeSingle();
      if (fetchError && fetchError.code !== '42P01') throw fetchError;
      
      if (existingUser) {
        return res.status(400).json({ success: false, message: "User already exists" });
      }

      const otp = generateOTP();
      const expiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const newUser = {
        name: sanitizedName,
        email: sanitizedEmail,
        password: bcrypt.hashSync(password, 10),
        wallet_balance: role === 'admin' ? 0 : 1000,
        role,
        is_verified: false,
        verification_code: otp,
        verification_expiry: expiry
      };

      const { data, error } = await getSupabase().from('users').insert([newUser]).select().single();
      if (error) return res.status(500).json({ success: false, message: error.message });

      sendEmail(email, "Account Verification Code", `Your verification code is: ${otp}. It expires in 10 minutes.`);
      res.json({ success: true, message: "Registration successful. Please check your email for verification code.", email });
    } catch (error: any) {
      logError("register", error);
      res.status(500).json({ success: false, message: "Internal server error during registration" });
    }
  });

  app.post("/api/auth/verify-email", async (req, res) => {
    try {
      const { email, code } = req.body;
      const { data: user, error } = await getSupabase().from('users').select('*').eq('email', email).single();
      
      if (error || !user) return res.status(404).json({ success: false, message: "User not found" });

      if (user.verification_code === code && user.verification_expiry && new Date(user.verification_expiry).getTime() > Date.now()) {
        const { data: updatedUser, error: updateError } = await getSupabase().from('users').update({
          is_verified: true,
          verification_code: null,
          verification_expiry: null
        }).eq('id', user.id).select().single();
        
        if (updateError) return res.status(500).json({ success: false, message: updateError.message });
        res.json({ success: true, message: "Email verified successfully. You can now login.", user: updatedUser });
      } else {
        res.status(400).json({ success: false, message: "Invalid or expired verification code" });
      }
    } catch (error: any) {
      logError("verify-email", error);
      res.status(500).json({ success: false, message: "Internal server error during email verification" });
    }
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      const { data: user, error } = await getSupabase().from('users').select('id').eq('email', email).single();
      if (error || !user) return res.status(404).json({ success: false, message: "User not found" });

      const otp = generateOTP();
      const expiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const { error: updateError } = await getSupabase().from('users').update({
        reset_code: otp,
        reset_expiry: expiry
      }).eq('id', user.id);

      if (updateError) return res.status(500).json({ success: false, message: updateError.message });

      sendEmail(email, "Password Reset Code", `Your password reset code is: ${otp}. It expires in 10 minutes.`);
      res.json({ success: true, message: "Reset code sent to your email." });
    } catch (error: any) {
      logError("forgot-password", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { email, code, newPassword } = req.body;
      const { data: user, error } = await getSupabase().from('users').select('*').eq('email', email).single();
      if (error || !user) return res.status(404).json({ success: false, message: "User not found" });
      
      if (user.reset_code === code && user.reset_expiry && new Date(user.reset_expiry).getTime() > Date.now()) {
        const { error: updateError } = await getSupabase().from('users').update({
          password: bcrypt.hashSync(newPassword, 10),
          reset_code: null,
          reset_expiry: null
        }).eq('id', user.id);

        if (updateError) return res.status(500).json({ success: false, message: updateError.message });
        
        sendEmail(email, "Password Changed", "Your password has been successfully reset. If you didn't do this, please contact support.");
        res.json({ success: true, message: "Password reset successful." });
      } else {
        res.status(400).json({ success: false, message: "Invalid or expired reset code" });
      }
    } catch (error: any) {
      logError("reset-password", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.post("/api/auth/change-password", async (req, res) => {
    try {
      const { userId, oldPassword, newPassword } = req.body;
      const id = parseId(userId);
      const { data: user, error } = await getSupabase().from('users').select('*').eq('id', id).single();
      if (error || !user) return res.status(404).json({ success: false, message: "User not found" });

      if (bcrypt.compareSync(oldPassword, user.password)) {
        const { error: updateError } = await getSupabase().from('users').update({
          password: bcrypt.hashSync(newPassword, 10)
        }).eq('id', id);

        if (updateError) return res.status(500).json({ success: false, message: updateError.message });
        
        sendEmail(user.email, "Security Notification", "Your password was recently changed from your account settings.");
        res.json({ success: true, message: "Password updated successfully." });
      } else {
        res.status(400).json({ success: false, message: "Incorrect current password" });
      }
    } catch (error: any) {
      logError("change-password", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  app.get("/api/products", async (req, res) => {
    try {
      const { data, error } = await getSupabase().from('products').select('*');
      if (error) {
        if (isMissingTableError(error)) {
          console.warn("[SUPABASE] products table missing. Returning empty array.");
          return res.json([]);
        }
        throw error;
      }
      res.json(data || []);
    } catch (error: any) {
      logError("fetching products", error);
      res.status(500).json({ success: false, message: "Failed to fetch products" });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      const unit = req.body.quantity_unit || 1;
      if (req.body.quantity % unit !== 0) {
        return res.status(400).json({ success: false, message: `Quantity must be a multiple of ${unit}` });
      }
      const { data, error } = await getSupabase().from('products').insert([{ ...req.body, quantity_unit: unit }]).select().single();
      if (error) return res.status(500).json({ success: false, message: error.message });
      res.json({ success: true, product: data });
    } catch (error: any) {
      logError("create product", error);
      res.status(500).json({ success: false, message: "Internal server error during product creation" });
    }
  });

  app.put("/api/products/:id", async (req, res) => {
    try {
      const id = parseId(req.params.id);
      const { data: product, error: fetchError } = await getSupabase().from('products').select('*').eq('id', id).single();
      if (fetchError || !product) return res.status(404).json({ success: false, message: "Product not found" });
      
      const unit = req.body.quantity_unit || product.quantity_unit || 1;
      const quantity = req.body.quantity !== undefined ? req.body.quantity : product.quantity;
      if (quantity % unit !== 0) {
        return res.status(400).json({ success: false, message: `Quantity must be a multiple of ${unit}` });
      }

      const { data: updatedProduct, error: updateError } = await getSupabase().from('products').update({ ...req.body, quantity_unit: unit }).eq('id', id).select().single();
      if (updateError) return res.status(500).json({ success: false, message: updateError.message });
      res.json({ success: true, product: updatedProduct });
    } catch (error: any) {
      logError("update product", error);
      res.status(500).json({ success: false, message: "Internal server error during product update" });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    try {
      const id = parseId(req.params.id);
      const { error } = await getSupabase().from('products').delete().eq('id', id);
      if (error) return res.status(500).json({ success: false, message: error.message });
      res.json({ success: true });
    } catch (error: any) {
      logError("delete product", error);
      res.status(500).json({ success: false, message: "Internal server error during product deletion" });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const idParam = parseId(req.params.id);
      console.log(`API call: /api/users/${idParam}`);
      const { data, error } = await getSupabase().from('users').select('*').eq('id', idParam).maybeSingle();
      if (error) {
        if (error.code === '42P01') return res.json(null);
        throw error;
      }
      res.json(data || null);
    } catch (error: any) {
      logError("fetching user", error);
      res.status(500).json({ success: false, message: "Failed to fetch user" });
    }
  });

  app.post("/api/users/update", async (req, res) => {
    try {
      const { userId, full_name, whatsapp_number, contact_info, profile_details, profile_image_url } = req.body;
      const id = parseId(userId);
      const { data, error } = await getSupabase().from('users').update({
        full_name,
        whatsapp_number,
        contact_info,
        profile_details,
        profile_image_url
      }).eq('id', id).select().single();
      
      if (error) return res.status(404).json({ success: false, message: "User not found or update failed" });
      res.json({ success: true, user: data });
    } catch (error: any) {
      logError("updating user", error);
      res.status(500).json({ success: false, message: "Internal server error during profile update" });
    }
  });

  app.get("/api/transactions/:userId", async (req, res) => {
    try {
      const userIdParam = parseId(req.params.userId);
      console.log(`API call: /api/transactions/${userIdParam}`);
      
      const { data: transactions, error: transError } = await getSupabase()
        .from('transactions')
        .select('*, products(name)')
        .eq('user_id', userIdParam)
        .order('timestamp', { ascending: false });
      
      if (transError) {
        if (isMissingTableError(transError)) {
          console.warn("[SUPABASE] transactions table missing. Returning empty array.");
          return res.json([]);
        }
        throw transError;
      }

      const formattedTransactions = (transactions || []).map(t => ({
        ...t,
        product_name: t.products?.name || "Unknown Product"
      }));
      
      res.json(formattedTransactions);
    } catch (error: any) {
      logError("fetching user transactions", error);
      res.status(500).json({ success: false, message: "Failed to fetch transactions" });
    }
  });

  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      console.log(`API call: /api/admin/users`);
      const { data, error } = await getSupabase().from('users').select('*');
      if (error) {
        if (isMissingTableError(error)) {
          console.warn("[SUPABASE] users table missing.");
          return res.json([]);
        }
        throw error;
      }
      
      res.json((data || []).map(u => {
        const { password, ...userWithoutPassword } = u;
        return userWithoutPassword;
      }));
    } catch (error: any) {
      logError("fetching admin users", error);
      res.status(500).json({ success: false, message: "Failed to fetch users" });
    }
  });

  app.put("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseId(req.params.id);
      const { data, error } = await getSupabase().from('users').update(req.body).eq('id', id).select().single();
      if (error) return res.status(404).json({ success: false, message: "User not found" });
      res.json({ success: true, user: data });
    } catch (error: any) {
      logError("updating admin user", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseId(req.params.id);
      const { error } = await getSupabase().from('users').delete().eq('id', id);
      if (error) return res.status(500).json({ success: false, message: error.message });
      res.json({ success: true });
    } catch (error: any) {
      logError("deleting admin user", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.get("/api/admin/transactions", requireAdmin, async (req, res) => {
    try {
      console.log(`API call: /api/admin/transactions`);
      
      const { data: transactions, error } = await getSupabase()
        .from('transactions')
        .select('*, users(name), products(name)')
        .order('timestamp', { ascending: false });
      
      if (error) {
        if (isMissingTableError(error)) {
          console.warn("[SUPABASE] transactions table missing.");
          return res.json([]);
        }
        throw error;
      }

      const formattedTransactions = (transactions || []).map(t => ({
        ...t,
        user_name: t.users?.name || "Unknown User",
        product_name: t.products?.name || "Unknown Product"
      }));
      
      res.json(formattedTransactions);
    } catch (error: any) {
      logError("fetching admin transactions", error);
      res.status(500).json({ success: false, message: "Failed to fetch transactions" });
    }
  });

  app.post("/api/admin/transactions/:id/status", requireAdmin, async (req, res) => {
    try {
      const { status } = req.body;
      const id = parseId(req.params.id);
      
      const { data: transaction, error: fetchError } = await getSupabase().from('transactions').select('*').eq('id', id).single();
      if (fetchError || !transaction) return res.status(404).json({ success: false, message: "Transaction not found" });

      // If cancelling a buy transaction, restore stock and refund coins
      if (status === 'cancelled' && transaction.status !== 'cancelled' && (transaction.type === 'buy' || transaction.type === 'manual_buy')) {
        // Restore stock
        const { data: product } = await getSupabase().from('products').select('quantity').eq('id', transaction.product_id).single();
        if (product) {
          await getSupabase().from('products').update({ quantity: product.quantity + transaction.quantity }).eq('id', transaction.product_id);
        }
        
        if (transaction.type === 'buy') {
          // Refund user
          const { data: user } = await getSupabase().from('users').select('wallet_balance').eq('id', transaction.user_id).single();
          if (user) {
            await getSupabase().from('users').update({ wallet_balance: user.wallet_balance + transaction.amount }).eq('id', transaction.user_id);
          }
          // Deduct from admin
          const { data: admin } = await getSupabase().from('users').select('id, wallet_balance').eq('role', 'admin').limit(1).single();
          if (admin) {
            await getSupabase().from('users').update({ wallet_balance: admin.wallet_balance - transaction.amount }).eq('id', admin.id);
          }
        }
      } 
      // If un-cancelling a buy transaction, deduct stock and coins again
      else if (status !== 'cancelled' && transaction.status === 'cancelled' && (transaction.type === 'buy' || transaction.type === 'manual_buy')) {
        const { data: product } = await getSupabase().from('products').select('quantity').eq('id', transaction.product_id).single();
        if (product) {
          if (product.quantity < transaction.quantity) {
            return res.status(400).json({ success: false, message: "Not enough stock to un-cancel this order" });
          }
          await getSupabase().from('products').update({ quantity: product.quantity - transaction.quantity }).eq('id', transaction.product_id);
        }
        
        if (transaction.type === 'buy') {
          const { data: user } = await getSupabase().from('users').select('wallet_balance').eq('id', transaction.user_id).single();
          if (user) {
            if (user.wallet_balance < transaction.amount) {
              // Revert stock deduction
              if (product) await getSupabase().from('products').update({ quantity: product.quantity }).eq('id', transaction.product_id);
              return res.status(400).json({ success: false, message: "User does not have enough coins to un-cancel this order" });
            }
            await getSupabase().from('users').update({ wallet_balance: user.wallet_balance - transaction.amount }).eq('id', transaction.user_id);
          }
          const { data: admin } = await getSupabase().from('users').select('id, wallet_balance').eq('role', 'admin').limit(1).single();
          if (admin) {
            await getSupabase().from('users').update({ wallet_balance: admin.wallet_balance + transaction.amount }).eq('id', admin.id);
          }
        }
      }

      const { error: updateError } = await getSupabase().from('transactions').update({ status }).eq('id', id);
      if (updateError) return res.status(500).json({ success: false, message: updateError.message });
      
      res.json({ success: true, message: "Transaction status updated" });
    } catch (error: any) {
      logError("updating transaction status", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.post("/api/admin/transactions/:id/verify", requireAdmin, async (req, res) => {
    try {
      const id = parseId(req.params.id);
      const { data, error } = await getSupabase().from('transactions').update({ status: 'processing' }).eq('id', id).select().single();
      if (error) return res.status(404).json({ success: false, message: "Transaction not found" });
      res.json({ success: true, transaction: data });
    } catch (error: any) {
      logError("verifying transaction", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.post("/api/admin/transactions/:id/reject", requireAdmin, async (req, res) => {
    try {
      const id = parseId(req.params.id);
      const { data: transaction, error: fetchError } = await getSupabase().from('transactions').select('*').eq('id', id).single();
      if (fetchError || !transaction) return res.status(404).json({ success: false, message: "Transaction not found" });
      
      if (transaction.status !== 'cancelled' && (transaction.type === 'buy' || transaction.type === 'manual_buy')) {
        const { data: product } = await getSupabase().from('products').select('quantity').eq('id', transaction.product_id).single();
        if (product) {
          await getSupabase().from('products').update({ quantity: product.quantity + transaction.quantity }).eq('id', transaction.product_id);
        }
      }

      const { data: updatedTransaction, error: updateError } = await getSupabase().from('transactions').update({ status: 'cancelled' }).eq('id', id).select().single();
      if (updateError) return res.status(500).json({ success: false, message: updateError.message });
      
      res.json({ success: true, transaction: updatedTransaction });
    } catch (error: any) {
      logError("rejecting transaction", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.post("/api/exchange", async (req, res) => {
    try {
      const { userId, productId } = req.body;
      const id = parseId(userId);
      
      const { data: user, error: userError } = await getSupabase().from('users').select('*').eq('id', id).single();
      const { data: product, error: prodError } = await getSupabase().from('products').select('*').eq('id', parseId(productId)).single();

      if (userError || prodError || !user || !product) {
        return res.status(404).json({ success: false, message: "User or Product not found" });
      }

      if (product.quantity < (product.quantity_unit || 1)) {
        return res.status(400).json({ success: false, message: "Product out of stock" });
      }

      const price = product.price;
      const discount = product.discount || 0;
      const discountedPrice = price - (price * (discount / 100));

      const paymentMode = await getSetting('paymentMode', 'manual');

      if (paymentMode === 'coin') {
        if (user.wallet_balance < discountedPrice) {
          return res.status(400).json({ success: false, message: "Insufficient coins" });
        }

        // Process Transaction
        await getSupabase().from('users').update({ wallet_balance: user.wallet_balance - discountedPrice }).eq('id', id);
        const { data: admin } = await getSupabase().from('users').select('id, wallet_balance').eq('role', 'admin').limit(1).single();
        if (admin) {
          await getSupabase().from('users').update({ wallet_balance: admin.wallet_balance + discountedPrice }).eq('id', admin.id);
        }
      }
      
      await getSupabase().from('products').update({ quantity: product.quantity - (product.quantity_unit || 1) }).eq('id', product.id);

      const transaction = {
        user_id: userId,
        product_id: productId,
        amount: discountedPrice,
        quantity: (product.quantity_unit || 1),
        type: paymentMode === 'coin' ? 'buy' : 'manual_buy',
        timestamp: new Date().toISOString(),
        status: paymentMode === 'coin' ? 'pending' : 'pending_manual_payment',
        tracking_id: 'TRK-' + Math.random().toString(36).substr(2, 9).toUpperCase()
      };
      
      const { error: transError } = await getSupabase().from('transactions').insert([transaction]);
      if (transError) return res.status(500).json({ success: false, message: transError.message });

      res.json({ success: true, message: paymentMode === 'coin' ? "Purchase successful!" : "Order placed. Please complete manual payment." });
    } catch (error: any) {
      logError("exchange", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.post("/api/checkout", async (req, res) => {
    try {
      const { userId: bodyUserId, items, manualTransactionId, paymentScreenshotUrl } = req.body;
      const headerUserId = req.headers['x-user-id'];
      const userId = bodyUserId || headerUserId;
      
      if (!userId) return res.status(401).json({ success: false, message: "User ID required" });
      
      const id = parseId(userId);
      const { data: user, error: userError } = await getSupabase().from('users').select('*').eq('id', id).single();
      if (userError || !user) return res.status(404).json({ success: false, message: "User not found" });

      const { data: productsList, error: prodError } = await getSupabase().from('products').select('*').in('id', items.map((i: any) => i.productId));
      if (prodError) return res.status(500).json({ success: false, message: prodError.message });
      
      const productMap = new Map(productsList.map(p => [p.id, p]));
      let totalCost = 0;

      const paymentMode = await getSetting('paymentMode', 'manual');

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
        await getSupabase().from('users').update({ wallet_balance: user.wallet_balance - totalCost }).eq('id', id);
        const { data: admin } = await getSupabase().from('users').select('id, wallet_balance').eq('role', 'admin').limit(1).single();
        if (admin) {
          await getSupabase().from('users').update({ wallet_balance: admin.wallet_balance + totalCost }).eq('id', admin.id);
        }
      }

      const newTransactions = [];
      for (const item of items) {
        const product = productMap.get(item.productId);
        if (!product) continue;
        
        await getSupabase().from('products').update({ quantity: product.quantity - item.quantity }).eq('id', product.id);

        const price = product.price;
        const discount = product.discount || 0;
        const discountedPrice = price - (price * (discount / 100));

        newTransactions.push({
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

      const { error: transError } = await getSupabase().from('transactions').insert(newTransactions);
      if (transError) return res.status(500).json({ success: false, message: transError.message });

      res.json({ success: true, message: paymentMode === 'coin' ? "Purchase successful!" : "Order placed. Please wait for admin approval." });
    } catch (error: any) {
      logError("checkout", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // Sell Request Routes
  app.post("/api/sell-request", async (req, res) => {
    try {
      const { name, description, image_urls, quantity, quantity_unit, price, price_type, category, seller_id: bodySellerId, payment_mode, discount } = req.body;
      const headerUserId = req.headers['x-user-id'];
      const seller_id = bodySellerId || headerUserId;
      
      if (!seller_id) return res.status(401).json({ success: false, message: "Seller ID required" });
      
      const unit = quantity_unit || 1;
      if (quantity % unit !== 0) {
        return res.status(400).json({ success: false, message: `Quantity must be a multiple of ${unit}` });
      }
      
      const newProduct = {
        name,
        description,
        image_urls: image_urls || [],
        quantity,
        quantity_unit: unit,
        price,
        price_type,
        payment_mode: payment_mode || 'coin',
        category: category || "Uncategorized",
        seller_id: seller_id ? parseId(seller_id) : null,
        status: 'pending',
        discount: discount || 0
      };
      
      const { data, error } = await getSupabase().from('products').insert([newProduct]).select().single();
      if (error) return res.status(500).json({ success: false, message: error.message });
      res.json({ success: true, product: data });
    } catch (error: any) {
      logError("sell-request", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.post("/api/admin/sell-request/approve", requireAdmin, async (req, res) => {
    try {
      const { productId } = req.body;
      const { data: product, error: prodError } = await getSupabase().from('products').select('*').eq('id', productId).single();
      if (prodError || !product) return res.status(404).json({ success: false, message: "Product not found" });

      if (product.status !== 'pending') return res.status(400).json({ success: false, message: "Request already processed" });

      const { data: seller, error: sellerError } = await getSupabase().from('users').select('*').eq('id', product.seller_id).single();
      if (sellerError || !seller) return res.status(404).json({ success: false, message: "Seller not found" });

      const totalValue = (product.quantity / (product.quantity_unit || 1)) * product.price;
      if (product.payment_mode === 'coin') {
        await getSupabase().from('users').update({ wallet_balance: seller.wallet_balance + totalValue }).eq('id', seller.id);
        const { data: admin } = await getSupabase().from('users').select('id, wallet_balance').eq('role', 'admin').limit(1).single();
        if (admin) {
          await getSupabase().from('users').update({ wallet_balance: admin.wallet_balance - totalValue }).eq('id', admin.id);
        }
      }

      await getSupabase().from('products').update({ status: 'approved' }).eq('id', productId);

      const transaction = {
        user_id: product.seller_id,
        product_id: productId,
        amount: totalValue,
        quantity: product.quantity,
        type: 'sell',
        timestamp: new Date().toISOString(),
        status: 'delivered',
        tracking_id: 'SELL-' + Math.random().toString(36).substr(2, 9).toUpperCase()
      };
      
      await getSupabase().from('transactions').insert([transaction]);

      res.json({ 
        success: true, 
        message: product.payment_mode === 'coin' 
          ? "Sell request approved and coins added to seller's wallet!" 
          : "Sell request approved. Please ensure manual payment is sent to the seller."
      });
    } catch (error: any) {
      logError("sell-request approve", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.post("/api/admin/sell-request/reject", requireAdmin, async (req, res) => {
    try {
      const { productId } = req.body;
      const { error } = await getSupabase().from('products').update({ status: 'rejected' }).eq('id', productId);
      if (error) return res.status(404).json({ success: false, message: "Product not found" });
      res.json({ success: true, message: "Sell request rejected" });
    } catch (error: any) {
      logError("sell-request reject", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // Admin Routes
  app.post("/api/admin/products", requireAdmin, async (req, res) => {
    try {
      console.log("[ADMIN] Create product request:", req.body);
      const { name, description, image_urls, quantity, quantity_unit, price, price_type, payment_mode, category, discount } = req.body;
      const userId = req.headers['x-user-id'];
      const unit = quantity_unit || 1;
      
      if (!name || !description || !price) {
        return res.status(400).json({ success: false, message: "Name, description, and price are required" });
      }

      if (quantity % unit !== 0) {
        return res.status(400).json({ success: false, message: `Quantity must be a multiple of ${unit}` });
      }
      
      const newProduct = {
        name,
        description,
        image_urls: image_urls || [],
        quantity,
        quantity_unit: unit,
        price,
        price_type: price_type || 'BDT',
        payment_mode: payment_mode || 'coin',
        category: category || "Uncategorized",
        seller_id: userId ? parseId(userId) : null,
        status: 'approved',
        discount: discount || 0
      };
      
      const { data, error } = await getSupabase().from('products').insert([newProduct]).select().single();
      if (error) {
        logError("admin create product db error", error);
        return res.status(500).json({ success: false, message: error.message });
      }
      res.json({ success: true, product: data });
    } catch (error: any) {
      logError("admin create product", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.put("/api/admin/products/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseId(req.params.id);
      const { data: product, error: fetchError } = await getSupabase().from('products').select('*').eq('id', id).single();
      if (fetchError || !product) return res.status(404).json({ success: false, message: "Product not found" });

      const unit = req.body.quantity_unit || product.quantity_unit || 1;
      const quantity = req.body.quantity !== undefined ? req.body.quantity : product.quantity;
      if (quantity % unit !== 0) {
        return res.status(400).json({ success: false, message: `Quantity must be a multiple of ${unit}` });
      }
      
      const { data: updatedProduct, error: updateError } = await getSupabase().from('products').update({ ...req.body, quantity_unit: unit }).eq('id', id).select().single();
      if (updateError) return res.status(500).json({ success: false, message: updateError.message });
      res.json({ success: true, product: updatedProduct });
    } catch (error: any) {
      logError("admin update product", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.delete("/api/admin/products/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseId(req.params.id);
      const { error } = await getSupabase().from('products').delete().eq('id', id);
      if (error) return res.status(404).json({ success: false, message: "Product not found" });
      res.json({ success: true, message: "Product deleted successfully" });
    } catch (error: any) {
      logError("admin delete product", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.post("/api/coins/transfer", async (req, res) => {
    try {
      const { fromUserId, toUsername, amount } = req.body;
      const fromId = parseId(fromUserId);
      
      const { data: fromUser, error: fromError } = await getSupabase().from('users').select('*').eq('id', fromId).single();
      const { data: toUser, error: toError } = await getSupabase().from('users').select('*').eq('email', toUsername.toLowerCase()).single();

      if (fromError || !fromUser) return res.status(404).json({ success: false, message: "Sender not found" });
      if (toError || !toUser) return res.status(404).json({ success: false, message: "Recipient not found" });
      if (fromUser.id === toUser.id) return res.status(400).json({ success: false, message: "Cannot transfer to yourself" });
      if (amount <= 0) return res.status(400).json({ success: false, message: "Invalid amount" });
      if (fromUser.wallet_balance < amount) return res.status(400).json({ success: false, message: "Insufficient balance" });

      await getSupabase().from('users').update({ wallet_balance: fromUser.wallet_balance - amount }).eq('id', fromUser.id);
      await getSupabase().from('users').update({ wallet_balance: toUser.wallet_balance + amount }).eq('id', toUser.id);

      const transactions = [
        {
          user_id: fromUserId,
          amount: amount,
          type: 'transfer_out',
          timestamp: new Date().toISOString(),
          status: 'completed',
          tracking_id: 'XFER-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
          recipient_name: toUsername
        },
        {
          user_id: toUser.id,
          amount: amount,
          type: 'transfer_in',
          timestamp: new Date().toISOString(),
          status: 'completed',
          tracking_id: 'XFER-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
          sender_name: fromUser.name
        }
      ];

      await getSupabase().from('transactions').insert(transactions);

      res.json({ success: true, message: `Successfully transferred ${amount} coins to ${toUsername}` });
    } catch (error: any) {
      logError("coin transfer", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
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
    logError("Global API Error", err);
    res.status(500).json({ 
      success: false, 
      message: "Internal Server Error", 
      error: err.message || "Unknown error"
    });
  });

export default app;
