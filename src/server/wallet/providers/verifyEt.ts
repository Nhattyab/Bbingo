import crypto from 'node:crypto';
import type {
  PaymentVerificationProvider,
  VerifyPaymentParams,
  VerificationResult,
  WebhookParseResult,
} from './types.ts';

const WEBHOOK_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes replay protection window

export class VerifyEtProvider implements PaymentVerificationProvider {
  readonly id = 'verify_et';
  readonly name = 'Verify.et (Telebirr Automated Verification)';
  readonly supportedMethods = ['telebirr'];

  private get apiKey(): string {
    return process.env.VERIFY_ET_API_KEY || '';
  }

  private get apiUrl(): string {
    return process.env.VERIFY_ET_API_URL || 'https://verify.et/api';
  }

  private get webhookSecret(): string {
    return process.env.VERIFY_ET_WEBHOOK_SECRET || '';
  }

  isConfigured(): boolean {
    const key = this.apiKey.trim();
    return Boolean(key.length > 0 && !key.includes('your_verify_et_api_key'));
  }

  isWebhookConfigured(): boolean {
    const sec = this.webhookSecret.trim();
    return Boolean(sec.length > 0 && !sec.includes('your_webhook_secret'));
  }

  /**
   * Normalize Verify.et response payloads (200 OK, 202 Accepted, or webhook data)
   */
  private normalizePayload(
    raw: any,
    fallbackTxNum: string,
    httpStatus: number
  ): VerificationResult {
    const now = Date.now();
    const requestId: string | undefined =
      raw?.requestId || raw?.id || raw?.verification?.requestId || raw?.data?.requestId;

    // HTTP 202 Accepted -> Async verification queued
    if (httpStatus === 202) {
      return {
        success: false,
        status: 'PENDING',
        httpStatus: 202,
        providerRequestId: requestId,
        providerTransactionId: fallbackTxNum,
        amount: 0,
        currency: 'ETB',
        paymentMethod: 'telebirr',
        providerStatus: raw?.status || 'pending',
        rawResponse: {
          httpStatus: 202,
          requestId,
          status: raw?.status || 'queued',
          message: raw?.message,
          receivedAt: now,
        },
        verifiedAt: now,
      };
    }

    const core = raw?.verification || raw?.data || raw || {};
    const rawStatus = String(core?.status || raw?.status || '').trim().toLowerCase();
    const verifiedFlag =
      typeof core?.verified === 'boolean'
        ? core.verified
        : typeof raw?.verified === 'boolean'
        ? raw.verified
        : undefined;

    // Detect pending states
    if (rawStatus === 'pending' || rawStatus === 'queued' || rawStatus === 'processing') {
      return {
        success: false,
        status: 'PENDING',
        httpStatus,
        providerRequestId: requestId,
        providerTransactionId: core?.transactionNumber || core?.reference || fallbackTxNum,
        amount: 0,
        currency: 'ETB',
        paymentMethod: 'telebirr',
        providerStatus: rawStatus,
        rawResponse: {
          httpStatus,
          requestId,
          status: rawStatus,
          receivedAt: now,
        },
        verifiedAt: now,
      };
    }

    // Detect not_found states
    if (httpStatus === 404 || rawStatus === 'not_found' || rawStatus === 'not found') {
      return {
        success: false,
        status: 'NOT_FOUND',
        httpStatus: httpStatus || 404,
        providerRequestId: requestId,
        providerTransactionId: core?.transactionNumber || fallbackTxNum,
        amount: 0,
        currency: 'ETB',
        paymentMethod: 'telebirr',
        providerStatus: rawStatus || 'not_found',
        verifiedFlag: false,
        rawResponse: {
          httpStatus: httpStatus || 404,
          requestId,
          status: rawStatus || 'not_found',
          message: raw?.message || core?.message,
          receivedAt: now,
        },
        errorMessage: raw?.message || 'Transaction not found in Telebirr records.',
        verifiedAt: now,
      };
    }

    // Extract amount and currency strictly from provider payload (never assume requestedAmount)
    const parsedAmount = parseFloat(
      core?.amount ?? core?.transactionAmount ?? core?.settledAmount ?? raw?.amount ?? 0
    );
    const verifiedAmount = isNaN(parsedAmount) ? 0 : parsedAmount;
    const verifiedCurrency = String(core?.currency || raw?.currency || 'ETB').trim().toUpperCase();

    // Extract recipient (receiving business wallet) info from creditedParty / receiver fields
    const creditedParty = core?.creditedParty || core?.receiver || raw?.creditedParty || raw?.receiver || {};
    const recipientPhone =
      (typeof creditedParty === 'object'
        ? creditedParty?.account || creditedParty?.phone || creditedParty?.phoneNumber || creditedParty?.number
        : typeof creditedParty === 'string'
        ? creditedParty
        : undefined) ||
      core?.creditedPartyAccountNo ||
      core?.receiverPhone ||
      core?.recipientPhone ||
      core?.recipientAccount ||
      core?.toAccount ||
      raw?.receiverPhone;

    const recipientName =
      (typeof creditedParty === 'object' ? creditedParty?.name || creditedParty?.accountName : undefined) ||
      core?.creditedPartyName ||
      core?.receiverName ||
      core?.recipientName ||
      raw?.receiverName;

    // Extract payer info
    const payer = core?.payer || core?.sender || raw?.payer || {};
    const senderName =
      (typeof payer === 'object' ? payer?.name : undefined) || core?.senderName || core?.payerName;
    const senderPhone =
      (typeof payer === 'object' ? payer?.account || payer?.phone || payer?.phoneNumber : undefined) ||
      core?.senderPhone ||
      core?.payerPhone;

    // Payment completion check
    const completedStatuses = ['completed', 'success', 'succeeded', 'verified', 'paid'];
    const isProviderCompleted =
      completedStatuses.includes(rawStatus) && verifiedFlag !== false;

    const failedStatuses = ['failed', 'cancelled', 'rejected', 'error', 'expired'];
    if (failedStatuses.includes(rawStatus) || verifiedFlag === false) {
      return {
        success: false,
        status: 'FAILED',
        httpStatus,
        providerRequestId: requestId,
        providerTransactionId: core?.transactionNumber || core?.reference || fallbackTxNum,
        amount: verifiedAmount,
        currency: verifiedCurrency,
        senderName,
        senderPhone,
        recipientPhone: recipientPhone ? String(recipientPhone) : undefined,
        recipientName: recipientName ? String(recipientName) : undefined,
        providerStatus: rawStatus,
        verifiedFlag,
        paymentMethod: 'telebirr',
        rawResponse: {
          httpStatus,
          requestId,
          status: rawStatus,
          verified: verifiedFlag,
          amount: verifiedAmount,
          currency: verifiedCurrency,
          recipientPhone,
          recipientName,
          date: core?.date || core?.timestamp,
        },
        errorMessage: raw?.message || core?.error || `Transaction status is '${rawStatus || 'failed'}'.`,
        verifiedAt: now,
      };
    }

    if (!isProviderCompleted) {
      return {
        success: false,
        status: 'FAILED',
        httpStatus,
        providerRequestId: requestId,
        providerTransactionId: core?.transactionNumber || core?.reference || fallbackTxNum,
        amount: verifiedAmount,
        currency: verifiedCurrency,
        providerStatus: rawStatus || 'unknown',
        verifiedFlag,
        paymentMethod: 'telebirr',
        rawResponse: {
          httpStatus,
          requestId,
          status: rawStatus || 'unknown',
          verified: verifiedFlag,
        },
        errorMessage: `Unconfirmed transaction status '${rawStatus || 'unknown'}' from Verify.et.`,
        verifiedAt: now,
      };
    }

    return {
      success: true,
      status: 'VERIFIED',
      httpStatus,
      providerRequestId: requestId,
      providerTransactionId:
        core?.transactionNumber || core?.reference || raw?.transactionNumber || fallbackTxNum,
      amount: verifiedAmount,
      currency: verifiedCurrency,
      senderName,
      senderPhone,
      recipientPhone: recipientPhone ? String(recipientPhone) : undefined,
      recipientName: recipientName ? String(recipientName) : undefined,
      providerStatus: rawStatus,
      verifiedFlag,
      paymentMethod: 'telebirr',
      rawResponse: {
        httpStatus,
        requestId,
        status: rawStatus,
        verified: verifiedFlag ?? true,
        amount: verifiedAmount,
        currency: verifiedCurrency,
        transactionNumber: core?.transactionNumber || fallbackTxNum,
        recipientPhone,
        recipientName,
        senderName,
        date: core?.date || core?.timestamp || now,
      },
      verifiedAt: now,
    };
  }

  /**
   * Submit a Telebirr transaction verification request to Verify.et
   */
  async verifyTransaction(params: VerifyPaymentParams): Promise<VerificationResult> {
    const txNum = (params.transactionNumber || '').trim().toUpperCase();

    if (!txNum) {
      return {
        success: false,
        status: 'FAILED',
        providerTransactionId: '',
        amount: 0,
        currency: 'ETB',
        paymentMethod: 'telebirr',
        rawResponse: {},
        errorMessage: 'Transaction number is required for Telebirr verification.',
        verifiedAt: Date.now(),
      };
    }

    if (!this.isConfigured()) {
      return {
        success: false,
        status: 'PROVIDER_UNAVAILABLE',
        httpStatus: 503,
        providerTransactionId: txNum,
        amount: 0,
        currency: 'ETB',
        paymentMethod: 'telebirr',
        rawResponse: { error: 'Provider API key is not configured.' },
        errorMessage: 'Telebirr verification service is not configured on the server.',
        verifiedAt: Date.now(),
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const url = `${this.apiUrl.replace(/\/+$/, '')}/verify`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
      };

      if (params.idempotencyKey) {
        headers['Idempotency-Key'] = params.idempotencyKey;
      }

      const payload = {
        bank: 'telebirr',
        transactionNumber: txNum,
        reference: txNum,
        waitMs: params.waitMs ?? 8000,
      };

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const data: any = await res.json().catch(() => ({}));

      // HTTP 202 Accepted (queued)
      if (res.status === 202) {
        return this.normalizePayload(data, txNum, 202);
      }

      // HTTP 200 OK
      if (res.ok) {
        return this.normalizePayload(data, txNum, res.status);
      }

      // HTTP 404 Not Found
      if (res.status === 404) {
        return this.normalizePayload(data, txNum, 404);
      }

      // HTTP 5xx or 429 -> Provider outage / temporary unavailability
      if (res.status >= 500 || res.status === 429) {
        return {
          success: false,
          status: 'PROVIDER_UNAVAILABLE',
          httpStatus: res.status,
          providerRequestId: data?.requestId,
          providerTransactionId: txNum,
          amount: 0,
          currency: 'ETB',
          paymentMethod: 'telebirr',
          rawResponse: { httpStatus: res.status, message: data?.message || data?.error },
          errorMessage: data?.message || data?.error || `Verify.et temporarily unavailable (${res.status}).`,
          verifiedAt: Date.now(),
        };
      }

      // Other 4xx validation failures
      return {
        success: false,
        status: 'FAILED',
        httpStatus: res.status,
        providerRequestId: data?.requestId,
        providerTransactionId: txNum,
        amount: 0,
        currency: 'ETB',
        paymentMethod: 'telebirr',
        rawResponse: { httpStatus: res.status, message: data?.message || data?.error },
        errorMessage: data?.message || data?.error || `Verification rejected (${res.status}).`,
        verifiedAt: Date.now(),
      };
    } catch (err: any) {
      const isTimeout = err?.name === 'AbortError';
      return {
        success: false,
        status: 'PROVIDER_UNAVAILABLE',
        httpStatus: 503,
        providerTransactionId: txNum,
        amount: 0,
        currency: 'ETB',
        paymentMethod: 'telebirr',
        rawResponse: { error: isTimeout ? 'Request timeout' : 'Network failure' },
        errorMessage: isTimeout
          ? 'Verification request timed out contacting Verify.et. Please check status shortly.'
          : 'Unable to reach Verify.et verification service.',
        verifiedAt: Date.now(),
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Poll status of an existing queued verification by Verify.et requestId
   */
  async checkVerificationStatus(requestId: string): Promise<VerificationResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        status: 'PROVIDER_UNAVAILABLE',
        httpStatus: 503,
        providerRequestId: requestId,
        providerTransactionId: '',
        amount: 0,
        currency: 'ETB',
        paymentMethod: 'telebirr',
        rawResponse: {},
        errorMessage: 'Verify.et API credentials not configured.',
        verifiedAt: Date.now(),
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const url = `${this.apiUrl.replace(/\/+$/, '')}/verifications/${encodeURIComponent(requestId)}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'x-api-key': this.apiKey,
        },
        signal: controller.signal,
      });

      const data: any = await res.json().catch(() => ({}));
      if (res.status === 202) {
        return this.normalizePayload({ ...data, requestId }, data?.transactionNumber || '', 202);
      }
      if (res.ok || res.status === 404) {
        return this.normalizePayload({ ...data, requestId }, data?.transactionNumber || '', res.status);
      }
      if (res.status >= 500 || res.status === 429) {
        return {
          success: false,
          status: 'PROVIDER_UNAVAILABLE',
          httpStatus: res.status,
          providerRequestId: requestId,
          providerTransactionId: '',
          amount: 0,
          currency: 'ETB',
          paymentMethod: 'telebirr',
          rawResponse: { httpStatus: res.status },
          errorMessage: `Verify.et polling temporarily unavailable (${res.status}).`,
          verifiedAt: Date.now(),
        };
      }
      return this.normalizePayload({ ...data, requestId }, data?.transactionNumber || '', res.status);
    } catch {
      return {
        success: false,
        status: 'PROVIDER_UNAVAILABLE',
        httpStatus: 503,
        providerRequestId: requestId,
        providerTransactionId: '',
        amount: 0,
        currency: 'ETB',
        paymentMethod: 'telebirr',
        rawResponse: { error: 'Polling network error' },
        errorMessage: 'Unable to poll verification status from Verify.et.',
        verifiedAt: Date.now(),
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Verify Verify.et webhook signature:
   * Signed payload = `${X-Webhook-Timestamp}.${rawBody}`
   * HMAC-SHA256 hex digest compared using timingSafeEqual
   */
  verifyWebhookSignature(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string
  ): { valid: boolean; reason?: string; eventId?: string; eventType?: string } {
    const getHeader = (name: string): string => {
      const target = name.toLowerCase();
      for (const [k, v] of Object.entries(headers)) {
        if (k.toLowerCase() === target) {
          return Array.isArray(v) ? v[0] || '' : v || '';
        }
      }
      return '';
    };

    const timestamp = getHeader('X-Webhook-Timestamp').trim();
    const signatureRaw = getHeader('X-Webhook-Signature').trim();
    const eventId = getHeader('X-Webhook-Event-Id').trim() || undefined;
    const eventType = getHeader('X-Webhook-Event').trim() || undefined;

    if (!this.isWebhookConfigured()) {
      return { valid: false, reason: 'Webhook secret not configured on server.', eventId, eventType };
    }

    if (!timestamp || !signatureRaw) {
      return { valid: false, reason: 'Missing webhook timestamp or signature headers.', eventId, eventType };
    }

    // Replay attack check (supports ISO date strings or unix ms/seconds)
    let sentAtMs = Date.parse(timestamp);
    if (isNaN(sentAtMs) && /^\d+$/.test(timestamp)) {
      const num = parseInt(timestamp, 10);
      sentAtMs = num < 1e12 ? num * 1000 : num;
    }

    if (isNaN(sentAtMs) || Math.abs(Date.now() - sentAtMs) > WEBHOOK_TOLERANCE_MS) {
      return { valid: false, reason: 'Invalid or expired webhook timestamp.', eventId, eventType };
    }

    // Strip optional "sha256=" prefix if sent
    const signatureHex = signatureRaw.replace(/^sha256=/i, '').toLowerCase();
    const signedPayload = `${timestamp}.${rawBody}`;
    const computedHex = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(signedPayload)
      .digest('hex')
      .toLowerCase();

    const sigBuf = Buffer.from(signatureHex, 'utf8');
    const compBuf = Buffer.from(computedHex, 'utf8');

    if (sigBuf.length !== compBuf.length || !crypto.timingSafeEqual(sigBuf, compBuf)) {
      return { valid: false, reason: 'Invalid webhook signature.', eventId, eventType };
    }

    return { valid: true, eventId, eventType };
  }

  /**
   * Parse Verify.et webhook event payload into normalized VerificationResult
   */
  parseWebhookEvent(payload: Record<string, any>): WebhookParseResult {
    const eventType = String(payload?.event || payload?.type || 'verification.completed');
    const requestId: string | undefined =
      payload?.requestId || payload?.data?.requestId || payload?.verification?.requestId;
    const txNum = String(
      payload?.data?.transactionNumber ||
        payload?.data?.reference ||
        payload?.verification?.transactionNumber ||
        payload?.transactionNumber ||
        ''
    )
      .trim()
      .toUpperCase();

    const verification = this.normalizePayload(
      { ...payload, requestId },
      txNum,
      200
    );

    return {
      eventId: payload?.eventId || payload?.id,
      eventType,
      requestId,
      verification,
    };
  }
}
