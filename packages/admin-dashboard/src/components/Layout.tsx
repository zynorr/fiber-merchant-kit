import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  ArrowLeftRight,
  Webhook,
  Wallet,
  Network,
  LogOut,
  Zap,
  ChevronDown,
} from 'lucide-react';
import { useState } from 'react';

interface LayoutProps {
  children: React.ReactNode;
  apiKey: string;
  onLogout: () => void;
}

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/invoices', label: 'Invoices', icon: Receipt },
  { path: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { path: '/webhooks', label: 'Webhooks', icon: Webhook },
  { path: '/balance', label: 'Balance', icon: Wallet },
  { path: '/fiber', label: 'Network', icon: Network },
];

export default function Layout({ children, apiKey, onLogout }: LayoutProps) {
  const [showProfile, setShowProfile] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-gray-100">
          <div className="w-8 h-8 rounded-lg bg-fiber-600 flex items-center justify-center">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <div>
            <span className="text-base font-bold text-gray-900">Fiber</span>
            <span className="text-base font-bold text-fiber-600">Merchant</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-fiber-50 text-fiber-700 border border-fiber-200'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-transparent'
                }`
              }
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="px-3 py-4 border-t border-gray-100">
          <div className="relative">
            <button
              onClick={() => setShowProfile(!showProfile)}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-fiber-100 flex items-center justify-center">
                <Zap className="h-3.5 w-3.5 text-fiber-600" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-xs font-medium text-gray-700">Demo Merchant</p>
                <p className="text-xs text-gray-400 truncate">{apiKey.slice(0, 12)}...</p>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
            </button>

            {showProfile && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowProfile(false)} />
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-lg border border-gray-200 shadow-lg py-1 z-20">
                  <button
                    onClick={onLogout}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-30">
          <div>
            <h2 className="text-sm font-medium text-gray-500">Fiber Network</h2>
            <p className="text-xs text-gray-400">Payment Processing Dashboard</p>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-red-600 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </header>

        {/* Page Content */}
        <main className="flex-1 px-6 py-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
