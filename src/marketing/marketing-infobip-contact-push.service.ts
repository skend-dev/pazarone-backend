import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketingContact } from './entities/marketing-contact.entity';
import { InfobipPeopleService } from './infobip-people.service';

/** Pushes normalized phone identities to Infobip People — SMS/Viber campaigns run in Infobip. */
@Injectable()
export class MarketingInfobipContactPushService {
  constructor(
    @InjectRepository(MarketingContact)
    private readonly marketingContactRepository: Repository<MarketingContact>,
    private readonly infobipPeopleService: InfobipPeopleService,
  ) {}

  /** When `INFOBIP_PEOPLE_SYNC_ENABLED` and contacts have `phoneE164`, upserts to People API. */
  async pushIfPhonePresent(contact: MarketingContact): Promise<void> {
    if (!this.infobipPeopleService.isConfigured()) return;
    if (!contact.phoneE164?.trim()) return;

    const r = await this.infobipPeopleService.upsertFromMarketingContact(contact);
    if (r.ok) {
      await this.marketingContactRepository.update(contact.id, {
        infobipPeopleSyncedAt: new Date(),
        infobipPeopleSyncError: null,
      });
    } else {
      await this.marketingContactRepository.update(contact.id, {
        infobipPeopleSyncError: r.error.slice(0, 2000),
      });
    }
  }
}
