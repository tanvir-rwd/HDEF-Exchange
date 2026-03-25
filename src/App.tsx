import React, { useState, useEffect, useMemo, Component, ErrorInfo, ReactNode } from 'react';
import { 
  ShoppingBag, 
  Wallet, 
  LayoutDashboard, 
  Plus, 
  Trash2, 
  Edit, 
  LogOut,
  Package,
  History,
  CheckCircle2,
  AlertCircle,
  X,
  User as UserIcon,
  ShieldCheck,
  Search,
  ArrowRight,
  ArrowUpRight,
  ArrowDownLeft,
  Coins,
  Store,
  Settings,
  Lock,
  Mail,
  Users,
  Eye,
  EyeOff,
  ShoppingCart,
  Minus,
  Camera,
  Upload,
  CreditCard,
  Menu
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { supabase } from './lib/supabase';
import { User, Product, Transaction, PaymentMethod } from './types';
import { ImageUpload } from './components/ImageUpload';
import { ProfileImageUpload } from './components/ProfileImageUpload';

const baseApiFetch = async (url: string, options: RequestInit = {}, userId?: number | string) => {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (userId) {
    headers['x-user-id'] = userId.toString();
  }
  
  // Prevent caching for GET requests to ensure fresh data
  const fetchOptions: RequestInit = {
    ...options,
    headers,
    cache: options.method === 'GET' || !options.method ? 'no-store' : options.cache
  };
  
  // Use relative URLs if possible, fallback to absolute if needed
  // In most browser environments, relative URLs work fine.
  const absoluteUrl = url.startsWith('http') ? url : url;
  
  console.log(`Fetching: ${absoluteUrl}`, fetchOptions);
  try {
    const response = await fetch(absoluteUrl, fetchOptions);
    console.log(`Response from ${absoluteUrl}: ${response.status} ${response.statusText}`);
    return response;
  } catch (error) {
    console.error(`Fetch error for ${absoluteUrl}:`, error);
    // If relative fetch failed, try absolute with window.location.origin as a last resort
    if (!url.startsWith('http')) {
      try {
        const fallbackUrl = `${window.location.origin}${url}`;
        console.log(`Retrying with absolute URL: ${fallbackUrl}`);
        const response = await fetch(fallbackUrl, { ...options, headers });
        return response;
      } catch (fallbackError) {
        console.error(`Fallback fetch error for ${url}:`, fallbackError);
        throw fallbackError;
      }
    }
    throw error;
  }
};

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={32} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Something went wrong</h1>
            <p className="text-slate-600 mb-6">{this.state.error?.message || "An unexpected error occurred."}</p>
            <button 
              onClick={() => window.location.reload()}
              className="btn-primary w-full"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

export interface CartItem {
  product: Product;
  quantity: number;
}

const SellSection = ({ user, showNotify, paymentMode, apiFetch, fetchProducts }: { user: User, showNotify: (msg: string, type: 'success' | 'error') => void, paymentMode: 'coin' | 'manual', apiFetch: any, fetchProducts: () => Promise<void> }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    image_urls: [] as string[],
    quantity: 0,
    quantity_unit: 1,
    price: 0,
    price_type: 'BDT' as 'BDT' | 'USDT',
    payment_mode: paymentMode,
    category: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.image_urls.length === 0) {
      showNotify("Please upload at least one image", "error");
      return;
    }
    if (formData.quantity % formData.quantity_unit !== 0) {
      showNotify("Total quantity must be a multiple of the quantity unit", "error");
      return;
    }
    try {
      const res = await apiFetch('/api/sell-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success) {
        showNotify("Sell request submitted successfully!", "success");
        setFormData({ 
          name: '', 
          description: '', 
          image_urls: [], 
          quantity: 0, 
          quantity_unit: 1, 
          price: 0, 
          price_type: 'BDT', 
          discount: 0,
          payment_mode: paymentMode,
          category: '' 
        });
        if (fetchProducts) fetchProducts();
      } else {
        showNotify(data.message || "Failed to submit sell request", "error");
      }
    } catch (err) {
      showNotify("Server error", "error");
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-8 card-shadow">
      <h2 className="text-2xl font-bold text-slate-900 mb-6">Sell Product</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Product Name</label>
          <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="input-field" required />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Description</label>
          <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="input-field" rows={4} required />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Product Images</label>
          <ImageUpload 
            images={formData.image_urls} 
            onChange={(imgs) => setFormData({...formData, image_urls: imgs})} 
            multiple={true}
            maxImages={5}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Total Quantity</label>
            <input type="number" value={formData.quantity || 0} onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value) || 0})} className="input-field" required min="1" />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Quantity per Unit</label>
            <input type="number" value={formData.quantity_unit || 1} onChange={(e) => setFormData({...formData, quantity_unit: parseInt(e.target.value) || 1})} className="input-field" required min="1" />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              {paymentMode === 'coin' ? 'Coin Price' : `Price (${formData.price_type})`} (per Unit)
            </label>
            <div className="flex gap-2">
              <input type="number" value={formData.price || 0} onChange={(e) => setFormData({...formData, price: parseFloat(e.target.value) || 0})} className="input-field flex-grow" required min="1" />
              {paymentMode === 'manual' && (
                <select 
                  value={formData.price_type} 
                  onChange={(e) => setFormData({...formData, price_type: e.target.value as 'BDT' | 'USDT'})}
                  className="input-field w-24"
                >
                  <option value="BDT">BDT</option>
                  <option value="USDT">USDT</option>
                </select>
              )}
            </div>
          </div>
        </div>
        <div className="bg-emerald-50 p-4 rounded-xl text-emerald-800 text-sm">
          <strong>Pricing Summary:</strong> You are selling <strong>{formData.quantity || 0}</strong> total items. They will be sold in batches of <strong>{formData.quantity_unit || 1}</strong> items for <strong>{formData.price || 0}</strong> {paymentMode === 'coin' ? 'coins' : formData.price_type} per batch. Total value: <strong>{((formData.quantity || 0) / (formData.quantity_unit || 1)) * (formData.price || 0)}</strong> {paymentMode === 'coin' ? 'coins' : formData.price_type}.
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Category</label>
          <input type="text" value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} className="input-field" required />
        </div>
        <button type="submit" className="btn-primary w-full">Submit Sell Request</button>
      </form>
    </div>
  );
};

const SecurityView = ({ authForm, setAuthForm, handleChangePassword }: any) => {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-8 card-shadow">
      <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
        <ShieldCheck size={20} className="text-emerald-600" />
        Change Password
      </h3>
      <form onSubmit={handleChangePassword} className="space-y-6 max-w-md">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Current Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              required
              type="password" 
              value={authForm.oldPassword} 
              onChange={(e) => setAuthForm({...authForm, oldPassword: e.target.value})} 
              className="input-field !pl-10" 
              placeholder="••••••••"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">New Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              required
              type="password" 
              value={authForm.newPassword} 
              onChange={(e) => setAuthForm({...authForm, newPassword: e.target.value})} 
              className="input-field !pl-10" 
              placeholder="••••••••"
            />
          </div>
        </div>
        <button type="submit" className="btn-primary w-full">Update Password</button>
      </form>
    </div>
  );
};

const CoinTransferView = ({ user, transferForm, setTransferForm, showNotify, fetchUserData, apiFetch }: any) => {
  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferForm.recipient || transferForm.amount <= 0) {
      showNotify("Please enter valid recipient and amount", "error");
      return;
    }
    try {
      const res = await apiFetch('/api/coins/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fromUserId: user.id, 
          toUsername: transferForm.recipient, 
          amount: transferForm.amount 
        })
      });
      const data = await res.json();
      if (data.success) {
        showNotify(data.message, "success");
        setTransferForm({ recipient: '', amount: 0 });
        fetchUserData(user.id);
      } else {
        showNotify(data.message, "error");
      }
    } catch (err) {
      showNotify("Transfer failed", "error");
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-8 card-shadow">
      <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
        <ArrowRight size={20} className="text-emerald-600" />
        Transfer Coins
      </h3>
      <form onSubmit={handleTransfer} className="space-y-6 max-w-md">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Recipient Email</label>
          <div className="relative">
            <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              required
              type="email" 
              value={transferForm.recipient} 
              onChange={(e) => setTransferForm({...transferForm, recipient: e.target.value})} 
              className="input-field !pl-10" 
              placeholder="e.g. user@example.com"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Amount</label>
          <div className="relative">
            <Coins className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              required
              type="number" 
              min="1"
              value={transferForm.amount || 0} 
              onChange={(e) => setTransferForm({...transferForm, amount: parseInt(e.target.value) || 0})} 
              className="input-field !pl-10" 
              placeholder="0"
            />
          </div>
        </div>
        <button type="submit" className="btn-primary w-full">Send Coins</button>
      </form>
    </div>
  );
};

const MyAssetsView = ({ user, transactions, products, transferForm, setTransferForm, showNotify, fetchUserData, apiFetch }: any) => {
  const ownedTransactions = transactions.filter(t => {
    if (t.status === 'cancelled') return false;
    if (t.type === 'manual_buy' && t.status === 'pending_manual_payment') return false;
    return t.type === 'buy' || t.type === 'manual_buy';
  });
  
  const ownedProducts = useMemo(() => {
    const productMap = new Map(products.map(p => [p.id, p]));
    const accMap = new Map<number, Product & { ownedQuantity: number }>();

    ownedTransactions.forEach(t => {
      const existing = accMap.get(t.product_id);
      if (existing) {
        existing.ownedQuantity += t.quantity;
      } else {
        const product = productMap.get(t.product_id);
        if (product) {
          accMap.set(t.product_id, { ...(product as object), ownedQuantity: t.quantity } as Product & { ownedQuantity: number });
        } else {
          accMap.set(t.product_id, { 
            id: t.product_id, 
            name: t.product_name || 'Unknown Product', 
            description: 'Product details not available', 
            image_urls: [], 
            quantity: 0, 
            price: t.amount / t.quantity, 
            category: 'Unknown',
            ownedQuantity: t.quantity 
          } as any);
        }
      }
    });
    return Array.from(accMap.values());
  }, [ownedTransactions, products]);

  const totalOwnedProducts = ownedProducts.reduce((sum, p) => sum + p.ownedQuantity, 0);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-emerald-600 rounded-3xl p-8 text-white shadow-xl shadow-emerald-200 relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-emerald-100 text-sm font-medium mb-1">Total Coin Balance</p>
            <h2 className="text-4xl font-bold flex items-center gap-3">
              <Coins size={32} />
              {user.wallet_balance.toLocaleString()}
            </h2>
            <p className="mt-4 text-emerald-100 text-xs italic">Real-time balance synced with your account.</p>
          </div>
          <div className="absolute -right-8 -bottom-8 text-white/10 rotate-12">
            <Wallet size={160} />
          </div>
        </div>
        <div className="bg-white rounded-3xl border border-slate-100 p-8 card-shadow flex flex-col justify-center items-center text-center">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-4">
            <Package size={32} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-1">Owned Products</h3>
          <p className="text-3xl font-black text-emerald-600">{totalOwnedProducts}</p>
          <p className="text-xs text-slate-400 mt-2 uppercase tracking-widest font-bold">Asset Summary</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 p-8 card-shadow">
        <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
          <ShoppingBag size={20} className="text-emerald-600" />
          My Product Assets
        </h3>
        {ownedProducts.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Package size={48} className="mx-auto mb-3 opacity-20" />
            <p>You don't own any products yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {ownedProducts.map((product) => (
              <div key={product.id} className="bg-slate-50 rounded-2xl p-4 border border-slate-100 group hover:border-emerald-200 transition-all">
                <div className="aspect-square rounded-xl overflow-hidden mb-4 bg-white border border-slate-200">
                  {product.image_urls.length > 0 ? (
                    <img src={product.image_urls[0]} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <Package size={48} />
                    </div>
                  )}
                </div>
                <h4 className="font-bold text-slate-900 truncate">{product.name}</h4>
                <p className="text-xs text-slate-500 mb-3 line-clamp-1">{product.description}</p>
                <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quantity</span>
                  <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-xs font-bold">{product.ownedQuantity}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CoinTransferView 
        user={user} 
        transferForm={transferForm} 
        setTransferForm={setTransferForm} 
        showNotify={showNotify} 
        fetchUserData={fetchUserData} 
        apiFetch={apiFetch}
      />
    </div>
  );
};

const PaymentMethodsView = ({ paymentMethods, fetchPaymentMethods, showNotify, apiFetch }: any) => {
  const [formData, setFormData] = useState({ name: '', number: '', instructions: '' });
  const [editingId, setEditingId] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingId ? `/api/admin/payment-methods/${editingId}` : '/api/admin/payment-methods';
      const method = editingId ? 'PUT' : 'POST';
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success) {
        showNotify(editingId ? "Payment method updated" : "Payment method added", 'success');
        setFormData({ name: '', number: '', instructions: '' });
        setEditingId(null);
        fetchPaymentMethods();
      } else {
        showNotify(data.message, 'error');
      }
    } catch (err) {
      showNotify("Server error", 'error');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await apiFetch(`/api/admin/payment-methods/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showNotify("Payment method deleted", 'success');
        fetchPaymentMethods();
      } else {
        showNotify(data.message, 'error');
      }
    } catch (err) {
      showNotify("Server error", 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-slate-100 p-8 card-shadow">
        <h3 className="text-xl font-bold text-slate-900 mb-6">{editingId ? 'Edit Payment Method' : 'Add Payment Method'}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="text" placeholder="Method Name (e.g. bKash)" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="input-field" required />
          <input type="text" placeholder="Number / Wallet Address" value={formData.number} onChange={(e) => setFormData({...formData, number: e.target.value})} className="input-field" required />
          <textarea placeholder="Instructions" value={formData.instructions} onChange={(e) => setFormData({...formData, instructions: e.target.value})} className="input-field" required />
          <button type="submit" className="btn-primary w-full">{editingId ? 'Update' : 'Add'}</button>
          {editingId && <button type="button" onClick={() => { setEditingId(null); setFormData({ name: '', number: '', instructions: '' }); }} className="btn-secondary w-full">Cancel</button>}
        </form>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 p-8 card-shadow">
        <h3 className="text-xl font-bold text-slate-900 mb-6">Existing Payment Methods</h3>
        <div className="space-y-4">
          {paymentMethods.map((m: PaymentMethod) => (
            <div key={m.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div>
                <p className="font-bold text-slate-900">{m.name}</p>
                <p className="text-sm text-slate-600">{m.number}</p>
                <p className="text-xs text-slate-500">{m.instructions}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setEditingId(m.id); setFormData({ name: m.name, number: m.number, instructions: m.instructions }); }} className="btn-secondary text-indigo-600">Edit</button>
                <button onClick={() => handleDelete(m.id)} className="btn-secondary text-rose-600">Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const PaymentVerificationView = ({ transactions, fetchTransactions, showNotify, apiFetch }: any) => {
  const pendingTransactions = transactions.filter((t: Transaction) => t.status === 'pending_manual_payment');

  const handleAction = async (id: number | string, action: 'verify' | 'reject') => {
    try {
      const res = await apiFetch(`/api/admin/transactions/${id}/${action}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showNotify(`Transaction ${action}ed`, 'success');
        fetchTransactions();
      } else {
        showNotify(data.message, 'error');
      }
    } catch (err) {
      showNotify("Server error", 'error');
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-8 card-shadow">
      <h3 className="text-xl font-bold text-slate-900 mb-6">Payment Verification</h3>
      <div className="space-y-4">
        {pendingTransactions.map((t: Transaction) => (
          <div key={t.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div>
              <p className="font-bold text-slate-900">Order ID: {t.id}</p>
              <p className="text-sm text-slate-600">User: {t.user_name}</p>
              <p className="text-sm text-slate-600">Method: {t.payment_method_id}</p>
              <p className="text-sm text-slate-600">Trx ID: {t.manual_transaction_id}</p>
              {t.payment_screenshot_url && (
                <div className="mt-2">
                  <p className="text-xs font-bold text-slate-500 uppercase mb-1">Screenshot:</p>
                  <img 
                    src={t.payment_screenshot_url} 
                    alt="Payment Proof" 
                    className="w-32 h-32 object-cover rounded-lg border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => window.open(t.payment_screenshot_url, '_blank')}
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}
              <p className="text-sm text-slate-600">Status: {t.status}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleAction(t.id, 'verify')} className="btn-secondary text-indigo-600">Verify & Confirm</button>
              <button onClick={() => handleAction(t.id, 'reject')} className="btn-secondary text-rose-600">Reject</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ProfileView = ({ 
  user, 
  profileForm, 
  setProfileForm, 
  handleUpdateProfile 
}: { 
  user: User | null, 
  profileForm: any, 
  setProfileForm: any, 
  handleUpdateProfile: any 
}) => {
  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Section 1: Profile Image */}
      <section className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm inline-block min-w-full sm:min-w-[400px]">
        <div className="flex items-center gap-4">
          <ProfileImageUpload 
            currentImage={profileForm.profile_image_url}
            onChange={(base64) => setProfileForm({ ...profileForm, profile_image_url: base64 })}
          />
          <div className="hidden sm:block border-l border-slate-100 pl-4 h-12">
            <h3 className="text-sm font-bold text-slate-900">Profile Photo</h3>
            <p className="text-[10px] text-slate-500 max-w-[150px]">Update your photo to help people recognize you.</p>
          </div>
        </div>
      </section>

      {/* Section 2: Personal Information */}
      <section className="bg-white rounded-2xl border border-slate-100 p-6 md:p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-8 border-b border-slate-50 pb-4">
          <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
            <UserIcon size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Personal Information</h3>
            <p className="text-xs text-slate-500">Manage your basic identity details</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Full Name</label>
            <input 
              type="text" 
              value={profileForm.full_name || ''} 
              onChange={(e) => setProfileForm({...profileForm, full_name: e.target.value})} 
              placeholder="Enter your full name"
              className="input-field py-3" 
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Contact Number</label>
            <input 
              type="text" 
              value={profileForm.contact_info || ''} 
              onChange={(e) => setProfileForm({...profileForm, contact_info: e.target.value})} 
              placeholder="+880 1XXX XXXXXX"
              className="input-field py-3" 
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">WhatsApp Number (Optional)</label>
            <input 
              type="text" 
              value={profileForm.whatsapp_number || ''} 
              onChange={(e) => setProfileForm({...profileForm, whatsapp_number: e.target.value})} 
              placeholder="+880 1XXX XXXXXX"
              className="input-field py-3" 
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Bio / Profile Details</label>
            <textarea 
              value={profileForm.profile_details || ''} 
              onChange={(e) => setProfileForm({...profileForm, profile_details: e.target.value})} 
              placeholder="A brief description about yourself..."
              rows={3}
              className="input-field py-3 resize-none" 
            />
          </div>
        </div>
      </section>

      {/* Section 3: Account Information */}
      <section className="bg-white rounded-2xl border border-slate-100 p-6 md:p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-8 border-b border-slate-50 pb-4">
          <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Account Information</h3>
            <p className="text-xs text-slate-500">Secure account identifiers</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Username</label>
            <div className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 flex items-center gap-3 select-none">
              <Lock size={16} className="opacity-50" />
              <span className="font-medium">{user?.name}</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
              <AlertCircle size={10} />
              Username cannot be changed
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Email Address</label>
            <div className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 flex items-center gap-3 select-none">
              <Mail size={16} className="opacity-50" />
              <span className="font-medium">{user?.email}</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
              <AlertCircle size={10} />
              Used for recovery and notifications
            </p>
          </div>
        </div>
      </section>

      {/* Action Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
        <p className="text-sm text-slate-500 text-center sm:text-left">
          Make sure all information is correct before saving.
        </p>
        <button 
          onClick={handleUpdateProfile} 
          className="btn-primary w-full sm:w-auto px-10 py-4 text-lg shadow-xl shadow-emerald-200/50 active:scale-95 transition-transform"
        >
          <CheckCircle2 size={20} />
          Save Changes
        </button>
      </div>
    </div>
  );
};



const UserManagementView = ({ showNotify, apiFetch }: { showNotify: (msg: string, type: 'success' | 'error') => void, apiFetch: any }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      const res = await apiFetch('/api/admin/users');
      const data = await res.json();
      setUsers(data);
    } catch (error) {
      showNotify("Failed to fetch users", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId: number, newRole: 'admin' | 'user') => {
    try {
      const res = await apiFetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });
      if (res.ok) {
        showNotify("User role updated", "success");
        fetchUsers();
      } else {
        showNotify("Failed to update role", "error");
      }
    } catch (error) {
      showNotify("Failed to update role", "error");
    }
  };

  const handleBalanceChange = async (userId: number, newBalance: number) => {
    try {
      const res = await apiFetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet_balance: newBalance })
      });
      if (res.ok) {
        showNotify("User balance updated", "success");
        fetchUsers();
      } else {
        showNotify("Failed to update balance", "error");
      }
    } catch (error) {
      showNotify("Failed to update balance", "error");
    }
  };

  if (isLoading) return <div className="p-8 text-center text-slate-500">Loading users...</div>;

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-8 card-shadow">
      <h3 className="text-xl font-bold text-slate-900 mb-6">User Management</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 text-sm text-slate-500">
              <th className="pb-4 font-medium">User</th>
              <th className="pb-4 font-medium">Email</th>
              <th className="pb-4 font-medium">Role</th>
              <th className="pb-4 font-medium">Balance</th>
              <th className="pb-4 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {users.map((u) => (
              <tr key={u.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                <td className="py-4">
                  <div className="flex items-center gap-3">
                    <img src={u.profile_image_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.name}`} alt={u.name} className="w-8 h-8 rounded-full bg-slate-100" />
                    <div>
                      <p className="font-medium text-slate-900">{u.name}</p>
                      {u.full_name && <p className="text-xs text-slate-500">{u.full_name}</p>}
                    </div>
                  </div>
                </td>
                <td className="py-4 text-slate-600">{u.email}</td>
                <td className="py-4">
                  <select 
                    value={u.role} 
                    onChange={(e) => handleRoleChange(u.id, e.target.value as 'admin' | 'user')}
                    className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="py-4">
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      defaultValue={u.wallet_balance || 0} 
                      onBlur={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val >= 0 && val !== u.wallet_balance) {
                          handleBalanceChange(u.id, val);
                        } else if (val < 0) {
                          showNotify("Balance cannot be negative", "error");
                          e.target.value = u.wallet_balance.toString();
                        }
                      }}
                      className="w-24 bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2"
                    />
                  </div>
                </td>
                <td className="py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${u.is_verified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {u.is_verified ? 'Verified' : 'Unverified'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const AnalyticsView = ({ products, transactions }: { products: Product[], transactions: Transaction[] }) => {
  // Mock data for User Activity and User Reviews
  const userActivityData = [
    { name: 'Mon', active: 400 },
    { name: 'Tue', active: 300 },
    { name: 'Wed', active: 200 },
    { name: 'Thu', active: 278 },
    { name: 'Fri', active: 189 },
    { name: 'Sat', active: 239 },
    { name: 'Sun', active: 349 },
  ];

  const userReviewsData = [
    { name: '5 Stars', value: 400 },
    { name: '4 Stars', value: 300 },
    { name: '3 Stars', value: 300 },
    { name: '2 Stars', value: 200 },
    { name: '1 Star', value: 100 },
  ];
  const COLORS = ['#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0'];

  const totalOrders = transactions.length;
  const totalSales = transactions.reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold mb-4">Total Orders: {totalOrders}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={userActivityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="active" fill="#059669" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold mb-4">Total Sales: {totalSales.toLocaleString()} Coins</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={userActivityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="active" stroke="#059669" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold mb-4">Product Performance</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={products.slice(0, 5)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="price" fill="#059669" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold mb-4">User Reviews</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={userReviewsData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label>
                {userReviewsData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const AppContent: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentMode, setPaymentMode] = useState<'coin' | 'manual'>('coin');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCartItemIds, setSelectedCartItemIds] = useState<number[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutItems, setCheckoutItems] = useState<CartItem[]>([]);
  const [manualTransactionId, setManualTransactionId] = useState('');
  const [paymentScreenshotUrl, setPaymentScreenshotUrl] = useState('');
  const [transferForm, setTransferForm] = useState({ recipient: '', amount: 0 });
  const [activeTab, setActiveTab] = useState<'store' | 'dashboard' | 'admin'>('store');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Auth State
  const [authConfig, setAuthConfig] = useState<{ 
    isOpen: boolean, 
    view: 'login' | 'register' | 'forgot_password' | 'verify_email' | 'reset_password', 
    role: 'user' | 'admin' 
  }>({ isOpen: false, view: 'login', role: 'user' });
  const [authForm, setAuthForm] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    otp: '', 
    newPassword: '',
    oldPassword: '' 
  });
  const [showPassword, setShowPassword] = useState(false);

  const openAuthModal = (role: 'user' | 'admin') => {
    setAuthConfig({ isOpen: true, view: 'login', role });
    setAuthForm({ name: '', email: '', password: '', otp: '', newPassword: '', oldPassword: '' });
  };

  // Dashboard Sidebar State
  const [dashboardView, setDashboardView] = useState<'overview' | 'history' | 'settings' | 'security' | 'tracking' | 'sell' | 'assets'>('overview');
  const [adminView, setAdminView] = useState<'products' | 'users' | 'settings' | 'analytics' | 'buy' | 'assets' | 'orders' | 'payment-methods' | 'payment-verification' | 'security' | 'payment-settings'>('products');
  const [enabledPaymentMethods, setEnabledPaymentMethods] = useState<number[]>([]);
  const [trackingId, setTrackingId] = useState('');
  const [trackingResult, setTrackingResult] = useState<Transaction | null>(null);
  
  const apiFetch = (url: string, options: RequestInit = {}) => baseApiFetch(url, options, user?.id);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        // Optionally fetch user profile from API
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        // Fetch user profile or set user state
        // Assuming there is a function to fetch user data
        fetchUserData(session.user.id);
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Admin Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    whatsapp_number: '',
    contact_info: '',
    profile_details: '',
    profile_image_url: ''
  });

  useEffect(() => {
    if (user) {
      setProfileForm({
        full_name: user.full_name || '',
        whatsapp_number: user.whatsapp_number || '',
        contact_info: user.contact_info || '',
        profile_details: user.profile_details || '',
        profile_image_url: user.profile_image_url || ''
      });
    }
  }, [user]);

  const handleUpdateProfile = async () => {
    try {
      const res = await apiFetch('/api/users/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id, ...profileForm })
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
        showNotify("Profile updated successfully", "success");
      } else {
        showNotify(data.message, "error");
      }
    } catch (err) {
      showNotify("Failed to update profile", "error");
    }
  };
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    image_urls: [] as string[],
    quantity: 0,
    quantity_unit: 1,
    price: 0,
    discount: 0,
    price_type: 'BDT' as 'BDT' | 'USDT',
    payment_mode: 'coin' as 'coin' | 'manual',
    category: ''
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const [categoryModified, setCategoryModified] = useState(false);

  useEffect(() => {
    if (!categoryModified && formData.name) {
      const nameLower = formData.name.toLowerCase();
      let guessedCategory = 'General';

      if (nameLower.match(/(headphone|earbud|speaker|audio|mic|sound)/)) guessedCategory = 'Audio';
      else if (nameLower.match(/(watch|band|wearable|tracker)/)) guessedCategory = 'Wearables';
      else if (nameLower.match(/(keyboard|mouse|monitor|laptop|phone|pc|computer|tablet|screen)/)) guessedCategory = 'Electronics';
      else if (nameLower.match(/(shirt|shoe|pant|jacket|wear|sneaker|clothing|apparel)/)) guessedCategory = 'Clothing';
      else if (nameLower.match(/(book|pen|notebook|stationery|pencil)/)) guessedCategory = 'Stationery';
      else if (nameLower.match(/(game|console|playstation|xbox|nintendo|controller)/)) guessedCategory = 'Gaming';
      else if (nameLower.match(/(desk|chair|table|furniture|sofa)/)) guessedCategory = 'Furniture';
      else if (nameLower.match(/(bag|backpack|wallet|purse)/)) guessedCategory = 'Accessories';
      else if (nameLower.match(/(food|snack|drink|beverage|coffee|tea)/)) guessedCategory = 'Food & Beverage';

      if (formData.category !== guessedCategory) {
        setFormData(prev => ({ ...prev, category: guessedCategory }));
      }
    } else if (!categoryModified && !formData.name && formData.category !== '') {
      setFormData(prev => ({ ...prev, category: '' }));
    }
  }, [formData.name, categoryModified]);

  useEffect(() => {
    fetchProducts();
    fetchPaymentMode();
    fetchPaymentMethods();
    fetchEnabledPaymentMethods();
  }, []);

  useEffect(() => {
    if (user) {
      fetchUserData(user.id);
    } else {
      setTransactions([]);
    }
  }, [user]);

  const fetchAllTransactions = async () => {
    try {
      const res = await apiFetch('/api/admin/transactions');
      if (res.ok) {
        const data = await res.json();
        setAllTransactions(data);
      }
    } catch (err) {
      console.error("Failed to fetch all transactions", err);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin' && (adminView === 'orders' || adminView === 'payment-verification' || adminView === 'overview')) {
      fetchAllTransactions();
    }
  }, [user, adminView]);

  const handleUpdateOrderStatus = async (transactionId: number, newStatus: string) => {
    try {
      const res = await apiFetch(`/api/admin/transactions/${transactionId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        showNotify(data.message, 'success');
        fetchAllTransactions();
      } else {
        showNotify(data.message, 'error');
      }
    } catch (err) {
      showNotify("Failed to update status", 'error');
    }
  };
  useEffect(() => {
    setCart([]);
    setSelectedCartItemIds([]);
  }, [paymentMode]);

  const fetchPaymentMode = async () => {
    try {
      const res = await apiFetch('/api/settings/payment-mode');
      const data = await res.json();
      setPaymentMode(data.paymentMode);
    } catch (err) {
      console.error("Failed to load payment mode");
    }
  };

  const fetchEnabledPaymentMethods = async () => {
    try {
      const res = await apiFetch('/api/settings/enabled-payment-methods');
      const data = await res.json();
      setEnabledPaymentMethods(data.enabledMethods || []);
    } catch (err) {
      console.error("Failed to load enabled payment methods");
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      const res = await apiFetch('/api/payment-methods');
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setPaymentMethods(data);
      } else {
        console.error("Expected array for payment methods, got:", data);
        setPaymentMethods([]);
      }
    } catch (err) {
      console.error("Failed to load payment methods:", err);
      // showNotify("Failed to load payment methods", 'error'); // Silent fail for background fetch
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/products');
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setProducts(data);
      } else {
        console.error("Expected array for products, got:", data);
        setProducts([]);
      }
    } catch (err) {
      console.error("Failed to load products:", err);
      showNotify("Failed to load products", 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserData = async (userId: string | number) => {
    if (!userId) {
      console.warn("Invalid userId provided to fetchUserData", userId);
      return;
    }
    
    try {
      console.log(`Fetching data for userId: ${userId}`);
      console.log(`Fetching from: /api/users/${userId}`);
      const [userRes, transRes] = await Promise.all([
        apiFetch(`/api/users/${userId}`),
        apiFetch(`/api/transactions/${userId}`)
      ]);
      
      if (!userRes.ok) {
        const text = await userRes.text();
        console.error(`Failed to fetch user: ${userRes.status} ${userRes.statusText}`, text);
        throw new Error(`Failed to fetch user: ${userRes.statusText}`);
      }
      if (!transRes.ok) {
        const text = await transRes.text();
        console.error(`Failed to fetch transactions: ${transRes.status} ${transRes.statusText}`, text);
        throw new Error(`Failed to fetch transactions: ${transRes.statusText}`);
      }
      
      const userContentType = userRes.headers.get("content-type");
      const transContentType = transRes.headers.get("content-type");

      if (!userContentType || !userContentType.includes("application/json")) {
        const text = await userRes.text();
        console.error("User response is not JSON:", text);
        throw new Error("User response is not JSON");
      }
      if (!transContentType || !transContentType.includes("application/json")) {
        const text = await transRes.text();
        console.error("Transactions response is not JSON:", text);
        throw new Error("Transactions response is not JSON");
      }
      
      const userData = await userRes.json();
      const transData = await transRes.json();
      
      if (userData) {
        setUser(userData);
      } else {
        // If user not found in mock DB but we have a session, sync them
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          console.log("User not found in mock DB, syncing...");
          const syncRes = await apiFetch('/api/auth/sync-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              email: session.user.email, 
              name: session.user.user_metadata?.name, 
              role: session.user.user_metadata?.role || 'user',
              uid: session.user.id
            })
          });
          const syncData = await syncRes.json();
          if (syncData.success) {
            setUser(syncData.user);
          }
        }
      }
      if (transData) setTransactions(transData);
    } catch (err) {
      console.error("Failed to fetch user data", err);
    }
  };

  const showNotify = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (authConfig.view === 'register') {
        const { data, error } = await supabase.auth.signUp({
          email: authForm.email,
          password: authForm.password,
          options: {
            data: { name: authForm.name, role: authConfig.role }
          }
        });
        if (error) throw error;
        showNotify("Successfully registered. Please check your email for verification.", 'success');
        setAuthConfig({ ...authConfig, view: 'verify_email' });
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: authForm.email,
          password: authForm.password
        });
        if (error) throw error;
        
        // After successful login, fetch the user profile from the API
        const res = await apiFetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            email: authForm.email, 
            password: authForm.password, 
            role: authConfig.role, 
            name: authForm.name,
            uid: data.user?.id
          })
        });
        const userData = await res.json();
        if (userData.success) {
          console.log("Logged in user:", userData.user);
          setUser(userData.user);
          showNotify(`Successfully logged in`, 'success');
          setAuthConfig({ ...authConfig, isOpen: false });
          setActiveTab(userData.user.role === 'admin' ? 'admin' : 'dashboard');
          setAuthForm({ name: '', email: '', password: '', otp: '', newPassword: '', oldPassword: '' });
        } else {
          showNotify(userData.message || "Authentication failed", 'error');
        }
      }
    } catch (err: any) {
      showNotify(err.message || "Authentication failed", 'error');
    }
  };

  const handleResendOTP = async () => {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: authForm.email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      showNotify("Verification code resent successfully.", 'success');
    } catch (err: any) {
      showNotify(err.message || "Failed to resend code", 'error');
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: authForm.email,
        token: authForm.otp,
        type: 'signup',
      });
      if (error) throw error;
      
      // Now sign the user in
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: authForm.email,
        password: authForm.password
      });
      if (loginError) throw loginError;

      // Now fetch user data
      const res = await apiFetch('/api/auth/sync-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: authForm.email, 
          name: authForm.name, 
          role: authConfig.role,
          uid: data.user?.id
        })
      });
      const userData = await res.json();
      if (userData.success) {
        setUser(userData.user);
        showNotify(`Successfully verified and logged in`, 'success');
        setAuthConfig({ ...authConfig, isOpen: false });
        setActiveTab(userData.user.role === 'admin' ? 'admin' : 'dashboard');
        setAuthForm({ name: '', email: '', password: '', otp: '', newPassword: '', oldPassword: '' });
      } else {
        showNotify(userData.message || "Login failed after verification", 'error');
      }
    } catch (err: any) {
      showNotify(err.message || "Verification failed", 'error');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authForm.email) {
      showNotify("Please enter your email", 'error');
      return;
    }
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: authForm.email,
        options: {
          shouldCreateUser: false,
        },
      });
      if (error) throw error;
      showNotify("Password reset code sent to your email", 'success');
      setAuthConfig({ ...authConfig, view: 'reset_password' });
    } catch (err: any) {
      showNotify(err.message || "Server error", 'error');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // 1. Verify the OTP
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: authForm.email,
        token: authForm.otp,
        type: 'recovery',
      });
      if (verifyError) throw verifyError;

      // 2. Update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: authForm.newPassword,
      });
      if (updateError) throw updateError;

      showNotify("Password reset successful.", 'success');
      setAuthConfig({ ...authConfig, view: 'login' });
      setAuthForm({ name: '', email: '', password: '', otp: '', newPassword: '', oldPassword: '' });
    } catch (err: any) {
      showNotify(err.message || "Reset failed", 'error');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const res = await apiFetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user.id, 
          oldPassword: authForm.oldPassword, 
          newPassword: authForm.newPassword 
        })
      });
      const data = await res.json();
      if (data.success) {
        showNotify(data.message, 'success');
        setAuthForm({ ...authForm, oldPassword: '', newPassword: '' });
      } else {
        showNotify(data.message, 'error');
      }
    } catch (err) {
      showNotify("Server error", 'error');
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setUser(null);
      setActiveTab('store');
      setAdminView('products');
      setDashboardView('overview');
      showNotify("Logged out successfully", 'success');
    }
  };

  const handleApproveSellRequest = async (productId: number) => {
    try {
      const res = await apiFetch('/api/admin/sell-request/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId })
      });
      const data = await res.json();
      if (data.success) {
        showNotify(data.message, 'success');
        fetchProducts();
        if (user) fetchUserData(user.id);
      } else {
        showNotify(data.message, 'error');
      }
    } catch (err) {
      showNotify("Server error", 'error');
    }
  };

  const handleRejectSellRequest = async (productId: number) => {
    try {
      const res = await apiFetch('/api/admin/sell-request/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId })
      });
      const data = await res.json();
      if (data.success) {
        showNotify(data.message, 'success');
        fetchProducts();
      } else {
        showNotify(data.message, 'error');
      }
    } catch (err) {
      showNotify("Server error", 'error');
    }
  };

  const calculateItemPrice = (item: CartItem) => {
    const unitPrice = item.product.price;
    const discount = item.product.discount || 0;
    const finalPrice = unitPrice * (1 - discount / 100);
    return (item.quantity / (item.product.quantity_unit || 1)) * finalPrice;
  };

  const calculateTotalCost = (items: CartItem[]) => {
    return items.reduce((sum, item) => sum + calculateItemPrice(item), 0);
  };

  const handleBuy = async (items: CartItem[]) => {
    if (!user) {
      openAuthModal('user');
      return;
    }

    if (paymentMode === 'manual' && !manualTransactionId.trim()) {
      showNotify("Please enter a transaction ID", "error");
      return;
    }

    if (paymentMode === 'manual' && !paymentScreenshotUrl) {
      showNotify("Please upload a payment screenshot", "error");
      return;
    }

    try {
      const res = await apiFetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user.id, 
          items: items.map(i => ({ productId: i.product.id, quantity: i.quantity })),
          manualTransactionId: paymentMode === 'manual' ? manualTransactionId : undefined,
          paymentScreenshotUrl: paymentMode === 'manual' ? paymentScreenshotUrl : undefined
        })
      });
      const data = await res.json();
      if (data.success) {
        showNotify(data.message, 'success');
        fetchProducts();
        fetchUserData(user.id);
        
        // Remove purchased items from cart and selection
        setCart(prev => prev.filter(c => !items.some(i => i.product.id === c.product.id)));
        setSelectedCartItemIds(prev => prev.filter(id => !items.some(i => i.product.id === id)));
        
        setIsCheckoutOpen(false);
        setIsCartOpen(false);
        setManualTransactionId(''); // Reset transaction ID
        setPaymentScreenshotUrl(''); // Reset screenshot
      } else {
        showNotify(data.message, 'error');
      }
    } catch (err) {
      showNotify("Transaction failed", 'error');
    }
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      if (paymentMode === 'manual' && prev.length > 0) {
        const existingPriceType = prev[0].product.price_type || 'BDT';
        const newPriceType = product.price_type || 'BDT';
        if (existingPriceType !== newPriceType) {
          showNotify(`Cannot mix ${existingPriceType} and ${newPriceType} items in cart`, "error");
          return prev;
        }
      }

      const unit = product.quantity_unit || 1;
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        if (existing.quantity + unit > product.quantity) {
          showNotify("Not enough stock available", "error");
          return prev;
        }
        return prev.map(item => 
          item.product.id === product.id ? { ...item, quantity: item.quantity + unit } : item
        );
      }
      return [...prev, { product, quantity: unit }];
    });
    setSelectedCartItemIds(prev => prev.includes(product.id) ? prev : [...prev, product.id]);
    showNotify(`${product.name} added to cart`, "success");
  };

  const updateCartQuantity = (productId: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const unit = item.product.quantity_unit || 1;
        const newQuantity = Math.max(unit, Math.min(item.quantity + (delta * unit), item.product.quantity));
        return { ...item, quantity: newQuantity };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
    setSelectedCartItemIds(prev => prev.filter(id => id !== productId));
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingProduct ? `/api/admin/products/${editingProduct.id}` : '/api/admin/products';
    const method = editingProduct ? 'PUT' : 'POST';
    
    try {
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showNotify(editingProduct ? "Product updated" : "Product added", 'success');
        setShowAddModal(false);
        setEditingProduct(null);
        setFormData({ 
          name: '', 
          description: '', 
          image_urls: [], 
          quantity: 0, 
          quantity_unit: 1, 
          price: 0, 
          price_type: 'BDT', 
          discount: 0, 
          payment_mode: paymentMode,
          category: '' 
        });
        setCategoryModified(false);
        fetchProducts();
      } else {
        showNotify(data.message || "Admin action failed", 'error');
      }
    } catch (err) {
      showNotify("Admin action failed", 'error');
    }
  };

  const deleteProduct = async (id: number) => {
    try {
      const res = await apiFetch(`/api/admin/products/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showNotify("Product deleted", 'success');
        fetchProducts();
      }
    } catch (err) {
      showNotify("Delete failed", 'error');
    } finally {
      setProductToDelete(null);
    }
  };

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category || 'Uncategorized')))];

  const filteredProducts = useMemo(() => products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || (product.category || 'Uncategorized') === selectedCategory;
    const matchesPaymentMode = product.payment_mode === paymentMode || (!product.payment_mode && paymentMode === 'coin');
    return matchesSearch && matchesCategory && product.status !== 'pending' && product.status !== 'rejected' && matchesPaymentMode;
  }), [products, searchQuery, selectedCategory, paymentMode]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-20 right-4 z-50 px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 ${
              notification.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
            }`}
          >
            {notification.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <span className="font-medium">{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navbar */}
      <nav className="glass-nav sticky top-0 z-40 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('store')}>
              <div className="bg-emerald-600 p-2 rounded-lg text-white">
                <Coins size={24} />
              </div>
              <span className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 hidden xs:block sm:block">HDEF Exchange</span>
            </div>

            <div className="hidden md:flex items-center gap-8">
              <button 
                onClick={() => setActiveTab('store')}
                className={`text-sm font-medium transition-colors ${activeTab === 'store' ? 'text-emerald-600' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Marketplace
              </button>
              {user && (
                <button 
                  onClick={() => {
                    setActiveTab(user.role === 'admin' ? 'admin' : 'dashboard');
                    if (user.role === 'admin') setAdminView('assets');
                    else setDashboardView('assets');
                  }}
                  className={`text-sm font-medium transition-colors ${(activeTab === 'dashboard' && dashboardView === 'assets') || (activeTab === 'admin' && adminView === 'assets') ? 'text-emerald-600' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  My Assets
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              <button 
                onClick={() => setIsCartOpen(true)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors relative group"
              >
                <ShoppingCart size={20} className="text-slate-600" />
                {cart.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-emerald-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {cart.reduce((sum, item) => sum + item.quantity, 0)}
                  </span>
                )}
                <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap hidden sm:block">
                  Cart
                </span>
              </button>
              {user ? (
                <>
                  <div className="hidden sm:flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full">
                    <Coins size={16} className="text-emerald-600" />
                    <span className="text-sm font-bold text-slate-700">{user.wallet_balance.toLocaleString()}</span>
                  </div>
                  <button 
                    onClick={() => setActiveTab(user.role === 'admin' ? 'admin' : 'dashboard')}
                    className="p-1.5 hover:bg-slate-100 rounded-full transition-colors relative group border border-transparent hover:border-slate-200 hidden sm:block"
                  >
                    {user.profile_image_url ? (
                      <img src={user.profile_image_url} alt="Profile" className="w-8 h-8 rounded-full object-cover border border-slate-200" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="p-1.5">
                        <UserIcon size={20} className="text-slate-600" />
                      </div>
                    )}
                    <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {user.role === 'admin' ? 'Admin Panel' : 'User Dashboard'}
                    </span>
                  </button>
                  <button 
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors md:hidden"
                  >
                    {isMobileMenuOpen ? <X size={20} className="text-slate-600" /> : <Menu size={20} className="text-slate-600" />}
                  </button>
                </>
              ) : (
                <button 
                  onClick={() => openAuthModal('user')}
                  className="btn-primary text-sm px-4 py-2"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden border-t border-slate-100 bg-white overflow-hidden"
            >
              <div className="px-4 py-4 space-y-4">
                <button 
                  onClick={() => {
                    setActiveTab('store');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`block w-full text-left px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === 'store' ? 'bg-emerald-50 text-emerald-600' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  Marketplace
                </button>
                {user && (
                  <>
                    <button 
                      onClick={() => {
                        setActiveTab(user.role === 'admin' ? 'admin' : 'dashboard');
                        if (user.role === 'admin') setAdminView('assets');
                        else setDashboardView('assets');
                        setIsMobileMenuOpen(false);
                      }}
                      className={`block w-full text-left px-4 py-2 rounded-xl text-sm font-medium transition-colors ${(activeTab === 'dashboard' && dashboardView === 'assets') || (activeTab === 'admin' && adminView === 'assets') ? 'bg-emerald-50 text-emerald-600' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      My Assets
                    </button>
                    <button 
                      onClick={() => {
                        setActiveTab(user.role === 'admin' ? 'admin' : 'dashboard');
                        setIsMobileMenuOpen(false);
                      }}
                      className={`block w-full text-left px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === 'dashboard' || activeTab === 'admin' ? 'bg-emerald-50 text-emerald-600' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      {user.role === 'admin' ? 'Admin Panel' : 'User Dashboard'}
                    </button>
                    <div className="px-4 py-2 flex items-center gap-2 bg-slate-50 rounded-xl">
                      <Coins size={16} className="text-emerald-600" />
                      <span className="text-sm font-bold text-slate-700">{user.wallet_balance.toLocaleString()} Coins</span>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Main Content */}
      <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
          </div>
        ) : (
          <>
            {activeTab === 'store' && (
              <div className="space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-center md:text-left">
                  <div className="flex flex-col items-center md:items-start">
                    <h1 className="text-3xl font-bold text-slate-900">Marketplace</h1>
                    <p className="text-slate-500 mt-1">Exchange your coins for premium digital assets.</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-slate-700"
                    >
                      {categories.map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="text" 
                        placeholder="Search products..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none w-full sm:w-64 transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredProducts.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-slate-500">
                      No products found matching your criteria.
                    </div>
                  ) : (
                    filteredProducts.map((product) => (
                      <motion.div 
                        layout
                        key={product.id}
                        className="bg-white rounded-2xl overflow-hidden card-shadow border border-slate-100 flex flex-col"
                      >
                      <div className="relative aspect-[4/3] overflow-hidden group">
                        <img 
                          src={product.image_urls[0]} 
                          alt={product.name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur px-2 py-1 rounded-lg text-[10px] font-bold text-slate-700 flex items-center gap-1 shadow-sm">
                          <Package size={12} />
                          {product.quantity} Left
                        </div>
                      </div>
                      <div className="p-5 flex flex-col flex-grow">
                        <div className="flex items-start justify-between mb-1 gap-2">
                          <h3 className="font-bold text-slate-900 text-lg leading-tight">{product.name}</h3>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md shrink-0">
                            {product.category || 'Uncategorized'}
                          </span>
                        </div>
                        <p className="text-slate-500 text-sm line-clamp-2 mb-4 flex-grow">{product.description}</p>
                        <div className="flex items-center justify-between mt-auto mb-3">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              {paymentMode === 'manual' ? (
                                <Wallet size={18} className="text-indigo-600" />
                              ) : (
                                <Coins size={18} className="text-emerald-600" />
                              )}
                              <span className={`font-bold ${product.discount && product.discount > 0 ? 'text-slate-400 line-through text-sm' : 'text-slate-900'}`}>
                                {product.price.toLocaleString()} {paymentMode === 'coin' ? 'Coins' : (product.price_type || 'BDT')}
                                {product.quantity_unit > 1 ? ` / ${product.quantity_unit} items` : ''}
                              </span>
                            </div>
                            {product.discount && product.discount > 0 && (
                              <span className="font-bold text-emerald-600 text-sm">
                                {(product.price * (1 - product.discount / 100)).toLocaleString()} {paymentMode === 'coin' ? 'Coins' : (product.price_type || 'BDT')}
                                <span className="text-[10px] font-bold text-white bg-rose-500 px-1.5 py-0.5 rounded ml-2">
                                  {product.discount}% OFF
                                </span>
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => {
                              if (!user) {
                                openAuthModal('user');
                                return;
                              }
                              addToCart(product);
                            }}
                            disabled={product.quantity <= 0}
                            className={`flex-1 py-2 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                              product.quantity > 0 
                              ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95' 
                              : 'bg-slate-50 text-slate-400 cursor-not-allowed'
                            }`}
                          >
                            <ShoppingCart size={16} />
                            Cart
                          </button>
                          <button 
                            onClick={() => {
                              if (!user) {
                                openAuthModal('user');
                                return;
                              }
                              setCheckoutItems([{ product, quantity: 1 }]);
                              setIsCheckoutOpen(true);
                            }}
                            disabled={product.quantity <= 0}
                            className={`flex-1 py-2 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                              product.quantity > 0 
                              ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-200 active:scale-95' 
                              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            }`}
                          >
                            <ShoppingBag size={16} />
                            {product.quantity > 0 ? 'Buy Now' : 'Sold Out'}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )))}
                </div>
              </div>
            )}

            {activeTab === 'dashboard' && user && (
              <div className="flex flex-col md:flex-row gap-8">
                {/* Sidebar */}
                <aside className="w-full md:w-64 shrink-0 space-y-2">
                  <div className="bg-white rounded-2xl p-6 border border-slate-100 card-shadow mb-6">
                    <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-4 overflow-hidden border-2 border-white shadow-sm">
                      {user.profile_image_url ? (
                        <img src={user.profile_image_url} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <UserIcon size={28} />
                      )}
                    </div>
                    <h3 className="font-bold text-slate-900 truncate">{user.full_name || user.name}</h3>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                  </div>
                  <nav className="flex overflow-x-auto gap-4 md:block md:space-y-6 pb-2 hide-scrollbar">
                    <div className="flex-shrink-0">
                      <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 hidden md:block">Dashboard</p>
                      <div className="flex md:block md:space-y-1 gap-2">
                        <button onClick={() => setDashboardView('overview')} className={`w-auto md:w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${dashboardView === 'overview' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                          <LayoutDashboard size={18} /> Overview
                        </button>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 hidden md:block">Marketplace</p>
                      <div className="flex md:block md:space-y-1 gap-2">
                        <button onClick={() => setDashboardView('assets')} className={`w-auto md:w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${dashboardView === 'assets' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                          <Wallet size={18} /> My Assets
                        </button>
                        <button onClick={() => setDashboardView('sell')} className={`w-auto md:w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${dashboardView === 'sell' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                          <Store size={18} /> Sell Product
                        </button>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 hidden md:block">Orders</p>
                      <div className="flex md:block md:space-y-1 gap-2">
                        <button onClick={() => setDashboardView('history')} className={`w-auto md:w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${dashboardView === 'history' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                          <History size={18} /> Transaction History
                        </button>
                        <button onClick={() => setDashboardView('tracking')} className={`w-auto md:w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${dashboardView === 'tracking' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                          <Search size={18} /> Track Order
                        </button>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 hidden md:block">Settings</p>
                      <div className="flex md:block md:space-y-1 gap-2">
                        <button onClick={() => setDashboardView('settings')} className={`w-auto md:w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${dashboardView === 'settings' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                          <Settings size={18} /> Settings
                        </button>
                        <button onClick={() => setDashboardView('security')} className={`w-auto md:w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${dashboardView === 'security' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                          <ShieldCheck size={18} /> Security
                        </button>
                      </div>
                    </div>
                    <div className="flex-shrink-0 flex items-center md:block">
                      <button onClick={handleLogout} className="w-auto md:w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors whitespace-nowrap md:mt-4">
                        <LogOut size={18} /> Sign Out
                      </button>
                    </div>
                  </nav>
                </aside>

                {/* Content */}
                <div className="flex-1 space-y-6">
                  {dashboardView === 'overview' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-emerald-600 rounded-3xl p-8 text-white shadow-xl shadow-emerald-200 relative overflow-hidden cursor-pointer" onClick={() => setDashboardView('assets')}>
                        <div className="relative z-10">
                          <p className="text-emerald-100 text-sm font-medium mb-1">Available Balance</p>
                          <h2 className="text-4xl font-bold flex items-center gap-3">
                            <Coins size={32} />
                            {user.wallet_balance.toLocaleString()}
                          </h2>
                          <div className="mt-8 flex gap-3">
                            <button className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
                              View Assets
                            </button>
                          </div>
                        </div>
                        <div className="absolute -right-8 -bottom-8 text-white/10 rotate-12">
                          <Wallet size={160} />
                        </div>
                      </div>
                      <div className="bg-white rounded-3xl border border-slate-100 p-8 card-shadow flex flex-col justify-center items-center text-center cursor-pointer hover:border-emerald-200 transition-all" onClick={() => setDashboardView('assets')}>
                        <ShoppingBag size={48} className="text-emerald-100 mb-4" />
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Total Owned</h3>
                        <p className="text-3xl font-black text-emerald-600">
                          {transactions.filter(t => {
                            if (t.status === 'cancelled') return false;
                            if (t.type === 'manual_buy' && t.status === 'pending_manual_payment') return false;
                            return t.type === 'buy' || t.type === 'manual_buy';
                          }).reduce((sum, t) => sum + t.quantity, 0)}
                        </p>
                      </div>
                    </div>
                  )}

                  {dashboardView === 'assets' && (
                    <MyAssetsView 
                      user={user!} 
                      transactions={transactions} 
                      products={products} 
                      transferForm={transferForm}
                      setTransferForm={setTransferForm}
                      showNotify={showNotify}
                      fetchUserData={fetchUserData}
                      apiFetch={apiFetch}
                    />
                  )}

                  {dashboardView === 'history' && (
                    <div className="bg-white rounded-3xl border border-slate-100 p-8 card-shadow">
                      <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <History size={20} className="text-emerald-600" />
                        Transaction History
                      </h3>
                      <div className="space-y-4">
                        {transactions.length === 0 ? (
                          <div className="text-center py-8 text-slate-400">
                            <History size={48} className="mx-auto mb-3 opacity-20" />
                            <p>No transactions yet.</p>
                          </div>
                        ) : (
                          transactions.map((t) => (
                            <div key={t.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
                              <div className="flex items-center gap-4">
                                <div className="bg-white p-2.5 rounded-xl shadow-sm">
                                  {t.type === 'manual_buy' ? <Wallet size={20} className="text-indigo-600" /> : 
                                   t.type === 'transfer_out' ? <ArrowUpRight size={20} className="text-rose-600" /> :
                                   t.type === 'transfer_in' ? <ArrowDownLeft size={20} className="text-emerald-600" /> :
                                   <ShoppingBag size={20} className="text-emerald-600" />}
                                </div>
                                <div>
                                  <p className="font-bold text-slate-900">
                                    {t.type === 'transfer_out' ? `Sent to ${t.recipient_name}` :
                                     t.type === 'transfer_in' ? `Received from ${t.sender_name}` :
                                     t.product_name}
                                  </p>
                                  <p className="text-xs text-slate-500">{new Date(t.timestamp).toLocaleDateString()} • ID: {t.tracking_id}</p>
                                  {t.manual_transaction_id && (
                                    <p className="text-xs text-indigo-600 font-mono mt-0.5">Trx: {t.manual_transaction_id}</p>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <p className={`font-bold flex items-center justify-end gap-1 ${
                                  t.type === 'transfer_out' ? 'text-rose-600' : 
                                  t.type === 'transfer_in' ? 'text-emerald-600' : 
                                  'text-slate-900'
                                }`}>
                                  {t.type === 'transfer_out' ? '-' : t.type === 'transfer_in' ? '+' : ''}
                                  {t.type === 'manual_buy' ? <Wallet size={12} className="text-indigo-600" /> : <Coins size={12} />}
                                  {t.amount.toLocaleString()}
                                </p>
                                <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md mt-1 inline-block ${
                                  t.status === 'delivered' || t.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                                  t.status === 'shipped' ? 'bg-blue-100 text-blue-700' :
                                  t.status === 'processing' ? 'bg-amber-100 text-amber-700' :
                                  t.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                  t.status === 'pending_manual_payment' ? 'bg-indigo-100 text-indigo-700' :
                                  t.status === 'cancelled' ? 'bg-rose-100 text-rose-700' :
                                  'bg-slate-100 text-slate-700'
                                }`}>{t.status.replace(/_/g, ' ')}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {dashboardView === 'sell' && user && (
                    <SellSection user={user} showNotify={showNotify} paymentMode={paymentMode} apiFetch={apiFetch} fetchProducts={fetchProducts} />
                  )}

                  {dashboardView === 'tracking' && (
                    <div className="bg-white rounded-3xl border border-slate-100 p-8 card-shadow">
                      <h3 className="text-xl font-bold text-slate-900 mb-6">Track Order</h3>
                      <div className="flex gap-2 mb-6">
                        <input 
                          type="text" 
                          placeholder="Enter Tracking ID (e.g., TRK-123456789)" 
                          value={trackingId}
                          onChange={(e) => setTrackingId(e.target.value)}
                          className="flex-1 px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none"
                        />
                        <button 
                          onClick={() => {
                            const searchId = trackingId.trim().toUpperCase();
                            const result = transactions.find(t => t.tracking_id === searchId);
                            setTrackingResult(result || null);
                            if (!result) showNotify("Order not found", "error");
                          }}
                          className="btn-primary"
                        >
                          Track
                        </button>
                      </div>
                      {trackingResult && (
                        <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                          <div className="flex justify-between items-center mb-4">
                            <h4 className="font-bold text-slate-900">{trackingResult.product_name}</h4>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                              trackingResult.status === 'delivered' || trackingResult.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                              trackingResult.status === 'shipped' ? 'bg-blue-100 text-blue-700' :
                              trackingResult.status === 'processing' ? 'bg-amber-100 text-amber-700' :
                              trackingResult.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                              trackingResult.status === 'pending_manual_payment' ? 'bg-indigo-100 text-indigo-700' :
                              trackingResult.status === 'cancelled' ? 'bg-rose-100 text-rose-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>{trackingResult.status.replace(/_/g, ' ')}</span>
                          </div>
                          <p className="text-sm text-slate-600">Tracking ID: {trackingResult.tracking_id}</p>
                          <p className="text-sm text-slate-600">Ordered on: {new Date(trackingResult.timestamp).toLocaleDateString()}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {dashboardView === 'settings' && (
                    <div className="space-y-6">
                      <div className="flex flex-col items-center md:items-start">
                        <h2 className="text-2xl font-bold text-slate-900">Profile Management</h2>
                        <p className="text-slate-500 mt-1">Update your personal information and profile picture.</p>
                      </div>
                      <ProfileView 
                        user={user} 
                        profileForm={profileForm} 
                        setProfileForm={setProfileForm} 
                        handleUpdateProfile={handleUpdateProfile} 
                      />
                    </div>
                  )}

                  {dashboardView === 'security' && (
                    <div className="space-y-6">
                      <div className="flex flex-col items-center md:items-start">
                        <h2 className="text-2xl font-bold text-slate-900">Security Settings</h2>
                        <p className="text-slate-500 mt-1">Manage your account security and password.</p>
                      </div>
                      <SecurityView 
                        authForm={authForm} 
                        setAuthForm={setAuthForm} 
                        handleChangePassword={handleChangePassword} 
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'admin' && user?.role === 'admin' && (
              <div className="flex flex-col md:flex-row gap-8">
                {/* Admin Sidebar */}
                <aside className="w-full md:w-64 shrink-0 space-y-2">
                  <div className="bg-slate-900 rounded-2xl p-6 shadow-xl mb-6 border border-slate-800">
                    <div className="w-16 h-16 bg-slate-800 text-emerald-400 rounded-full flex items-center justify-center mb-4 overflow-hidden border-2 border-slate-700 shadow-sm">
                      {user.profile_image_url ? (
                        <img src={user.profile_image_url} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <ShieldCheck size={28} />
                      )}
                    </div>
                    <h3 className="font-bold text-white truncate">{user.full_name || user.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">Admin</span>
                      <p className="text-xs text-slate-400 truncate">{user.email}</p>
                    </div>
                  </div>
                  <nav className="flex overflow-x-auto gap-4 md:block md:space-y-6 pb-2 hide-scrollbar">
                    <div className="flex-shrink-0">
                      <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 hidden md:block">Marketplace</p>
                      <div className="flex md:block md:space-y-1 gap-2">
                        <button onClick={() => setAdminView('products')} className={`w-auto md:w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${adminView === 'products' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                          <Package size={18} /> Manage Products
                        </button>
                        <button onClick={() => setAdminView('assets')} className={`w-auto md:w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${adminView === 'assets' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                          <Wallet size={18} /> My Assets
                        </button>
                        <button onClick={() => setAdminView('buy')} className={`w-auto md:w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${adminView === 'buy' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                          <ShoppingBag size={18} /> Pending Sell Requests
                        </button>
                      </div>
                    </div>

                    <div className="flex-shrink-0">
                      <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 hidden md:block">Order Management</p>
                      <div className="flex md:block md:space-y-1 gap-2">
                        <button onClick={() => setAdminView('orders')} className={`w-auto md:w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${adminView === 'orders' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                          <ShoppingBag size={18} /> Order Management
                        </button>
                        {paymentMode === 'manual' && (
                          <button onClick={() => setAdminView('payment-verification')} className={`w-auto md:w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${adminView === 'payment-verification' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                            <CheckCircle2 size={18} /> Payment Verification
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex-shrink-0">
                      <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 hidden md:block">Payments</p>
                      <div className="flex md:block md:space-y-1 gap-2">
                        {paymentMode === 'manual' && (
                          <button onClick={() => setAdminView('payment-methods')} className={`w-auto md:w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${adminView === 'payment-methods' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                            <CreditCard size={18} /> Payment Methods
                          </button>
                        )}
                        <button onClick={() => setAdminView('payment-settings')} className={`w-auto md:w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${adminView === 'payment-settings' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                          <Settings size={18} /> Payment Settings
                        </button>
                      </div>
                    </div>

                    <div className="flex-shrink-0">
                      <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 hidden md:block">Users & Analytics</p>
                      <div className="flex md:block md:space-y-1 gap-2">
                        <button onClick={() => setAdminView('users')} className={`w-auto md:w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${adminView === 'users' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                          <Users size={18} /> Manage Users
                        </button>
                        <button onClick={() => setAdminView('analytics')} className={`w-auto md:w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${adminView === 'analytics' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                          <LayoutDashboard size={18} /> Analytics
                        </button>
                      </div>
                    </div>

                    <div className="flex-shrink-0">
                      <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 hidden md:block">System</p>
                      <div className="flex md:block md:space-y-1 gap-2">
                        <button onClick={() => setAdminView('settings')} className={`w-auto md:w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${adminView === 'settings' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                          <Settings size={18} /> System Settings
                        </button>
                        <button onClick={() => setAdminView('security')} className={`w-auto md:w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${adminView === 'security' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                          <ShieldCheck size={18} /> Security
                        </button>
                      </div>
                    </div>

                    <div className="flex-shrink-0 flex items-center md:block">
                      <button onClick={handleLogout} className="w-auto md:w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors whitespace-nowrap md:mt-4">
                        <LogOut size={18} /> Sign Out
                      </button>
                    </div>
                  </nav>
                </aside>

                {/* Admin Content */}
                <div className="flex-1 space-y-6">
                  {adminView === 'products' && (
                    <>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-center sm:text-left">
                        <div className="flex flex-col items-center sm:items-start">
                          <h2 className="text-2xl font-bold text-slate-900">Products</h2>
                          <p className="text-slate-500 mt-1">Manage marketplace inventory.</p>
                        </div>
                        <button 
                          onClick={() => {
                            setEditingProduct(null);
                            setFormData({ name: '', description: '', image_urls: [], quantity: 0, quantity_unit: 1, price: 0, price_type: 'BDT', payment_mode: paymentMode, discount: 0, category: '' });
                            setCategoryModified(false);
                            setShowAddModal(true);
                          }}
                          className="btn-primary"
                        >
                          <Plus size={20} />
                          Add Product
                        </button>
                      </div>

                      <div className="bg-white rounded-3xl border border-slate-100 overflow-x-auto card-shadow">
                        <table className="w-full text-left min-w-[700px]">
                          <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Product</th>
                              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Stock</th>
                              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Price</th>
                              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {products.map((p) => (
                              <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-4">
                                    <img src={p.image_urls[0]} className="w-12 h-12 rounded-lg object-cover shrink-0" referrerPolicy="no-referrer" />
                                    <div>
                                      <p className="font-bold text-slate-900">{p.name}</p>
                                      <p className="text-xs text-slate-500 truncate max-w-[200px]">{p.description}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
                                    p.quantity > 5 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                  }`}>
                                    {p.quantity} Units
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex items-center justify-end gap-1 font-bold text-slate-900">
                                    {(p.payment_mode === 'manual' || (!p.payment_mode && paymentMode === 'manual')) ? (
                                      <Wallet size={14} className="text-indigo-600" />
                                    ) : (
                                      <Coins size={14} className="text-emerald-600" />
                                    )}
                                    {p.price.toLocaleString()} {(p.payment_mode === 'manual' || (!p.payment_mode && paymentMode === 'manual')) ? (p.price_type || 'BDT') : 'Coins'}
                                    {p.quantity_unit > 1 ? ` / ${p.quantity_unit}` : ''}
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button 
                                      onClick={() => {
                                        setEditingProduct(p);
                                        setFormData({
                                          name: p.name,
                                          description: p.description,
                                          image_urls: p.image_urls,
                                          quantity: p.quantity,
                                          quantity_unit: p.quantity_unit || 1,
                                          price: p.price,
                                          price_type: p.price_type || 'BDT',
                                          payment_mode: p.payment_mode || 'coin',
                                          discount: p.discount || 0,
                                          category: p.category || 'Uncategorized'
                                        });
                                        setCategoryModified(true);
                                        setShowAddModal(true);
                                      }}
                                      className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                    >
                                      <Edit size={18} />
                                    </button>
                                    <button 
                                      onClick={() => setProductToDelete(p.id)}
                                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                    >
                                      <Trash2 size={18} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                  {adminView === 'buy' && (
                    <div className="bg-white rounded-3xl border border-slate-100 p-8 card-shadow">
                      <h3 className="text-xl font-bold text-slate-900 mb-6">Pending Sell Requests</h3>
                      <div className="space-y-4">
                        {products.filter(p => p.status === 'pending').length === 0 ? (
                          <p className="text-slate-500">No pending sell requests.</p>
                        ) : (
                          products.filter(p => p.status === 'pending').map(p => (
                            <div key={p.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                              <div>
                                <p className="font-bold text-slate-900">{p.name}</p>
                                <p className="text-xs text-slate-500">Price: {p.price} {p.payment_mode === 'manual' ? (p.price_type || 'BDT') : 'Coins'} {p.quantity_unit > 1 ? `(per ${p.quantity_unit})` : ''} | Qty: {p.quantity}</p>
                              </div>
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => handleApproveSellRequest(p.id)}
                                  className="btn-primary bg-emerald-600"
                                >
                                  Approve
                                </button>
                                <button 
                                  onClick={() => handleRejectSellRequest(p.id)}
                                  className="btn-secondary bg-rose-600 text-white"
                                >
                                  Reject
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {adminView === 'orders' && (
                    <div className="bg-white rounded-3xl border border-slate-100 overflow-x-auto card-shadow">
                      <h3 className="text-xl font-bold text-slate-900 p-8 border-b border-slate-100">Order Management</h3>
                      <table className="w-full text-left min-w-[800px]">
                        <thead className="bg-slate-50 border-b border-slate-100">
                          <tr>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Order ID</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">User</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Product</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Qty</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Payment Info</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {allTransactions.filter(t => t.type === 'buy' || t.type === 'manual_buy').map((t) => (
                            <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4 font-mono text-xs text-slate-500">
                                <div className="font-bold text-slate-900 mb-1">{t.tracking_id}</div>
                                #{t.id.toString().padStart(8, '0')}
                              </td>
                              <td className="px-6 py-4 font-bold text-slate-900">{t.user_name}</td>
                              <td className="px-6 py-4 text-slate-600">{t.product_name}</td>
                              <td className="px-6 py-4 text-center text-slate-600">{t.quantity}</td>
                              <td className="px-6 py-4 text-slate-500 text-sm">{new Date(t.timestamp).toLocaleDateString()}</td>
                              <td className="px-6 py-4 text-sm">
                                {t.type === 'manual_buy' ? (
                                  <div className="flex flex-col">
                                    <span className="text-indigo-600 font-bold text-xs uppercase tracking-wider">Manual</span>
                                    {t.manual_transaction_id && (
                                      <span className="text-slate-500 font-mono text-xs mt-1">Trx: {t.manual_transaction_id}</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-emerald-600 font-bold text-xs uppercase tracking-wider">Coin</span>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                <select 
                                  value={t.status || 'pending'}
                                  onChange={(e) => handleUpdateOrderStatus(t.id, e.target.value)}
                                  className="text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border border-slate-200 bg-white focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                                >
                                  <option value="pending">Pending</option>
                                  <option value="pending_manual_payment">Pending Manual Payment</option>
                                  <option value="processing">Processing</option>
                                  <option value="shipped">Shipped</option>
                                  <option value="delivered">Delivered</option>
                                  <option value="completed">Completed</option>
                                  <option value="cancelled">Cancelled</option>
                                </select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {adminView === 'users' && (
                    <UserManagementView showNotify={showNotify} apiFetch={apiFetch} />
                  )}
                  {adminView === 'analytics' && (
                    <AnalyticsView products={products} transactions={transactions} />
                  )}
                  {adminView === 'payment-methods' && (
                    <PaymentMethodsView paymentMethods={paymentMethods} fetchPaymentMethods={fetchPaymentMethods} showNotify={showNotify} apiFetch={apiFetch} />
                  )}
                  {adminView === 'payment-verification' && (
                    <PaymentVerificationView transactions={allTransactions} fetchTransactions={fetchAllTransactions} showNotify={showNotify} apiFetch={apiFetch} />
                  )}
                  {adminView === 'assets' && (
                    <MyAssetsView 
                      user={user!} 
                      transactions={transactions} 
                      products={products} 
                      transferForm={transferForm}
                      setTransferForm={setTransferForm}
                      showNotify={showNotify}
                      fetchUserData={fetchUserData}
                      apiFetch={apiFetch}
                    />
                  )}
                  {adminView === 'payment-settings' && (
                    <div className="space-y-6">
                      <div className="flex flex-col items-center md:items-start">
                        <h2 className="text-2xl font-bold text-slate-900">Payment Settings</h2>
                        <p className="text-slate-500 mt-1">Manage global payment configurations.</p>
                      </div>
                      
                      <div className="bg-white rounded-3xl border border-slate-100 p-8 card-shadow">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                            <Settings size={24} />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-slate-900">Payment Mode Control</h3>
                            <p className="text-slate-500 text-sm">Toggle between Coin System and Manual Payment System.</p>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4">
                          <button
                            onClick={async () => {
                              try {
                                const res = await apiFetch('/api/admin/settings/payment-mode', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ mode: 'coin' })
                                });
                                const data = await res.json();
                                if (data.success) {
                                  setPaymentMode('coin');
                                  showNotify("Payment mode set to Coin System", 'success');
                                }
                              } catch (err) {
                                showNotify("Failed to update payment mode", 'error');
                              }
                            }}
                            className={`flex-1 p-6 rounded-2xl border-2 transition-all text-left ${
                              paymentMode === 'coin' 
                              ? 'border-emerald-500 bg-emerald-50' 
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-4">
                              <div className={`p-3 rounded-xl ${paymentMode === 'coin' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                <Coins size={24} />
                              </div>
                              {paymentMode === 'coin' && (
                                <span className="px-3 py-1 bg-emerald-500 text-white text-xs font-bold rounded-full">Active</span>
                              )}
                            </div>
                            <h4 className={`text-lg font-bold mb-2 ${paymentMode === 'coin' ? 'text-emerald-900' : 'text-slate-700'}`}>Coin System</h4>
                            <p className={`text-sm ${paymentMode === 'coin' ? 'text-emerald-700' : 'text-slate-500'}`}>
                              Users pay with internal Coin Currency. Wallet balances are deducted automatically.
                            </p>
                          </button>

                          <button
                            onClick={async () => {
                              try {
                                const res = await apiFetch('/api/admin/settings/payment-mode', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ mode: 'manual' })
                                });
                                const data = await res.json();
                                if (data.success) {
                                  setPaymentMode('manual');
                                  showNotify("Payment mode set to Manual Payment", 'success');
                                }
                              } catch (err) {
                                showNotify("Failed to update payment mode", 'error');
                              }
                            }}
                            className={`flex-1 p-6 rounded-2xl border-2 transition-all text-left ${
                              paymentMode === 'manual' 
                              ? 'border-indigo-500 bg-indigo-50' 
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-4">
                              <div className={`p-3 rounded-xl ${paymentMode === 'manual' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                                <Wallet size={24} />
                              </div>
                              {paymentMode === 'manual' && (
                                <span className="px-3 py-1 bg-indigo-500 text-white text-xs font-bold rounded-full">Active</span>
                              )}
                            </div>
                            <h4 className={`text-lg font-bold mb-2 ${paymentMode === 'manual' ? 'text-indigo-900' : 'text-slate-700'}`}>Manual Payment</h4>
                            <p className={`text-sm ${paymentMode === 'manual' ? 'text-indigo-700' : 'text-slate-500'}`}>
                              Coin payments are disabled. Orders are placed as pending for manual payment processing.
                            </p>
                          </button>
                        </div>

                        {paymentMode === 'manual' && (
                          <div className="mt-8">
                            <h4 className="text-lg font-bold text-slate-900 mb-4">Enabled Payment Methods</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {paymentMethods.map(method => (
                                <label key={method.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                                  <span className="font-medium text-slate-700">{method.name}</span>
                                  <input 
                                    type="checkbox"
                                    checked={enabledPaymentMethods.includes(method.id)}
                                    onChange={async (e) => {
                                      const isEnabled = e.target.checked;
                                      const newMethods = isEnabled 
                                        ? [...enabledPaymentMethods, method.id]
                                        : enabledPaymentMethods.filter(id => id !== method.id);
                                      
                                      setEnabledPaymentMethods(newMethods);
                                      
                                      try {
                                        const res = await apiFetch('/api/admin/settings/enabled-payment-methods', {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ methods: newMethods })
                                        });
                                        const data = await res.json();
                                        if (!data.success) {
                                          setEnabledPaymentMethods(enabledPaymentMethods);
                                          showNotify(data.message || "Failed to update payment methods", 'error');
                                        }
                                      } catch (err) {
                                        setEnabledPaymentMethods(enabledPaymentMethods);
                                        showNotify("Failed to update payment methods", 'error');
                                      }
                                    }}
                                    className="w-5 h-5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                                  />
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {adminView === 'settings' && (
                    <div className="space-y-6">
                      <div className="flex flex-col items-center md:items-start">
                        <h2 className="text-2xl font-bold text-slate-900">System Settings</h2>
                        <p className="text-slate-500 mt-1">Manage global system configurations.</p>
                      </div>
                      
                      <div className="flex flex-col items-center md:items-start mt-8">
                        <h2 className="text-2xl font-bold text-slate-900">Admin Profile Management</h2>
                        <p className="text-slate-500 mt-1">Update your administrative profile information.</p>
                      </div>
                      <ProfileView 
                        user={user} 
                        profileForm={profileForm} 
                        setProfileForm={setProfileForm} 
                        handleUpdateProfile={handleUpdateProfile} 
                      />
                    </div>
                  )}

                  {adminView === 'security' && (
                    <div className="space-y-6">
                      <div className="flex flex-col items-center md:items-start">
                        <h2 className="text-2xl font-bold text-slate-900">Admin Security</h2>
                        <p className="text-slate-500 mt-1">Manage your administrator account security.</p>
                      </div>
                      <SecurityView 
                        authForm={authForm} 
                        setAuthForm={setAuthForm} 
                        handleChangePassword={handleChangePassword} 
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      {activeTab === 'store' && (
        <footer className="bg-white border-t border-slate-100 py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8 text-center md:text-left">
              <div className="col-span-2 flex flex-col items-center md:items-start">
                <div className="flex items-center justify-center md:justify-start gap-2 mb-4">
                  <div className="bg-emerald-600 p-1.5 rounded text-white">
                    <Coins size={18} />
                  </div>
                  <span className="text-lg font-bold tracking-tight text-slate-900">HDEF Exchange</span>
                </div>
                <p className="text-slate-500 text-sm max-w-sm">
                  The world's leading marketplace for digital assets and virtual currency exchange. 
                  Secure, fast, and reliable transactions for all users.
                </p>
              </div>
              <div className="flex flex-col items-center md:items-start">
                <h4 className="font-bold text-slate-900 mb-4">Marketplace</h4>
                <ul className="space-y-2 text-sm text-slate-500">
                  <li className="hover:text-emerald-600 cursor-pointer">Browse All</li>
                  <li className="hover:text-emerald-600 cursor-pointer">Featured Assets</li>
                  <li className="hover:text-emerald-600 cursor-pointer">New Arrivals</li>
                </ul>
              </div>
              <div className="flex flex-col items-center md:items-start">
                <h4 className="font-bold text-slate-900 mb-4">Support</h4>
                <ul className="space-y-2 text-sm text-slate-500">
                  <li className="hover:text-emerald-600 cursor-pointer">Help Center</li>
                  <li className="hover:text-emerald-600 cursor-pointer">Terms of Service</li>
                  <li className="hover:text-emerald-600 cursor-pointer">Privacy Policy</li>
                </ul>
              </div>
            </div>
            <div className="pt-8 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
              <p className="text-slate-400 text-xs">© 2026 HDEF Exchange. All rights reserved.</p>
              <div className="flex items-center gap-6">
                <button 
                  onClick={() => {
                    if (user?.role === 'admin') setActiveTab('admin');
                    else openAuthModal('admin');
                  }}
                  className="flex items-center gap-2 text-slate-400 hover:text-emerald-600 transition-colors group"
                >
                  <ShieldCheck size={16} />
                  <span className="text-xs font-bold uppercase tracking-widest">Administrator</span>
                </button>
              </div>
            </div>
          </div>
        </footer>
      )}

      {/* Auth Modal */}
      <AnimatePresence>
        {authConfig.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAuthConfig({ ...authConfig, isOpen: false })}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden p-6 sm:p-8"
            >
              <button 
                onClick={() => setAuthConfig({ ...authConfig, isOpen: false })} 
                className="absolute top-4 right-4 p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
              
              <div className="text-center mb-8">
                <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 ${authConfig.role === 'admin' ? 'bg-slate-900 text-emerald-400' : 'bg-emerald-100 text-emerald-600'}`}>
                  {authConfig.role === 'admin' ? <ShieldCheck size={32} /> : <UserIcon size={32} />}
                </div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {authConfig.view === 'forgot_password' ? 'Reset Password' : (authConfig.role === 'admin' ? 'Admin Portal' : 'Welcome Back')}
                </h2>
                <p className="text-slate-500 mt-1">
                  {authConfig.view === 'forgot_password' ? 'Enter your email to receive a reset link' : (authConfig.view === 'login' ? 'Sign in to your account' : 'Create a new account')}
                </p>
              </div>

              {authConfig.view === 'forgot_password' ? (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        required
                        type="email" 
                        className="input-field !pl-10"
                        placeholder="user@example.com"
                        value={authForm.email}
                        onChange={(e) => setAuthForm({...authForm, email: e.target.value})}
                      />
                    </div>
                  </div>
                  <button type="submit" className="w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all active:scale-95 bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200">
                    Send Reset Code
                  </button>
                  <div className="mt-6 text-center">
                    <button 
                      type="button"
                      onClick={() => {
                        setAuthConfig({ ...authConfig, view: 'login' });
                        setAuthForm({ ...authForm, email: '', password: '' });
                      }}
                      className="text-sm text-slate-500 hover:text-emerald-600 font-medium transition-colors"
                    >
                      Back to Sign In
                    </button>
                  </div>
                </form>
              ) : authConfig.view === 'verify_email' ? (
                <form onSubmit={handleVerifyOTP} className="space-y-4">
                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 text-sm text-emerald-800 mb-4">
                    We've sent a 6-digit verification code to <b>{authForm.email}</b>. Please enter it below.
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Verification Code</label>
                    <input 
                      required
                      type="text" 
                      maxLength={8}
                      className="input-field text-center text-2xl tracking-[1em] font-mono"
                      placeholder="00000000"
                      value={authForm.otp}
                      onChange={(e) => setAuthForm({...authForm, otp: e.target.value.replace(/\D/g, '')})}
                    />
                  </div>
                  <button type="submit" className="w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all active:scale-95 bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200">
                    Verify Email
                  </button>
                  <div className="mt-6 text-center">
                    <button 
                      type="button"
                      onClick={handleResendOTP}
                      className="text-sm text-emerald-600 hover:text-emerald-700 font-medium transition-colors mr-4"
                    >
                      Resend Code
                    </button>
                    <button 
                      type="button"
                      onClick={() => setAuthConfig({ ...authConfig, view: 'login' })}
                      className="text-sm text-slate-500 hover:text-emerald-600 font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : authConfig.view === 'reset_password' ? (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Verification Code</label>
                    <input 
                      required
                      type="text" 
                      maxLength={6}
                      className="input-field text-center font-mono"
                      placeholder="000000"
                      value={authForm.otp}
                      onChange={(e) => setAuthForm({...authForm, otp: e.target.value.replace(/\D/g, '')})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        required
                        type="password" 
                        className="input-field !pl-10"
                        placeholder="••••••••"
                        value={authForm.newPassword}
                        onChange={(e) => setAuthForm({...authForm, newPassword: e.target.value})}
                      />
                    </div>
                  </div>
                  <button type="submit" className="w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all active:scale-95 bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200">
                    Reset Password
                  </button>
                </form>
              ) : (
                <form onSubmit={handleAuthSubmit} className="space-y-4">
                  {authConfig.view === 'register' && (
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Full Name</label>
                      <div className="relative">
                        <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                          required
                          type="text" 
                          className="input-field !pl-10"
                          placeholder="John Doe"
                          value={authForm.name}
                          onChange={(e) => setAuthForm({...authForm, name: e.target.value})}
                        />
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Email / Username</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        required
                        type="text" 
                        className="input-field !pl-10"
                        placeholder="user@example.com"
                        value={authForm.email}
                        onChange={(e) => setAuthForm({...authForm, email: e.target.value})}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-sm font-bold text-slate-700">Password</label>
                      {authConfig.view === 'login' && (
                        <button 
                          type="button"
                          onClick={() => setAuthConfig({ ...authConfig, view: 'forgot_password' })}
                          className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                        >
                          Forgot Password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        required
                        type={showPassword ? "text" : "password"} 
                        className="input-field !pl-10 !pr-10"
                        placeholder="••••••••"
                        value={authForm.password}
                        onChange={(e) => setAuthForm({...authForm, password: e.target.value})}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  
                  <button type="submit" className={`w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all active:scale-95 ${authConfig.role === 'admin' ? 'bg-slate-900 hover:bg-slate-800 shadow-slate-200' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'}`}>
                    {authConfig.view === 'login' ? 'Sign In' : 'Create Account'}
                  </button>

                  {authConfig.view === 'login' && (
                    <div className="mt-4 text-center">
                      <button 
                        type="button" 
                        onClick={() => setAuthConfig({...authConfig, view: 'forgot_password'})}
                        className="text-xs text-emerald-600 hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}
                </form>
              )}

              {authConfig.view !== 'forgot_password' && (
                <div className="mt-6 text-center">
                  <button 
                    onClick={() => {
                      const newView = authConfig.view === 'login' ? 'register' : 'login';
                      setAuthConfig({ ...authConfig, view: newView });
                      if (newView === 'register') {
                        setAuthForm({ name: '', email: '', password: '' });
                      } else {
                        setAuthForm({ name: '', email: authConfig.role, password: authConfig.role });
                      }
                    }}
                    className="text-sm text-slate-500 hover:text-emerald-600 font-medium transition-colors"
                  >
                    {authConfig.view === 'login' ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h3 className="text-xl font-bold text-slate-900">
                  {editingProduct ? 'Edit Product' : 'Add New Product'}
                </h3>
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleAdminSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Product Name</label>
                    <input 
                      required
                      type="text" 
                      className="input-field"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Category</label>
                    <input 
                      required
                      type="text" 
                      className="input-field"
                      value={formData.category}
                      onChange={(e) => {
                        setFormData({...formData, category: e.target.value});
                        setCategoryModified(true);
                      }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Payment Mode</label>
                    <select 
                      className="input-field"
                      value={formData.payment_mode}
                      onChange={(e) => setFormData({...formData, payment_mode: e.target.value as 'coin' | 'manual'})}
                    >
                      <option value="coin">Coin Payment</option>
                      <option value="manual">Manual Payment</option>
                    </select>
                  </div>
                  {formData.payment_mode === 'manual' && (
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Price Type</label>
                      <select 
                        className="input-field"
                        value={formData.price_type}
                        onChange={(e) => setFormData({...formData, price_type: e.target.value as 'BDT' | 'USDT'})}
                      >
                        <option value="BDT">BDT Price</option>
                        <option value="USDT">USDT Price</option>
                      </select>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Description</label>
                  <textarea 
                    required
                    className="input-field min-h-[100px]"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Product Images</label>
                  <ImageUpload 
                    images={formData.image_urls} 
                    onChange={(imgs) => setFormData({...formData, image_urls: imgs})} 
                    multiple={true}
                    maxImages={5}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Stock Quantity</label>
                    <input 
                      required
                      type="number" 
                      className="input-field"
                      value={formData.quantity || 0}
                      onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Quantity per Unit</label>
                    <input 
                      required
                      type="number" 
                      min="1"
                      className="input-field"
                      value={formData.quantity_unit || 1}
                      onChange={(e) => setFormData({...formData, quantity_unit: parseInt(e.target.value) || 1})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">
                      Price ({formData.payment_mode === 'coin' ? 'Coins' : formData.price_type})
                    </label>
                    <input 
                      required
                      type="number" 
                      className="input-field"
                      value={formData.price || 0}
                      onChange={(e) => setFormData({...formData, price: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Discount (%)</label>
                    <input 
                      type="number" 
                      min="0"
                      max="100"
                      className="input-field"
                      value={formData.discount || 0}
                      onChange={(e) => setFormData({...formData, discount: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary flex-1">Cancel</button>
                  <button type="submit" className="btn-primary flex-1">
                    {editingProduct ? 'Update Product' : 'Create Product'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cart Sidebar */}
      <AnimatePresence>
        {isCartOpen && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3">
                  <ShoppingCart size={24} className="text-emerald-600" />
                  <h3 className="text-xl font-bold text-slate-900">Your Cart</h3>
                </div>
                <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex-grow overflow-y-auto p-6 space-y-4">
                {cart.length === 0 ? (
                  <div className="text-center text-slate-500 mt-12">
                    <ShoppingCart size={48} className="mx-auto mb-4 opacity-20" />
                    <p>Your cart is empty.</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 px-1 mb-2">
                      <input 
                        type="checkbox"
                        checked={cart.length > 0 && selectedCartItemIds.length === cart.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCartItemIds(cart.map(item => item.product.id));
                          } else {
                            setSelectedCartItemIds([]);
                          }
                        }}
                        className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className="text-sm font-medium text-slate-700">Select All</span>
                    </div>
                    {cart.map((item) => (
                      <div key={item.product.id} className="flex gap-4 items-center bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
                        <input 
                          type="checkbox"
                          checked={selectedCartItemIds.includes(item.product.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCartItemIds(prev => [...prev, item.product.id]);
                            } else {
                              setSelectedCartItemIds(prev => prev.filter(id => id !== item.product.id));
                            }
                          }}
                          className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        <img src={item.product.image_urls[0]} alt={item.product.name} className="w-16 h-16 object-cover rounded-xl" referrerPolicy="no-referrer" />
                        <div className="flex-grow">
                          <h4 className="font-bold text-slate-900 text-sm line-clamp-1">{item.product.name}</h4>
                          <div className={`flex items-center gap-1 font-bold text-sm mt-1 ${paymentMode === 'manual' ? 'text-indigo-600' : 'text-emerald-600'}`}>
                            {paymentMode === 'manual' ? <Wallet size={14} /> : <Coins size={14} />}
                            {calculateItemPrice(item).toLocaleString()} {paymentMode === 'coin' ? 'Coins' : (item.product.price_type || 'BDT')}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-1">
                          <button 
                            onClick={() => updateCartQuantity(item.product.id, -1)}
                            className="p-1 hover:bg-white rounded-md shadow-sm text-slate-600"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-6 text-center font-bold text-sm">{item.quantity}</span>
                          <button 
                            onClick={() => updateCartQuantity(item.product.id, 1)}
                            className="p-1 hover:bg-white rounded-md shadow-sm text-slate-600"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <button 
                          onClick={() => removeFromCart(item.product.id)}
                          className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-6 border-t border-slate-100 bg-slate-50">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-slate-500 font-medium">Selected Total ({selectedCartItemIds.length} items)</span>
                    <div className="flex items-center gap-1.5 text-xl font-bold text-slate-900">
                      {paymentMode === 'manual' ? (
                        <Wallet size={20} className="text-indigo-600" />
                      ) : (
                        <Coins size={20} className="text-emerald-600" />
                      )}
                      {calculateTotalCost(cart.filter(item => selectedCartItemIds.includes(item.product.id))).toLocaleString()} {paymentMode === 'coin' ? 'Coins' : (cart.find(item => selectedCartItemIds.includes(item.product.id))?.product.price_type || 'BDT')}
                    </div>
                  </div>
                  <button 
                    disabled={selectedCartItemIds.length === 0}
                    onClick={() => {
                      setCheckoutItems(cart.filter(item => selectedCartItemIds.includes(item.product.id)));
                      setIsCheckoutOpen(true);
                    }}
                    className={`w-full py-3 text-lg rounded-xl font-bold text-white shadow-lg transition-all ${selectedCartItemIds.length === 0 ? 'bg-slate-300 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200 active:scale-95'}`}
                  >
                    Proceed to Checkout
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Checkout Modal */}
      <AnimatePresence>
        {isCheckoutOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCheckoutOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h3 className="text-xl font-bold text-slate-900">Confirm Purchase</h3>
                <button onClick={() => setIsCheckoutOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
                  <h4 className="font-bold text-slate-700 text-sm uppercase tracking-wider mb-2">Order Summary</h4>
                  {checkoutItems.map(item => (
                    <div key={item.product.id} className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-md p-0.5">
                          <button 
                            onClick={() => {
                              setCheckoutItems(prev => prev.map(i => 
                                i.product.id === item.product.id 
                                ? { ...i, quantity: Math.max(1, i.quantity - 1) } 
                                : i
                              ));
                            }}
                            className="p-0.5 hover:bg-slate-100 rounded text-slate-600"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="w-4 text-center font-bold text-xs">{item.quantity}</span>
                          <button 
                            onClick={() => {
                              setCheckoutItems(prev => prev.map(i => 
                                i.product.id === item.product.id 
                                ? { ...i, quantity: Math.min(i.product.quantity, i.quantity + 1) } 
                                : i
                              ));
                            }}
                            className="p-0.5 hover:bg-slate-100 rounded text-slate-600"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                        <span className="text-slate-600 line-clamp-1">{item.product.name}</span>
                      </div>
                      <span className="font-medium text-slate-900">
                        {calculateItemPrice(item).toLocaleString()} {paymentMode === 'coin' ? 'Coins' : (item.product.price_type || 'BDT')}
                      </span>
                    </div>
                  ))}
                  <div className="pt-3 border-t border-slate-200 flex justify-between items-center font-bold">
                    <span>Total Cost</span>
                    <div className={`flex items-center gap-1 ${paymentMode === 'manual' ? 'text-indigo-600' : 'text-emerald-600'}`}>
                      {paymentMode === 'manual' ? <Wallet size={16} /> : <Coins size={16} />}
                      {calculateTotalCost(checkoutItems).toLocaleString()} {paymentMode === 'coin' ? 'Coins' : (checkoutItems[0]?.product.price_type || 'BDT')}
                    </div>
                  </div>
                </div>

                {user && paymentMode === 'coin' && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Current Balance</span>
                      <span className="font-bold text-slate-900">{user.wallet_balance.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Coin Spend</span>
                      <span className="font-bold text-rose-500">-{calculateTotalCost(checkoutItems).toLocaleString()}</span>
                    </div>
                    <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                      <span className="font-bold text-slate-700">Remaining Balance</span>
                      <span className={`font-bold ${user.wallet_balance - calculateTotalCost(checkoutItems) < 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                        {(user.wallet_balance - calculateTotalCost(checkoutItems)).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}

                {user && paymentMode === 'manual' && (
                  <div className="bg-indigo-50 p-4 rounded-2xl space-y-4 text-indigo-800 text-sm">
                    <div className="flex items-start gap-2">
                      <Wallet size={18} className="shrink-0 mt-0.5" />
                      <div>
                        <strong>Manual Payment Active</strong>
                        <p className="mt-1 opacity-80">Coin payments are currently disabled. Please transfer the total amount to one of our payment methods below and enter the Transaction ID.</p>
                      </div>
                    </div>
                    
                    {paymentMethods.length > 0 && (
                      <div className="space-y-2">
                        <p className="font-bold text-xs uppercase tracking-wider text-indigo-900">Available Methods:</p>
                        {paymentMethods.map((m: any) => (
                          <div key={m.id} className="bg-white/50 p-3 rounded-xl border border-indigo-100">
                            <p className="font-bold text-indigo-900">{m.name}: {m.number}</p>
                            <p className="text-[10px] opacity-70">{m.instructions}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-indigo-900 uppercase tracking-wider mb-1">Payment Screenshot</label>
                      <ImageUpload 
                        images={paymentScreenshotUrl ? [paymentScreenshotUrl] : []} 
                        onChange={(imgs) => setPaymentScreenshotUrl(imgs[0] || '')} 
                        multiple={false}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-indigo-900 uppercase tracking-wider mb-1">Transaction ID</label>
                      <input 
                        type="text" 
                        value={manualTransactionId}
                        onChange={(e) => setManualTransactionId(e.target.value)}
                        placeholder="e.g. 8N2K9L4P"
                        className="w-full px-3 py-2 rounded-lg border border-indigo-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                      />
                    </div>
                  </div>
                )}

                <button 
                  onClick={() => handleBuy(checkoutItems)}
                  disabled={!user || (paymentMode === 'coin' && user.wallet_balance < calculateTotalCost(checkoutItems)) || (paymentMode === 'manual' && !manualTransactionId.trim())}
                  className={`w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all flex justify-center items-center gap-2 ${
                    !user || (paymentMode === 'coin' && user.wallet_balance < calculateTotalCost(checkoutItems)) || (paymentMode === 'manual' && !manualTransactionId.trim())
                    ? 'bg-slate-300 cursor-not-allowed'
                    : paymentMode === 'manual' ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 active:scale-95' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200 active:scale-95'
                  }`}
                >
                  <ShoppingBag size={20} />
                  {paymentMode === 'manual' ? 'Place Order (Manual Payment)' : 'Confirm Purchase'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {productToDelete !== null && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-slate-100 text-center"
            >
              <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={40} />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Delete Product?</h3>
              <p className="text-slate-500 mb-8">Are you sure you want to delete this product? This action cannot be undone.</p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setProductToDelete(null)}
                  className="flex-1 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
                >
                  No, Cancel
                </button>
                <button 
                  onClick={() => deleteProduct(productToDelete)}
                  className="flex-1 py-3 rounded-xl font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-200 transition-all"
                >
                  Yes, Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
};

export default App;
