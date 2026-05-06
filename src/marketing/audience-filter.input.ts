import { ListMarketingContactsQueryDto } from './dto/list-marketing-contacts-query.dto';

/** Normalized audience segment for TypeORM query building. */
export type AudienceFilterInput = {
  q?: string;
  source?: string;
  market?: string;
  gender?: string;
  city?: string;
  tag?: string;
  userType?: string;
  hasUser?: boolean;
  emailMarketingOptIn?: boolean;
  viberMarketingOptIn?: boolean;
  /** Rows with non-empty email or phone */
  contactChannel?: 'email' | 'phone';
};

export function audienceFiltersFromListQuery(
  query: ListMarketingContactsQueryDto,
): AudienceFilterInput {
  const f: AudienceFilterInput = {};
  const q = query.q?.trim();
  if (q) f.q = q;
  if (query.source) f.source = query.source;
  if (query.market?.trim()) f.market = query.market.trim();
  if (query.gender?.trim()) f.gender = query.gender.trim();
  if (query.city?.trim()) f.city = query.city.trim();
  if (query.tag?.trim()) f.tag = query.tag.trim();
  if (query.userType) f.userType = query.userType;
  if (query.hasUser === 'true') f.hasUser = true;
  if (query.hasUser === 'false') f.hasUser = false;
  if (query.emailMarketingOptIn === 'true') f.emailMarketingOptIn = true;
  if (query.emailMarketingOptIn === 'false') f.emailMarketingOptIn = false;
  if (query.viberMarketingOptIn === 'true') f.viberMarketingOptIn = true;
  if (query.viberMarketingOptIn === 'false') f.viberMarketingOptIn = false;
  if (query.contactChannel === 'email' || query.contactChannel === 'phone') {
    f.contactChannel = query.contactChannel;
  }
  return f;
}
