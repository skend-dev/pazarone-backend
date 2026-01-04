export class DashboardStatsDto {
  // Currency-separated fields
  totalRevenueMKD?: number;
  totalRevenueEUR?: number;
  netRevenueMKD?: number;
  netRevenueEUR?: number;
  platformFeeMKD?: number;
  platformFeeEUR?: number;
  affiliateCommissionMKD?: number;
  affiliateCommissionEUR?: number;
  // Legacy fields for backward compatibility
  totalRevenue: number;
  netRevenue: number;
  platformFee: number;
  affiliateCommission: number;
  totalOrders: number;
  activeProducts: number;
  avgResponseTime: string;
  revenueChange: number;
  ordersChange: number;
  pendingReview: number;
}

