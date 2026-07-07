/**
 * Fiber Merchant Kit — TypeScript SDK
 *
 * A "Stripe-style" payment processing SDK for the Fiber Network.
 * Handles invoice creation, payment verification, webhook delivery,
 * refunds, channel balance management, and transaction history.
 *
 * @example
 * ```typescript
 * import { MerchantClient } from '@fiber-merchant/sdk';
 *
 * const client = new MerchantClient({
 *   baseUrl: process.env.FIBER_MERCHANT_URL,
 *   apiKey: process.env.FIBER_MERCHANT_API_KEY,
 * });
 *
 * // Create a payment invoice
 * const invoice = await client.invoices.create({
 *   amount: '5000',  // 5000 CKB (shannon)
 *   currency: 'CKB',
 *   description: 'Premium Widget - Order #ORD-001',
 *   metadata: { customerId: 'cus_123', orderId: 'ORD-001' }
 * });
 *
 * // Render QR code or deep link for the user to pay
 * console.log(invoice.invoiceAddress);
 *
 * // Check payment status
 * const checkInvoice = await client.invoices.get(invoice.id);
 * if (checkInvoice.status === 'paid') {
 *   // Fulfill the order!
 * }
 * ```
 */

export { MerchantClient } from './client';
export type {
  Currency,
  MerchantInvoiceStatus,
  WebhookEvent,
  Invoice,
  CreateInvoiceRequest,
  WebhookEndpoint,
  RegisterWebhookRequest,
  WebhookDelivery,
  WebhookRetryResponse,
  WebhookTestResponse,
  Transaction,
  ChannelBalance,
  MerchantStats,
  ApiKey,
  PaginatedResponse,
  MerchantClientOptions,
} from './types';
