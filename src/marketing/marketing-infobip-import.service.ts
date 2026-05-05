import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InfobipPeopleService } from './infobip-people.service';
import {
  infobipListExtractRecords,
  infobipListHasMore,
  parseInfobipPerson,
} from './infobip-people.parser';
import { MarketingContactService } from './marketing-contact.service';

export type ImportFromInfobipSummary = {
  dryRun: boolean;
  completedPages: number;
  rawRowsSeen: number;
  parseFailures: number;
  skippedNoChannels: number;
  created: number;
  updated: number;
  /** Only when dryRun=true */
  wouldCreate?: number;
  wouldUpdate?: number;
};

@Injectable()
export class MarketingInfobipImportService {
  private readonly logger = new Logger(MarketingInfobipImportService.name);

  constructor(
    private readonly infobipPeopleService: InfobipPeopleService,
    private readonly marketingContactService: MarketingContactService,
  ) {}

  /**
   * Pull Infobip People profiles into `marketing_contacts` ([People list API](https://www.infobip.com/docs/customer-profiles/persons/persons-list)).
   * Requires `INFOBIP_PEOPLE_BASE_URL` or `INFOBIP_VIBER_BASE_URL` + API key scoped for People reads.
   */
  async pullPersonsIntoMarketingAudience(opts?: {
    pageSize?: number;
    /** Safety cap — default 250 pages */
    maxPages?: number;
    dryRun?: boolean;
    assumeViberOptIn?: boolean;
  }): Promise<ImportFromInfobipSummary> {
    if (!this.infobipPeopleService.isInboundImportReady()) {
      throw new BadRequestException(
        'Infobip list import needs INFOBIP_PEOPLE_BASE_URL (or INFOBIP_VIBER_BASE_URL) and an API key (INFOBIP_PEOPLE_API_KEY or INFOBIP_VIBER_API_KEY).',
      );
    }

    const dryRun = opts?.dryRun === true;
    const pageSize = Math.min(Math.max(opts?.pageSize ?? 50, 1), 500);
    const maxPages = Math.min(Math.max(opts?.maxPages ?? 250, 1), 2000);

    const summary: ImportFromInfobipSummary = {
      dryRun,
      completedPages: 0,
      rawRowsSeen: 0,
      parseFailures: 0,
      skippedNoChannels: 0,
      created: 0,
      updated: 0,
      wouldCreate: dryRun ? 0 : undefined,
      wouldUpdate: dryRun ? 0 : undefined,
    };

    let page = 1;

    while (page <= maxPages) {
      let doc: Record<string, unknown>;

      try {
        doc = await this.infobipPeopleService.fetchPersonsJsonPage(
          page,
          pageSize,
        );
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`pullPersons halted on page ${page}: ${msg}`);
        throw new BadRequestException(msg);
      }

      const records = infobipListExtractRecords(doc);
      if (!records.length) {
        summary.completedPages = page;
        break;
      }

      summary.completedPages = page;

      const hasMoreGlobal = infobipListHasMore(
        doc,
        records.length,
        pageSize,
      );

      for (const raw of records) {
        summary.rawRowsSeen++;

        const p = parseInfobipPerson(raw);
        if (!p) {
          summary.parseFailures++;
          continue;
        }

        if (!p.phoneE164 && !p.emailNorm) {
          summary.skippedNoChannels++;
          continue;
        }

        if (dryRun) {
          const impact =
            await this.marketingContactService.classifyInfobipImportImpact(p);
          if (impact === 'would-update')
            summary.wouldUpdate = (summary.wouldUpdate ?? 0) + 1;
          else summary.wouldCreate = (summary.wouldCreate ?? 0) + 1;
          continue;
        }

        const r = await this.marketingContactService.applyInfobipPersonImport(p, {
          assumeViberOptIn: opts?.assumeViberOptIn === true,
        });

        if (r === 'skipped-no-contact-info') summary.skippedNoChannels++;
        else if (r === 'created') summary.created++;
        else summary.updated++;
      }

      page++;

      if (!hasMoreGlobal) break;
    }

    this.logger.log(
      `Infobip People import finished (dry=${dryRun}): raw=${summary.rawRowsSeen}, created=${summary.created}/${summary.wouldCreate}, updated=${summary.updated}/${summary.wouldUpdate}, skipped=${summary.skippedNoChannels}, parseFails=${summary.parseFailures}`,
    );

    return summary;
  }
}
