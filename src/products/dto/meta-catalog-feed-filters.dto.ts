/** Query filters for GET /api/meta-feed (Commerce Manager data source URL). */
export type MetaCatalogFeedFilters = {
  /** Single category UUID */
  category?: string;
  /** Comma-separated category UUIDs (matches public /api/products `categories`) */
  categories?: string;
  /** Single seller UUID */
  sellerId?: string;
  /** Comma-separated seller UUIDs (OR: product in any of these sellers) */
  sellerIds?: string;
};
