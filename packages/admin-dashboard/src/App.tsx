import { useState } from 'react';
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

function createClient(apiKey: string, baseUrl: string): MerchantClient {
  return new MerchantClient({
    baseUrl,
    apiKey,
    timeout: 15_000,
  });
}

export default function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('fm_api_key') || '');
  const baseUrl = import.meta.env.VITE_MERCHANT_API_URL || '';

  const client = apiKey ? createClient(apiKey, baseUrl) : null;

  if (!client) {
    return <LoginPage onLogin={setApiKey} baseUrl={baseUrl} />;
  }

  return (
    <Layout apiKey={apiKey} onLogout={() => { setApiKey(''); localStorage.removeItem('fm_api_key'); }}>
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
