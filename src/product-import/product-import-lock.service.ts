import { ConflictException, Injectable } from '@nestjs/common';

@Injectable()
export class ProductImportLockService {
  private readonly active = new Set<string>();

  acquire(sellerId: string): void {
    if (this.active.has(sellerId)) {
      throw new ConflictException(
        'An import is already in progress for this seller. Please wait for it to finish.',
      );
    }
    this.active.add(sellerId);
  }

  release(sellerId: string): void {
    this.active.delete(sellerId);
  }
}
