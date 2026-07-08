import { useEffect, useMemo, useState } from 'react';
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
  RefreshCw,
  CreditCard,
} from 'lucide-react';

const PRODUCTS = [
  {
    id: 1,
    name: 'Cyber Widget',
    price: 5000,
    priceCkb: '0.000050',
    desc: 'High-performance digital widget for automated workflows',
    color: 'from-sky-500 to-blue-700',
    badge: 'Popular',
  },
  {
    id: 2,
    name: 'Nervos T-Shirt',
    price: 100000,
    priceCkb: '0.001000',
    desc: 'Limited edition CKB merchandise in premium cotton',
    color: 'from-zinc-700 to-zinc-950',
    badge: 'New',
  },
  {
    id: 3,
    name: 'Digital Art Pack',
    price: 25000,
    priceCkb: '0.000250',
    desc: 'Creator pack for collectible checkout demos',
    color: 'from-fuchsia-500 to-rose-700',
    badge: 'Limited',
  },
  {
    id: 4,
    name: 'Fiber Premium',
    price: 1000000,
    priceCkb: '0.010000',
    desc: 'One month of premium Fiber Network tooling',
    color: 'from-emerald-500 to-teal-700',
    badge: 'Best Value',
  },
];

type Product = (typeof PRODUCTS)[number];

interface CartItem {
  product: Product;
  quantity: number;
}

type Step = 'cart' | 'payment' | 'confirming' | 'success' | 'error';
type ApiMode = 'checking' | 'demo' | 'live' | 'offline';

function formatCkb(amount: number) {
  return (amount / 1e8).toFixed(6);
}

function ProductIcon({ product }: { product: Product }) {
  if (product.id === 1) return <Settings className="h-10 w-10 text-white" />;
  if (product.id === 2) return <Shirt className="h-10 w-10 text-white" />;
  if (product.id === 3) return <Palette className="h-10 w-10 text-white" />;
  return <Star className="h-10 w-10 text-white" />;
}

export default function App() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [step, setStep] = useState<Step>('cart');
  const [invoiceUrl, setInvoiceUrl] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [invoiceStatus, setInvoiceStatus] = useState('pending');
  const [errorMsg, setErrorMsg] = useState('');
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [statusChecks, setStatusChecks] = useState(0);
  const [apiMode, setApiMode] = useState<ApiMode>('checking');
  const [checkoutItems, setCheckoutItems] = useState<CartItem[]>([]);
  const [checkoutTotalCkb, setCheckoutTotalCkb] = useState('0.000000');

  useEffect(() => {
    let alive = true;
    fetch('/api/v1/health')
      .then((res) => res.json())
      .then((health) => {
        if (!alive) return;
        setApiMode(health?.fiberNode?.node_id === 'demo-node' ? 'demo' : 'live');
      })
      .catch(() => {
        if (alive) setApiMode('offline');
      });
    return () => {
      alive = false;
    };
  }, []);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const totalAmountCkb = useMemo(() => formatCkb(totalAmount), [totalAmount]);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
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
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const resetCheckout = () => {
    setStep('cart');
    setInvoiceId('');
    setInvoiceUrl('');
    setInvoiceStatus('pending');
    setStatusChecks(0);
    setCheckingStatus(false);
    setSimulating(false);
    setErrorMsg('');
  };

  const applyInvoiceState = (invoice: { status?: string; id?: string; invoiceAddress?: string }) => {
    if (invoice.status) setInvoiceStatus(invoice.status);
    if (invoice.id) setInvoiceId(invoice.id);
    if (invoice.invoiceAddress) setInvoiceUrl(invoice.invoiceAddress);

    if (invoice.status === 'paid') {
      setStep('success');
      setCart([]);
      setCheckingStatus(false);
      return true;
    }
    if (invoice.status === 'expired' || invoice.status === 'cancelled') {
      setErrorMsg('Payment expired or cancelled');
      setStep('error');
      setCheckingStatus(false);
      return true;
    }
    return false;
  };

  const fetchInvoiceStatus = async (id: string) => {
    const res = await fetch(`/api/v1/demo-store/invoices/${id}`);
    if (!res.ok) throw new Error('Unable to refresh invoice status');
    return res.json();
  };

  const checkStatusNow = async () => {
    if (!invoiceId) return;
    setCheckingStatus(true);
    try {
      const invoice = await fetchInvoiceStatus(invoiceId);
      setStatusChecks((count) => count + 1);
      const done = applyInvoiceState(invoice);
      if (!done) setCheckingStatus(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to confirm payment status');
      setCheckingStatus(false);
    }
  };

  const pollPaymentStatus = (id: string) => {
    setCheckingStatus(true);
    let attempts = 0;
    const maxAttempts = 30;

    const check = async () => {
      attempts += 1;
      try {
        const invoice = await fetchInvoiceStatus(id);
        setStatusChecks(attempts);
        const done = applyInvoiceState(invoice);
        if (done) return;

        if (attempts < maxAttempts) {
          setTimeout(check, 2000);
          return;
        }

        setErrorMsg('Payment was not confirmed before the polling window ended');
        setStep('error');
        setCheckingStatus(false);
      } catch {
        if (attempts < maxAttempts) {
          setTimeout(check, 2000);
          return;
        }
        setErrorMsg('Unable to confirm payment status');
        setStep('error');
        setCheckingStatus(false);
      }
    };

    setTimeout(check, 1200);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    setStep('payment');
    setErrorMsg('');
    setCheckoutItems(cart);
    setCheckoutTotalCkb(totalAmountCkb);

    try {
      const response = await fetch('/api/v1/demo-store/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: cart.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
          })),
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create invoice');
      }

      const invoice = await response.json();
      setInvoiceId(invoice.id);
      setInvoiceUrl(invoice.invoiceAddress);
      setInvoiceStatus(invoice.status || 'pending');
      setStatusChecks(0);
      setStep('confirming');
      pollPaymentStatus(invoice.id);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Payment failed');
      setStep('error');
    }
  };

  const simulatePayment = async () => {
    if (!invoiceId) return;
    setSimulating(true);
    setErrorMsg('');

    try {
      const response = await fetch(`/api/v1/demo-store/invoices/${invoiceId}/simulate-payment`, {
        method: 'POST',
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Unable to simulate payment');
      }
      const invoice = await response.json();
      applyInvoiceState(invoice);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to simulate payment');
    } finally {
      setSimulating(false);
    }
  };

  const modeLabel = apiMode === 'checking'
    ? 'Checking API'
    : apiMode === 'demo'
      ? 'Demo mode'
      : apiMode === 'live'
        ? 'Live node'
        : 'API offline';

  const modeClass = apiMode === 'demo'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : apiMode === 'live'
      ? 'bg-sky-50 text-sky-700 border-sky-200'
      : apiMode === 'offline'
        ? 'bg-red-50 text-red-700 border-red-200'
        : 'bg-gray-50 text-gray-600 border-gray-200';

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-600">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="block text-lg font-bold text-slate-950">
                Fiber<span className="text-sky-600">Store</span>
              </span>
              <span className="text-xs font-medium text-slate-400">Merchant checkout demo</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`hidden rounded-full border px-2.5 py-1 text-xs font-semibold sm:inline-flex ${modeClass}`}>
              {modeLabel}
            </span>
            {step !== 'cart' && (
              <button
                onClick={resetCheckout}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-600 transition-colors hover:text-sky-700"
              >
                <ArrowLeft className="h-4 w-4" />
                Store
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {step === 'cart' && (
          <>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <h1 className="flex items-center gap-2 text-xl font-bold text-slate-950">
                    <Package className="h-5 w-5 text-sky-600" />
                    Products
                  </h1>
                  <span className="text-sm font-medium text-slate-400">Fiber-ready checkout</span>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {PRODUCTS.map((product) => {
                    const inCart = cart.find((item) => item.product.id === product.id);
                    return (
                      <article
                        key={product.id}
                        className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                      >
                        <div className={`relative flex h-36 items-center justify-center bg-gradient-to-br ${product.color}`}>
                          <div className="absolute inset-0 bg-black/10" />
                          <ProductIcon product={product} />
                          <span className="absolute right-3 top-3 rounded-full border border-white/30 bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur">
                            {product.badge}
                          </span>
                        </div>
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h2 className="text-sm font-bold text-slate-950">{product.name}</h2>
                              <p className="mt-1 text-xs leading-relaxed text-slate-500">{product.desc}</p>
                            </div>
                          </div>
                          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                            <span className="text-lg font-black text-sky-600">
                              {product.priceCkb}
                              <span className="ml-1 text-xs font-semibold text-slate-400">CKB</span>
                            </span>
                            <button
                              onClick={() => addToCart(product)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-sky-700"
                              data-testid={`add-product-${product.id}`}
                            >
                              <Plus className="h-3.5 w-3.5" />
                              {inCart ? `Add (${inCart.quantity})` : 'Add'}
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>

              <aside className="h-fit rounded-lg border border-slate-200 bg-white shadow-sm lg:sticky lg:top-24">
                <div className="border-b border-slate-100 p-4">
                  <h2 className="flex items-center gap-2 text-base font-bold text-slate-950">
                    <ShoppingCart className="h-5 w-5 text-sky-600" />
                    Cart
                    {cartCount > 0 && <span className="text-sm font-medium text-slate-400">({cartCount})</span>}
                  </h2>
                </div>

                {cart.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-slate-100">
                      <ShoppingCart className="h-7 w-7 text-slate-300" />
                    </div>
                    <p className="text-sm font-semibold text-slate-600">Cart is empty</p>
                    <p className="mt-1 text-xs text-slate-400">Add a product to start checkout.</p>
                  </div>
                ) : (
                  <>
                    <div className="divide-y divide-slate-100">
                      {cart.map((item) => (
                        <div key={item.product.id} className="flex items-center justify-between gap-3 p-4">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{item.product.name}</p>
                            <p className="mt-0.5 text-xs text-slate-400">{formatCkb(item.product.price * item.quantity)} CKB</p>
                            <div className="mt-2 flex items-center gap-2">
                              <button
                                onClick={() => updateQuantity(item.product.id, -1)}
                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 transition hover:bg-slate-50"
                                aria-label={`Decrease ${item.product.name}`}
                              >
                                <Minus className="h-3.5 w-3.5 text-slate-500" />
                              </button>
                              <span className="w-5 text-center text-sm font-bold text-slate-700">{item.quantity}</span>
                              <button
                                onClick={() => updateQuantity(item.product.id, 1)}
                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 transition hover:bg-slate-50"
                                aria-label={`Increase ${item.product.name}`}
                              >
                                <Plus className="h-3.5 w-3.5 text-slate-500" />
                              </button>
                            </div>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.product.id)}
                            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-slate-300 transition hover:bg-red-50 hover:text-red-500"
                            aria-label={`Remove ${item.product.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-slate-100 bg-slate-50 p-4">
                      <div className="mb-4 flex items-end justify-between">
                        <span className="text-sm font-semibold text-slate-500">Total</span>
                        <span className="text-2xl font-black text-sky-600">
                          {totalAmountCkb}
                          <span className="ml-1 text-sm font-bold text-slate-400">CKB</span>
                        </span>
                      </div>
                      <button
                        onClick={handleCheckout}
                        disabled={apiMode === 'offline'}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 py-3 text-sm font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                        data-testid="checkout-button"
                      >
                        <Zap className="h-5 w-5" />
                        Pay with Fiber
                      </button>
                    </div>
                  </>
                )}
              </aside>
            </div>
          </>
        )}

        {step === 'payment' && (
          <div className="mx-auto mt-12 max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-lg">
            <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-sky-600" />
            <h1 className="mb-2 text-xl font-bold text-slate-950">Creating payment</h1>
            <p className="text-sm text-slate-500">Generating a Fiber Network invoice for this order.</p>
          </div>
        )}

        {step === 'confirming' && (
          <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <section className="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-lg">
              <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50">
                <svg viewBox="0 0 100 100" className="h-20 w-20" aria-hidden="true">
                  <rect x="10" y="10" width="25" height="25" fill="#0284c7" rx="3" />
                  <rect x="40" y="10" width="20" height="25" fill="#0284c7" rx="3" />
                  <rect x="65" y="10" width="25" height="25" fill="#0284c7" rx="3" />
                  <rect x="10" y="40" width="35" height="20" fill="#0284c7" rx="3" />
                  <rect x="50" y="40" width="40" height="20" fill="#0284c7" rx="3" />
                  <rect x="10" y="65" width="25" height="25" fill="#0284c7" rx="3" />
                  <rect x="40" y="65" width="25" height="25" fill="#0284c7" rx="3" />
                  <rect x="70" y="65" width="20" height="25" fill="#0284c7" rx="3" />
                </svg>
              </div>
              <h1 className="mb-2 text-2xl font-black text-slate-950">Invoice ready</h1>
              <p className="mb-5 text-sm text-slate-500">Status: <span className="font-bold text-slate-700">{invoiceStatus}</span></p>
              <div className="mb-5 rounded-lg border border-sky-100 bg-sky-50 p-5">
                <p className="text-4xl font-black text-sky-700">{checkoutTotalCkb}</p>
                <p className="text-xs font-bold uppercase tracking-wide text-sky-500">CKB</p>
              </div>
              <code className="mb-4 block break-all rounded-lg border border-slate-100 bg-slate-50 px-3 py-3 text-left font-mono text-xs text-slate-600">
                {invoiceUrl}
              </code>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                <button
                  onClick={() => navigator.clipboard.writeText(invoiceUrl)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  <Copy className="h-4 w-4" />
                  Copy invoice
                </button>
                <button
                  onClick={checkStatusNow}
                  disabled={checkingStatus}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
                  data-testid="check-status"
                >
                  {checkingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Check status
                </button>
                {apiMode === 'demo' && (
                  <button
                    onClick={simulatePayment}
                    disabled={simulating}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                    data-testid="simulate-payment"
                  >
                    {simulating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                    Simulate payment
                  </button>
                )}
              </div>
              <p className="mt-4 text-xs text-slate-400">{statusChecks} status check{statusChecks === 1 ? '' : 's'} completed</p>
              {errorMsg && <p className="mt-3 text-sm font-medium text-red-600">{errorMsg}</p>}
            </section>

            <aside className="h-fit rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-bold text-slate-950">Order summary</h2>
              <div className="space-y-3">
                {checkoutItems.map((item) => (
                  <div key={item.product.id} className="flex justify-between gap-3 text-sm">
                    <span className="text-slate-600">{item.product.name} x{item.quantity}</span>
                    <span className="font-semibold text-slate-900">{formatCkb(item.product.price * item.quantity)} CKB</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 border-t border-slate-100 pt-4">
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-slate-500">Total</span>
                  <span className="text-sky-600">{checkoutTotalCkb} CKB</span>
                </div>
                <p className="mt-3 break-all rounded-lg bg-slate-50 p-3 font-mono text-[11px] text-slate-500">
                  {invoiceId}
                </p>
              </div>
            </aside>
          </div>
        )}

        {step === 'success' && (
          <div className="mx-auto mt-10 max-w-md rounded-lg border border-emerald-200 bg-white p-8 text-center shadow-lg">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <h1 className="mb-2 text-2xl font-black text-emerald-700">Payment successful</h1>
            <p className="mb-5 text-sm text-slate-500">The invoice is paid and the order is ready for fulfillment.</p>
            <div className="mb-5 rounded-lg border border-emerald-100 bg-emerald-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-600">Paid amount</p>
              <p className="text-2xl font-black text-emerald-700">{checkoutTotalCkb} CKB</p>
            </div>
            <code className="mb-6 block break-all rounded-lg bg-slate-50 p-3 text-xs text-slate-500">{invoiceId}</code>
            <button
              onClick={resetCheckout}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-sky-700"
            >
              <ShoppingCart className="h-4 w-4" />
              New order
            </button>
          </div>
        )}

        {step === 'error' && (
          <div className="mx-auto mt-10 max-w-md rounded-lg border border-red-200 bg-white p-8 text-center shadow-lg">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-lg border border-red-200 bg-red-50">
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
            <h1 className="mb-2 text-xl font-black text-red-700">Payment failed</h1>
            <p className="mb-6 text-sm text-red-500">{errorMsg}</p>
            <button
              onClick={resetCheckout}
              className="rounded-lg bg-slate-800 px-6 py-3 text-sm font-bold text-white transition hover:bg-slate-900"
            >
              Try again
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
