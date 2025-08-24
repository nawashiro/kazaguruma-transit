import * as nip19 from 'nostr-tools/nip19';
import type { Discussion } from '@/types/discussion';
import { logger } from '@/utils/logger';

export interface AddressPointer {
  identifier: string;
  pubkey: string;
  kind: number;
  relays?: string[];
}

export interface DiscussionInfo {
  dTag: string;
  authorPubkey: string;
  discussionId: string;
  relays?: string[];
}

export function naddrEncode(addr: AddressPointer): string {
  try {
    if (!addr.identifier || typeof addr.identifier !== 'string') {
      throw new Error('Invalid identifier');
    }
    
    if (!addr.pubkey || typeof addr.pubkey !== 'string' || addr.pubkey.length !== 64 || !/^[a-fA-F0-9]{64}$/.test(addr.pubkey)) {
      throw new Error('Invalid pubkey');
    }
    
    if (!Number.isInteger(addr.kind) || addr.kind < 0) {
      throw new Error('Invalid kind');
    }

    return nip19.naddrEncode({
      identifier: addr.identifier,
      pubkey: addr.pubkey,
      kind: addr.kind,
      relays: addr.relays,
    });
  } catch (error) {
    logger.error('Failed to encode naddr:', error);
    throw new Error(`naddr encoding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function naddrDecode(naddr: string): AddressPointer {
  try {
    if (!naddr || typeof naddr !== 'string' || !naddr.startsWith('naddr1')) {
      throw new Error('Invalid naddr format');
    }

    const decoded = nip19.decode(naddr);
    
    if (decoded.type !== 'naddr') {
      throw new Error('Not an naddr');
    }

    const data = decoded.data as any;
    
    return {
      identifier: data.identifier,
      pubkey: data.pubkey,
      kind: data.kind,
      relays: data.relays,
    };
  } catch (error) {
    logger.error('Failed to decode naddr:', error);
    throw new Error(`naddr decoding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function parseNaddrFromUrl(urlParam: string): AddressPointer | null {
  try {
    if (!urlParam || typeof urlParam !== 'string') {
      return null;
    }

    // Remove query parameters if present
    const naddr = urlParam.split('?')[0];
    
    if (!naddr.startsWith('naddr1')) {
      return null;
    }

    return naddrDecode(naddr);
  } catch (error) {
    logger.error('Failed to parse naddr from URL:', error);
    return null;
  }
}

export function buildNaddrFromDiscussion(discussion: Discussion & { relays?: string[] }): string {
  try {
    const addr: AddressPointer = {
      identifier: discussion.dTag,
      pubkey: discussion.authorPubkey,
      kind: 34550,
      relays: discussion.relays,
    };

    return naddrEncode(addr);
  } catch (error) {
    logger.error('Failed to build naddr from discussion:', error);
    throw new Error('Failed to build naddr from discussion');
  }
}

export function extractDiscussionFromNaddr(naddr: string): DiscussionInfo | null {
  try {
    const decoded = naddrDecode(naddr);
    
    // Only accept discussion events (kind 34550)
    if (decoded.kind !== 34550) {
      return null;
    }

    return {
      dTag: decoded.identifier,
      authorPubkey: decoded.pubkey,
      discussionId: `34550:${decoded.pubkey}:${decoded.identifier}`,
      relays: decoded.relays,
    };
  } catch (error) {
    logger.error('Failed to extract discussion from naddr:', error);
    return null;
  }
}

export function buildDiscussionNaddr(authorPubkey: string, dTag: string, relays?: string[]): string {
  try {
    const addr: AddressPointer = {
      identifier: dTag,
      pubkey: authorPubkey,
      kind: 34550,
      relays,
    };

    return naddrEncode(addr);
  } catch (error) {
    logger.error('Failed to build discussion naddr:', error);
    throw new Error('Failed to build discussion naddr');
  }
}

export function isValidNaddr(naddr: string): boolean {
  try {
    naddrDecode(naddr);
    return true;
  } catch {
    return false;
  }
}

export function generateDiscussionId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${randomPart}`;
}

export function buildNaddrFromRef(ref: string, relays?: string[]): string {
  try {
    // ref format: "kind:pubkey:identifier"
    const parts = ref.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid reference format');
    }

    const [kindStr, pubkey, identifier] = parts;
    const kind = parseInt(kindStr, 10);

    if (isNaN(kind)) {
      throw new Error('Invalid kind in reference');
    }

    const addr: AddressPointer = {
      identifier,
      pubkey,
      kind,
      relays,
    };

    return naddrEncode(addr);
  } catch (error) {
    logger.error('Failed to build naddr from ref:', error);
    throw new Error('Failed to build naddr from reference');
  }
}