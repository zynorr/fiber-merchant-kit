import { useCallback, useMemo, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { MerchantClient } from '@fiber-merchant/sdk';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import InvoicesPage from './pages/InvoicesPage';
import InvoiceDetailPage from './pages/InvoiceDetailPage';
import WebhooksPage from './pages/WebhooksPage';
import TransactionsPage from './pages/TransactionsPage';
import BalancePage from './pages/BalancePage';
import FiberPage from './pages/FiberPage';

export type AppContextType = {
  client: MerchantClient | null;
  apiKey: string;
  setApiKey: (key: string) => void;
  baseUrl: string;
};

function createClient(apiKey: string, baseUrl: string, onUnauthorized: () => void): MerchantClient {
  return new MerchantClient({
    baseUrl,
    apiKey,
    timeout: 15_000,
    onUnauthorized,
  });
}

export default function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('fm_api_key') || '');
  const [authNotice, setAuthNotice] = useState('');
  const baseUrl = import.meta.env.VITE_MERCHANT_API_URL || '';

  const clearStoredKey = useCallback((message = '') => {
    localStorage.removeItem('fm_api_key');
    setApiKey('');
    setAuthNotice(message);
  }, []);

  const handleLogin = (key: string) => {
    setAuthNotice('');
    setApiKey(key);
  };

  const client = useMemo(
    () => apiKey ? createClient(apiKey, baseUrl, () => {
      clearStoredKey('Your saved API key was rejected. Paste the current demo key from the API server log.');
    }) : null,
    [apiKey, baseUrl, clearStoredKey],
  );

  if (!client) {
    return <LoginPage onLogin={handleLogin} baseUrl={baseUrl} notice={authNotice} />;
  }

  return (
    <Layout apiKey={apiKey} onLogout={() => clearStoredKey()}>
      <Routes>
        <Route path="/" element={<DashboardPage client={client} />} />
        <Route path="/invoices" element={<InvoicesPage client={client} />} />
        <Route path="/invoices/:id" element={<InvoiceDetailPage client={client} />} />
        <Route path="/webhooks" element={<WebhooksPage client={client} />} />
        <Route path="/transactions" element={<TransactionsPage client={client} />} />
        <Route path="/balance" element={<BalancePage client={client} />} />
        <Route path="/fiber" element={<FiberPage client={client} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
