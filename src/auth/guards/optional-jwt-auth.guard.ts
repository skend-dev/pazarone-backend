import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT guard that does not throw when no token or invalid token is present.
 * Use for endpoints that support both authenticated and unauthenticated requests (e.g. POST /orders).
 * When valid JWT is present, request.user is set; otherwise request.user is undefined.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser>(err: Error | null, user: TUser | false): TUser | undefined {
    if (err || user === false) {
      return undefined;
    }
    return user ?? undefined;
  }
}
