import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import type { DecodedIdToken } from 'firebase-admin/auth';

export const FIREBASE_ADMIN = 'FIREBASE_ADMIN';

export interface FirebaseDecodedToken {
  uid: string;
  email?: string | null;
  email_verified?: boolean;
  name?: string | null;
  picture?: string | null;
  sign_in_provider?: string;
}

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
  private app: admin.app.App | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');

    if (!projectId || !clientEmail || !privateKey) {
      return;
    }

    const key = privateKey.replace(/\\n/g, '\n');

    try {
      this.app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: key,
        }),
      });
    } catch (err) {
      throw new Error(
        `Firebase Admin initialization failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  isConfigured(): boolean {
    return this.app != null;
  }

  /**
   * Verifies the Firebase ID token and optionally checks revocation.
   * Returns decoded claims. Use only Firebase-verified claims (uid, email, etc.).
   */
  /**
   * Permanently deletes a Firebase Auth user when Admin SDK is configured.
   * No-op when Firebase is not configured (e.g. local dev without credentials).
   */
  async deleteAuthUser(firebaseUid: string): Promise<void> {
    if (!this.app || !firebaseUid?.trim()) {
      return;
    }
    try {
      await this.app.auth().deleteUser(firebaseUid.trim());
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/user-not-found') {
        return;
      }
      throw err;
    }
  }

  async verifyIdToken(idToken: string, checkRevoked = true): Promise<FirebaseDecodedToken> {
    if (!this.app) {
      throw new Error('Firebase Admin is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.');
    }

    let decoded: DecodedIdToken;
    try {
      decoded = await this.app.auth().verifyIdToken(idToken, checkRevoked);
    } catch (err) {
      throw new Error(
        `Invalid Firebase ID token: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const uid = decoded.uid;
    if (!uid) {
      throw new Error('Firebase token missing uid');
    }

    const signInProvider = (decoded as DecodedIdToken & { firebase?: { sign_in_provider?: string } }).firebase?.sign_in_provider;

    return {
      uid,
      email: decoded.email ?? null,
      email_verified: decoded.email_verified === true,
      name: decoded.name ?? null,
      picture: decoded.picture ?? null,
      sign_in_provider: signInProvider,
    };
  }
}
