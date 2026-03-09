export type PaymentCurrencyDto = 'eur' | 'usd' | 'gbp' | string;
export type NotificationPriorityDto = 'low' | 'normal' | 'high';

export interface CreatePaymentIntentRequestDto {
  amount: number;
  bookingId: string;
  currency?: PaymentCurrencyDto;
  description?: string;
  referenceType?: 'booking' | 'project' | 'session' | 'gift_card' | string;
  referenceId?: string;
  referenceLabel?: string;
}

export interface CreatePaymentIntentResponseDto {
  success: boolean;
  clientSecret: string;
  paymentIntentId: string;
}

export interface NotificationCreateRequestDto {
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  priority?: NotificationPriorityDto;
  meta?: Record<string, string>;
}

export interface NotificationCreateResponseDto {
  success: boolean;
  id?: string;
}

export interface StaffSyncProfileRequestDto {
  userId: string;
  currentUser: Record<string, unknown>;
  nextUser: Record<string, unknown>;
  prevRole: string;
  nextRole: string;
  nowIso: string;
}

export interface StaffSyncProfileResponseDto {
  success: boolean;
}

export interface BonusRedeemRequestDto {
  code: string;
}

export interface BonusRedeemResponseDto {
  success: boolean;
  code: string;
  amount: number;
  walletBalance: number;
}

export interface BonusCreateGiftCardRequestDto {
  name?: string;
  amount: number;
  note?: string;
  expiresAt?: string | null;
  buyerUserId?: string;
  source?: 'client_purchase' | 'admin_manual' | 'system' | string;
  paymentIntentId?: string;
  giftedToUserId?: string;
  giftedToName?: string;
  giftedToEmail?: string;
  giftedToPhone?: string;
  giftMessage?: string;
}

export interface BonusCreateGiftCardResponseDto {
  success: boolean;
  giftId: string;
  code: string;
  amount: number;
}
