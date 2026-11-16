export interface VerifyPaymentParams {
  transactionNumber: string;
  expectedAmount?: number;
  expectedCurrency?: string;
  senderPhone?: string;
  paymentMethod?: string;
  idempotencyKey?: string;
  waitMs?: number;
}

export interface VerificationResult {
  success: boolean;
  status: 'VERIFIED' | 'PENDING' | 'NOT_FOUND' | 'FAILED' | 'PROVIDER_UNAVAILABLE';
  httpStatus?: number;
  providerRequestId?: string;
  providerTransactionId: string;
  amount: number;
  currency: string;
  senderName?: string;
  senderPhone?: string;
  recipientPhone?: string;
  recipientName?: string;
  providerStatus?: string;
  verifiedFlag?: boolean;
  paymentMethod: string;
  rawResponse: Record<string, any>;
  errorMessage?: string;
  verifiedAt: number;
}

export interface WebhookParseResult {
  eventId?: string;
  eventType: string;
  requestId?: string;
  verification: VerificationResult;
}

export interface PaymentVerificationProvider {
  readonly id: string;
  readonly name: string;
  readonly supportedMethods: string[];

  isConfigured(): boolean;
  verifyTransaction(params: VerifyPaymentParams): Promise<VerificationResult>;
  checkVerificationStatus?(requestId: string): Promise<VerificationResult>;
  verifyWebhookSignature?(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string
  ): { valid: boolean; reason?: string; eventId?: string; eventType?: string };
  parseWebhookEvent?(payload: Record<string, any>): WebhookParseResult;
}
