import { useState } from 'react';
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Zap,
  Loader2,
  CheckCircle2,
  XCircle,
  Copy,
  ArrowLeft,
  Package,
  Settings,
  Star,
  Palette,
  Shirt,
  Terminal,
} from 'lucide-react';

const PRODUCTS = [
  {
    id: 1,
    name: 'Cyber Widget',
    price: 5000,
    priceCkb: '0.00005',
    desc: 'High-performance digital widget for automated workflows',
    color: 'from-fiber-500 to-fiber-700',
    badge: 'Popular',
  },
  {
    id: 2,
    name: 'Nervos T-Shirt',
    price: 100000,
    priceCkb: '0.001',
    desc: 'Limited edition CKB merchandise — premium cotton',
    color: 'from-gray-700 to-gray-900',
    badge: 'New',
  },
  {
    id: 3,
    name: 'Digital Art Pack',
    price: 25000,
    priceCkb: '0.00025',
    desc: 'Exclusive NFT collection from top creators',
    color: 'from-violet-500 to-violet-700',
    badge: 'Limited',
  },
  {
    id: 4,
    name: 'Fiber Premium',
    price: 1000000,
    priceCkb: '0.01',
    desc: 'Premium subscription — 1 month of Fiber Network access',
    color: 'from-emerald-500 to-emerald-700',
    badge: 'Best Value',
  },
];

interface CartItem {
  product: typeof PRODUCTS[0];
  quantity: number;
}

type Step = 'cart' | 'payment' | 'confirming' | 'success' | 'error';

// API key resolution: env var > localStorage (set by dashboard)
const API_KEY =
  import.meta.env.VITE_MERCHANT_API_KEY || localStorage.getItem('fm_api_key') || '';

export default function App() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [step, setStep] = useState<Step>('cart');
  const [invoiceUrl, setInvoiceUrl] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [checkingStatus, setCheckingStatus] = useState(false);

  const addToCart = (product: typeof PRODUCTS[0]) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.product.id === productId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const totalAmount = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const totalAmountCkb = (totalAmount / 1e8).toFixed(6);

  const handleCheckout = async () => {
    if (!API_KEY) {
      setErrorMsg('Set VITE_MERCHANT_API_KEY in packages/demo-store/.env to enable checkout');
      return;
    }

    setStep('payment');
    setErrorMsg('');

    try {
      const response = await fetch('/api/v1/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          amount: String(totalAmount),
          currency: 'CKB',
          description: `Store order: ${cart.map((i) => `${i.product.name} x${i.quantity}`).join(', ')}`,
          metadata: {
            store: 'Fiber Demo Store',
            items: JSON.stringify(
              cart.map((i) => ({ id: i.product.id, name: i.product.name, qty: i.quantity }))
            ),
          },
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create invoice');
      }

      const invoice = await response.json();
      setInvoiceId(invoice.id);
      setInvoiceUrl(invoice.invoiceAddress);
      setStep('confirming');
      pollPaymentStatus(invoice.id);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Payment failed');
      setStep('error');
    }
  };

  const pollPaymentStatus = async (id: string) => {
    setCheckingStatus(true);
    let attempts = 0;
    const maxAttempts = 30;

    const check = async () => {
      try {
        const res = await fetch(`/api/v1/invoices/${id}`, {
          headers: { Authorization: `Bearer ${API_KEY}` },
        });
        if (!res.ok) return;
        const invoice = await res.json();

        if (invoice.status === 'paid') {
          setStep('success');
          setCart([]);
          setCheckingStatus(false);
          return;
        }
        if (invoice.status === 'expired' || invoice.status === 'cancelled') {
          setErrorMsg('Payment expired or cancelled');
          setStep('error');
          setCheckingStatus(false);
          return;
        }
        attempts++;
        if (attempts < maxAttempts) setTimeout(check, 2000);
        else setCheckingStatus(false);
      } catch {
        attempts++;
        if (attempts < maxAttempts) setTimeout(check, 2000);
        else setCheckingStatus(false);
      }
    };
    setTimeout(check, 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-fiber-600 flex items-center justify-center">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">
              Fiber<span className="text-fiber-600">Store</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            {step !== 'cart' && (
              <button
                onClick={() => { setStep('cart'); setErrorMsg(''); }}
                className="flex items-center gap-1.5 text-sm text-fiber-600 hover:text-fiber-700 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to store
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Setup banner */}
        {!API_KEY && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
            <Terminal className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">API key not configured</p>
              <p className="text-xs text-amber-600">
                Create <code className="bg-amber-100 px-1 rounded">packages/demo-store/.env</code> with{' '}
                <code className="bg-amber-100 px-1 rounded">VITE_MERCHANT_API_KEY=fm_sk_...</code>
              </p>
            </div>
          </div>
        )}

        {/* Products */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Package className="h-5 w-5 text-fiber-600" />
            Products
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PRODUCTS.map((product) => {
              const inCart = cart.find((i) => i.product.id === product.id);
              return (
                <div
                  key={product.id}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-gray-300 transition-all duration-200 group"
                >
                  <div className={`h-32 bg-gradient-to-br ${product.color} flex items-center justify-center relative`}>
                    <div className="absolute inset-0 bg-black/10" />
                    {product.id === 1 ? <Settings className="h-10 w-10 text-white" /> :
                     product.id === 2 ? <Shirt className="h-10 w-10 text-white" /> :
                     product.id === 3 ? <Palette className="h-10 w-10 text-white" /> :
                     <Star className="h-10 w-10 text-white" />}
                    {product.badge && (
                      <span className="absolute top-2 right-2 bg-white/20 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-0.5 rounded-full border border-white/30">
                        {product.badge}
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 text-sm">{product.name}</h3>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">{product.desc}</p>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                      <span className="text-lg font-bold text-fiber-600">{product.priceCkb} <span className="text-xs font-medium text-gray-400">CKB</span></span>
                      <button
                        onClick={() => addToCart(product)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-fiber-600 hover:bg-fiber-700 text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        <Plus className="h-3 w-3" />
                        {inCart ? `Add (${inCart.quantity})` : 'Add'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cart */}
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-fiber-600" />
          Cart
          {cartCount > 0 && <span className="text-sm font-normal text-gray-400">({cartCount} items)</span>}
        </h2>

        {cart.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <ShoppingCart className="h-8 w-8 text-gray-300" />
            </div>
            <p className="text-gray-500 font-medium">Your cart is empty</p>
            <p className="text-xs text-gray-400 mt-1">Add products to get started</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="divide-y divide-gray-100">
              {cart.map((item) => (
                <div key={item.product.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${item.product.color} flex items-center justify-center`}>
                      {item.product.id === 1 ? <Settings className="h-5 w-5 text-white" /> :
                       item.product.id === 2 ? <Shirt className="h-5 w-5 text-white" /> :
                       item.product.id === 3 ? <Palette className="h-5 w-5 text-white" /> :
                       <Star className="h-5 w-5 text-white" />}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{item.product.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <button onClick={() => updateQuantity(item.product.id, -1)} className="w-6 h-6 rounded border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"><Minus className="h-3 w-3 text-gray-500" /></button>
                        <span className="text-sm font-medium text-gray-700 w-5 text-center">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.product.id, 1)} className="w-6 h-6 rounded border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"><Plus className="h-3 w-3 text-gray-500" /></button>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold text-gray-900 text-sm">{((item.product.price * item.quantity) / 1e8).toFixed(4)}</p>
                      <p className="text-[10px] text-gray-400">CKB</p>
                    </div>
                    <button onClick={() => removeFromCart(item.product.id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-200 p-4 bg-gray-50/50">
              <div className="flex items-center justify-between mb-4">
                <span className="text-base font-semibold text-gray-900">Total</span>
                <span className="text-2xl font-bold text-fiber-600">{totalAmountCkb} <span className="text-sm font-medium text-gray-400">CKB</span></span>
              </div>
              <button
                onClick={handleCheckout}
                className="w-full bg-fiber-600 hover:bg-fiber-700 text-white py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <Zap className="h-5 w-5" />
                Pay with Fiber
              </button>
              {errorMsg && (
                <p className="text-xs text-red-500 mt-2 text-center">{errorMsg}</p>
              )}
            </div>
          </div>
        )}

        {/* Payment screens */}
        {step === 'payment' && (
          <div className="max-w-md mx-auto mt-8">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8 text-center">
              <Loader2 className="h-12 w-12 animate-spin text-fiber-600 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">Creating Payment...</h2>
              <p className="text-sm text-gray-500">Generating your Fiber Network invoice</p>
            </div>
          </div>
        )}

        {step === 'confirming' && (
          <div className="max-w-md mx-auto mt-8">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8 text-center">
              <div className="w-20 h-20 mx-auto mb-6 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="w-16 h-16">
                  <rect x="10" y="10" width="25" height="25" fill="#0c8ee7" rx="3" />
                  <rect x="40" y="10" width="20" height="25" fill="#0c8ee7" rx="3" />
                  <rect x="65" y="10" width="25" height="25" fill="#0c8ee7" rx="3" />
                  <rect x="10" y="40" width="35" height="20" fill="#0c8ee7" rx="3" />
                  <rect x="50" y="40" width="40" height="20" fill="#0c8ee7" rx="3" />
                  <rect x="10" y="65" width="25" height="25" fill="#0c8ee7" rx="3" />
                  <rect x="40" y="65" width="25" height="25" fill="#0c8ee7" rx="3" />
                  <rect x="70" y="65" width="20" height="25" fill="#0c8ee7" rx="3" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Scan to Pay</h2>
              <p className="text-sm text-gray-500 mb-6">Open your Fiber wallet and scan this invoice</p>
              <div className="bg-gradient-to-br from-fiber-50 to-fiber-100 rounded-xl p-5 mb-6 border border-fiber-200">
                <p className="text-3xl font-bold text-fiber-700 mb-1">{totalAmountCkb}</p>
                <p className="text-xs text-fiber-500">CKB</p>
              </div>
              {checkingStatus && (
                <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-4">
                  <Loader2 className="h-4 w-4 animate-spin text-fiber-600" />
                  Waiting for payment...
                </div>
              )}
              <code className="block text-xs bg-gray-50 border border-gray-100 px-3 py-2 rounded-lg break-all text-gray-600 mb-4 text-left font-mono">{invoiceUrl}</code>
              <button onClick={() => navigator.clipboard.writeText(invoiceUrl)} className="inline-flex items-center gap-1.5 text-fiber-600 text-sm hover:text-fiber-700 transition-colors font-medium">
                <Copy className="h-3.5 w-3.5" />
                Copy invoice address
              </button>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="max-w-md mx-auto mt-8">
            <div className="bg-white rounded-2xl border border-emerald-200 shadow-lg p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4 border border-emerald-200">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold text-emerald-700 mb-2">Payment Successful!</h2>
              <p className="text-gray-500 text-sm mb-6">Your order has been confirmed and will be processed.</p>
              <div className="bg-emerald-50 rounded-xl p-4 mb-6 border border-emerald-200">
                <p className="text-xs font-medium text-emerald-700 mb-1">Invoice ID</p>
                <code className="text-xs font-mono text-emerald-600 break-all">{invoiceId}</code>
              </div>
              <button onClick={() => setStep('cart')} className="bg-fiber-600 hover:bg-fiber-700 text-white px-8 py-3 rounded-xl font-semibold transition-colors inline-flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Continue Shopping
              </button>
            </div>
          </div>
        )}

        {step === 'error' && (
          <div className="max-w-md mx-auto mt-8">
            <div className="bg-white rounded-2xl border border-red-200 shadow-lg p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4 border border-red-200">
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-red-700 mb-2">Payment Failed</h2>
              <p className="text-red-500 text-sm mb-6">{errorMsg}</p>
              <button onClick={() => setStep('cart')} className="bg-gray-700 hover:bg-gray-800 text-white px-8 py-3 rounded-xl font-semibold transition-colors">
                Try Again
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
