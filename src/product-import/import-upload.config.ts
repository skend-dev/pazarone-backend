import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';
import {
  IMPORT_ALLOWED_EXTENSIONS,
  IMPORT_MAX_FILE_SIZE,
} from './parsers/import-security.constants';
import { getImportFileExtension } from './parsers/import-security';

const ALLOWED_MIMETYPES = new Set([
  'text/csv',
  'application/csv',
  'text/plain',
  'application/octet-stream',
]);

export const productImportMulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: IMPORT_MAX_FILE_SIZE, files: 1 },
  fileFilter: (
    _req: unknown,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    const ext = getImportFileExtension(file.originalname || '');
    if (!IMPORT_ALLOWED_EXTENSIONS.has(ext)) {
      return cb(
        new BadRequestException('Only CSV files (.csv) are allowed.'),
        false,
      );
    }

    const mime = (file.mimetype || '').toLowerCase();
    if (mime && !ALLOWED_MIMETYPES.has(mime)) {
      return cb(
        new BadRequestException('Unsupported upload content type.'),
        false,
      );
    }

    cb(null, true);
  },
};
