import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  ParseBoolPipe,
  ParseUUIDPipe,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Express } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { ListMarketingContactsQueryDto } from './dto/list-marketing-contacts-query.dto';
import { PatchMarketingContactDto } from './dto/patch-marketing-contact.dto';
import { CreateMarketingContactDto } from './dto/create-marketing-contact.dto';
import { BackfillMarketingContactsDto } from './dto/backfill-marketing-contacts.dto';
import { MarketingContactService } from './marketing-contact.service';
import { MarketingImportService } from './marketing-import.service';
import { MarketingInfobipImportService } from './marketing-infobip-import.service';
import { SyncMarketingContactsInfobipDto } from './dto/sync-infobip-people.dto';
import { ImportFromInfobipDto } from './dto/import-from-infobip.dto';

@ApiTags('admin-marketing')
@ApiBearerAuth('JWT-auth')
@Controller('admin/marketing/contacts')
@UseGuards(JwtAuthGuard, AdminAuthGuard)
export class AdminMarketingContactsController {
  constructor(
    private readonly marketingContactService: MarketingContactService,
    private readonly marketingImportService: MarketingImportService,
    private readonly marketingInfobipImportService: MarketingInfobipImportService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List marketing contacts',
    description:
      'Paginated audience (email + phone). Live platform sync includes **customers only**; CSV/Infobip imports can add other leads. Broadcasts use Announcements; phones sync to Infobip when enabled.',
  })
  async list(@Query() query: ListMarketingContactsQueryDto) {
    return this.marketingContactService.findAllPaged(query);
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Create a manual audience contact',
    description:
      'Cold contact with `source: manual`. Requires at least email or normalizable phone. Must not duplicate another row’s email or phone.',
  })
  async create(@Body() dto: CreateMarketingContactDto) {
    return this.marketingContactService.createManual(dto);
  }

  @Post('backfill')
  @ApiOperation({
    summary: 'Backfill marketing contacts from registered customers',
    description:
      'Creates or updates rows for **customer** accounts only (from `users` + notification preferences). Admins are skipped; sellers/affiliates are removed from audience if previously linked by `userId`. Optional dry-run.',
  })
  @ApiResponse({ status: 201, description: 'Backfill started or simulated' })
  async backfill(@Body() body: BackfillMarketingContactsDto) {
    return this.marketingContactService.backfillFromRegisteredUsers(
      !!body?.dryRun,
    );
  }

  @Post('import')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description:
            'UTF-8 CSV: email, phone, name (or full name), gender (male/female), city, address, tag — optional except one of email or phone',
        },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiOperation({
    summary: 'Import marketing contacts from CSV',
    description:
      'Cold imports keep email/Viber consent off unless overwriteConsents=true (see plan). Dedupes by email or E.164 phone.',
  })
  async importCsv(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('overwriteConsents', new DefaultValuePipe(false), ParseBoolPipe)
    overwriteConsents: boolean,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('CSV required as multipart field "file".');
    }
    return this.marketingImportService.importCsvBuffer(file.buffer, {
      overwriteConsents,
    });
  }

  @Post('import-preview')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description:
            'UTF-8 CSV with header — same rules as import; no database writes',
        },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiOperation({
    summary: 'Preview CSV import (parse + validate only)',
    description:
      'Returns row counts and sample normalized rows without inserting or updating contacts.',
  })
  importCsvPreview(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('CSV required as multipart field "file".');
    }
    return this.marketingImportService.previewCsvBuffer(file.buffer);
  }

  @Post('import-from-infobip')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Import Infobip People into marketing contacts',
    description:
      'Paginates Infobip Customer Profiles Persons list (`INFOBIP_PEOPLE_LIST_PATH`). Matches Infobip id in metadata, then phone, then email. Use `dryRun` to preview counts.',
  })
  async importFromInfobip(@Body() dto: ImportFromInfobipDto) {
    return this.marketingInfobipImportService.pullPersonsIntoMarketingAudience({
      pageSize: dto.pageSize ?? 50,
      maxPages: dto.maxPages,
      dryRun: dto.dryRun === true,
      assumeViberOptIn: dto.assumeViberOptIn === true,
    });
  }

  @Post('infobip-people/sync')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Push contacts to Infobip People (Customer Profiles)',
    description:
      'Pushes contacts with an email or phone to Infobip People. ' +
      'Skips already-synced contacts unless `forceResync=true`. ' +
      'Requires `INFOBIP_PEOPLE_SYNC_ENABLED=true`.',
  })
  async syncInfobipPeople(@Body() dto: SyncMarketingContactsInfobipDto) {
    return this.marketingContactService.pushAudienceSliceToInfobipPeople(
      dto.limit ?? 100,
      dto.forceResync ?? false,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one marketing contact' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.marketingContactService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update audience contact',
    description:
      'Admin overrides including email and phone (E.164 after normalize). Keeps at least one of email or phone.',
  })
  async patch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchMarketingContactDto,
  ) {
    return this.marketingContactService.patch(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete audience contact' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.marketingContactService.remove(id);
  }
}
