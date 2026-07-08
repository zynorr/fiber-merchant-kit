import { useEffect, useState } from 'react';
import { Info, Zap, KeyRound, Shield } from 'lucide-react';
import { Button } from '../components/ui';

interface LoginPageProps {
  onLogin: (apiKey: string) => void;
  baseUrl: string;
  notice?: string;
}

export default function LoginPage({ onLogin, baseUrl, notice }: LoginPageProps) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoKeyAvailable, setDemoKeyAvailable] = useState(false);
  const [demoKeyLoading, setDemoKeyLoading] = useState(false);

  useEffect(() => {
    let active = true;

    fetch(`${baseUrl}/api/v1/demo-store/demo-key`, { method: 'HEAD' })
      .then((res) => {
        if (active) setDemoKeyAvailable(res.ok);
      })
      .catch(() => {
        if (active) setDemoKeyAvailable(false);
      });

    return () => {
      active = false;
    };
  }, [baseUrl]);

  const connectWithKey = async (apiKey: string) => {
    setError('');
    const normalizedKey = apiKey.trim();

    if (!normalizedKey.startsWith('fm_sk_')) {
      setError('Invalid API key format. Key should start with "fm_sk_"');
      return false;
    }

    setLoading(true);
    try {
      const res = await fetch(`${baseUrl}/api/v1/stats`, {
        headers: { Authorization: `Bearer ${normalizedKey}` },
      });
      if (res.ok) {
        localStorage.setItem('fm_api_key', normalizedKey);
        onLogin(normalizedKey);
      } else {
        setError('Invalid API key. Server rejected the request.');
      }
    } catch {
      setError('Cannot connect to server. Make sure the API server is running.');
    } finally {
      setLoading(false);
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await connectWithKey(key);
  };

  const handleDemoKeyLogin = async () => {
    setError('');
    setDemoKeyLoading(true);

    try {
      const res = await fetch(`${baseUrl}/api/v1/demo-store/demo-key`);
      if (!res.ok) {
        throw new Error('Demo key helper unavailable');
      }

      const body = await res.json() as { apiKey?: string };
      if (!body.apiKey?.startsWith('fm_sk_')) {
        throw new Error('Demo key response was invalid');
      }

      setKey(body.apiKey);
      await connectWithKey(body.apiKey);
    } catch {
      setError('Hosted demo key is not available on this server. For local runs, copy the key printed by the API server.');
    } finally {
      setDemoKeyLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left - Brand/Illustration Side */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-fiber-900 via-fiber-800 to-fiber-950 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.1)_0%,_transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(255,255,255,0.05)_0%,_transparent_50%)]" />
        <div className="relative text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center mx-auto mb-8 border border-white/20">
            <Zap className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">
            Fiber Merchant
          </h1>
          <p className="text-lg text-fiber-200 leading-relaxed">
            Enterprise payment processing infrastructure for the{' '}
            <span className="text-white font-semibold">Fiber Network</span>.
            Manage invoices, webhooks, and channel balances with real-time
            monitoring.
          </p>
          <div className="mt-12 grid grid-cols-3 gap-4">
            {[
              { label: 'Invoices', value: 'Real-time' },
              { label: 'Webhooks', value: 'Automatic' },
              { label: 'Channels', value: 'Monitored' },
            ].map((stat) => (
              <div key={stat.label} className="bg-white/5 rounded-xl p-4 border border-white/10">
                <p className="text-lg font-bold text-white">{stat.value}</p>
                <p className="text-xs text-fiber-300 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl bg-fiber-600 flex items-center justify-center">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">Fiber Merchant</span>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
              Welcome back
            </h2>
            <p className="text-sm text-gray-500 mt-2">
              Enter your API key to access the dashboard
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {notice && (
              <div className="bg-blue-50 border border-blue-200 text-blue-700 text-sm px-4 py-3 rounded-lg flex items-start gap-2">
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{notice}</span>
              </div>
            )}

            {demoKeyAvailable && (
              <div className="rounded-lg border border-fiber-100 bg-fiber-50 px-4 py-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-fiber-900">
                      Hosted judge demo
                    </p>
                    <p className="mt-1 text-xs leading-5 text-fiber-700">
                      Use the temporary demo merchant key to inspect invoices, webhooks, stats, and network status.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    loading={demoKeyLoading}
                    disabled={loading}
                    icon={<KeyRound className="h-4 w-4" />}
                    className="shrink-0 bg-white"
                    onClick={handleDemoKeyLogin}
                  >
                    Use demo key
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                API Key
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="password"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="fm_sk_..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-fiber-500 focus:border-transparent outline-none transition-all hover:border-gray-400"
                  autoFocus
                />
              </div>
              <p className="text-xs text-gray-400 flex items-center gap-1.5">
                <Shield className="h-3 w-3" />
                Your key is stored locally and never shared
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                {error}
              </div>
            )}

            <Button type="submit" loading={loading} disabled={demoKeyLoading} className="w-full" size="lg">
              {loading ? 'Connecting...' : 'Connect to Dashboard'}
            </Button>
          </form>

          <div className="mt-8 p-4 bg-gray-50 rounded-xl border border-gray-100">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Getting Started
            </h3>
            <ol className="space-y-2">
              {[
                'Start the API server with npm run dev',
                'Copy the API key from the server startup logs',
                'Paste it above and connect to your dashboard',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2.5 text-xs text-gray-500">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-fiber-50 text-fiber-600 flex items-center justify-center text-[10px] font-bold">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
