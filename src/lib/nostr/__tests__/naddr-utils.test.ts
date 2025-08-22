/**
 * Tests for naddr utility functions
 * Based on spec_v2.md requirements for naddr encoding/decoding
 */

import {
  naddrEncode,
  naddrDecode,
  parseNaddrFromUrl,
  buildNaddrFromDiscussion,
  extractDiscussionFromNaddr,
} from '../naddr-utils';
import type { AddressPointer } from '../naddr-utils';

jest.mock('@/utils/logger', () => ({
  logger: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('naddr utilities', () => {
  const validAddressPointer: AddressPointer = {
    identifier: 'bus-stop-chat',
    pubkey: 'f723816e33f9e4ed5e3b4c3b2c99e8b8a8c8d9e7f123456789abcdef01234567',
    kind: 34550,
    relays: ['wss://relay.example.com', 'wss://another-relay.example.com'],
  };

  describe('naddrEncode', () => {
    test('should encode valid AddressPointer to naddr', () => {
      const result = naddrEncode(validAddressPointer);
      
      expect(result).toMatch(/^naddr1[a-z0-9]+$/);
      expect(result.length).toBeGreaterThan(20);
    });

    test('should encode without relays', () => {
      const addrWithoutRelays: AddressPointer = {
        ...validAddressPointer,
        relays: undefined,
      };
      
      const result = naddrEncode(addrWithoutRelays);
      
      expect(result).toMatch(/^naddr1[a-z0-9]+$/);
    });

    test('should handle empty identifier', () => {
      const addrWithEmptyId: AddressPointer = {
        ...validAddressPointer,
        identifier: '',
      };
      
      expect(() => naddrEncode(addrWithEmptyId)).toThrow();
    });

    test('should handle invalid pubkey', () => {
      const addrWithInvalidPubkey: AddressPointer = {
        ...validAddressPointer,
        pubkey: 'invalid-pubkey',
      };
      
      expect(() => naddrEncode(addrWithInvalidPubkey)).toThrow();
    });

    test('should handle invalid kind', () => {
      const addrWithInvalidKind: AddressPointer = {
        ...validAddressPointer,
        kind: -1,
      };
      
      expect(() => naddrEncode(addrWithInvalidKind)).toThrow();
    });
  });

  describe('naddrDecode', () => {
    test('should decode valid naddr to AddressPointer', () => {
      const encoded = naddrEncode(validAddressPointer);
      const decoded = naddrDecode(encoded);
      
      expect(decoded.identifier).toBe(validAddressPointer.identifier);
      expect(decoded.pubkey).toBe(validAddressPointer.pubkey);
      expect(decoded.kind).toBe(validAddressPointer.kind);
      expect(decoded.relays).toEqual(validAddressPointer.relays);
    });

    test('should handle naddr without relays', () => {
      const addrWithoutRelays: AddressPointer = {
        ...validAddressPointer,
        relays: undefined,
      };
      const encoded = naddrEncode(addrWithoutRelays);
      const decoded = naddrDecode(encoded);
      
      expect(decoded.identifier).toBe(addrWithoutRelays.identifier);
      expect(decoded.pubkey).toBe(addrWithoutRelays.pubkey);
      expect(decoded.kind).toBe(addrWithoutRelays.kind);
      expect(decoded.relays).toEqual([]);
    });

    test('should throw error for invalid naddr format', () => {
      expect(() => naddrDecode('invalid-naddr')).toThrow();
      expect(() => naddrDecode('npub1234')).toThrow();
      expect(() => naddrDecode('')).toThrow();
    });

    test('should throw error for malformed naddr', () => {
      expect(() => naddrDecode('naddr1invalid')).toThrow();
    });
  });

  describe('parseNaddrFromUrl', () => {
    test('should parse valid naddr from URL', () => {
      const encoded = naddrEncode(validAddressPointer);
      const result = parseNaddrFromUrl(encoded);
      
      expect(result).not.toBeNull();
      expect(result?.identifier).toBe(validAddressPointer.identifier);
      expect(result?.pubkey).toBe(validAddressPointer.pubkey);
      expect(result?.kind).toBe(validAddressPointer.kind);
    });

    test('should return null for invalid naddr in URL', () => {
      expect(parseNaddrFromUrl('invalid')).toBeNull();
      expect(parseNaddrFromUrl('')).toBeNull();
      expect(parseNaddrFromUrl('npub1234')).toBeNull();
    });

    test('should handle URL with query parameters', () => {
      const encoded = naddrEncode(validAddressPointer);
      const urlWithQuery = `${encoded}?tab=main&page=1`;
      const result = parseNaddrFromUrl(urlWithQuery);
      
      expect(result).not.toBeNull();
      expect(result?.identifier).toBe(validAddressPointer.identifier);
    });
  });

  describe('buildNaddrFromDiscussion', () => {
    const mockDiscussion = {
      id: '34550:f723816e33f9e4ed5e3b4c3b2c99e8b8a8c8d9e7f123456789abcdef01234567:bus-stop-chat',
      dTag: 'bus-stop-chat',
      title: 'バス停での体験',
      description: 'バス停での利用体験について',
      moderators: [],
      authorPubkey: 'f723816e33f9e4ed5e3b4c3b2c99e8b8a8c8d9e7f123456789abcdef01234567',
      createdAt: 1640995200,
      event: {} as any,
    };

    test('should build naddr from Discussion object', () => {
      const result = buildNaddrFromDiscussion(mockDiscussion);
      
      expect(result).toMatch(/^naddr1[a-z0-9]+$/);
      
      const decoded = naddrDecode(result);
      expect(decoded.identifier).toBe(mockDiscussion.dTag);
      expect(decoded.pubkey).toBe(mockDiscussion.authorPubkey);
      expect(decoded.kind).toBe(34550);
    });

    test('should include relays when provided', () => {
      const discussionWithRelays = {
        ...mockDiscussion,
        relays: ['wss://relay.example.com'],
      };
      
      const result = buildNaddrFromDiscussion(discussionWithRelays);
      const decoded = naddrDecode(result);
      
      expect(decoded.relays).toEqual(['wss://relay.example.com']);
    });
  });

  describe('extractDiscussionFromNaddr', () => {
    test('should extract discussion info from naddr', () => {
      const naddr = naddrEncode(validAddressPointer);
      const result = extractDiscussionFromNaddr(naddr);
      
      expect(result).not.toBeNull();
      expect(result?.dTag).toBe(validAddressPointer.identifier);
      expect(result?.authorPubkey).toBe(validAddressPointer.pubkey);
      expect(result?.discussionId).toBe(`34550:${validAddressPointer.pubkey}:${validAddressPointer.identifier}`);
    });

    test('should return null for invalid naddr', () => {
      expect(extractDiscussionFromNaddr('invalid')).toBeNull();
      expect(extractDiscussionFromNaddr('')).toBeNull();
    });

    test('should return null for non-discussion kind', () => {
      const nonDiscussionAddr: AddressPointer = {
        ...validAddressPointer,
        kind: 1111, // not 34550
      };
      
      const naddr = naddrEncode(nonDiscussionAddr);
      const result = extractDiscussionFromNaddr(naddr);
      
      expect(result).toBeNull();
    });
  });

  describe('round-trip consistency', () => {
    test('should maintain data integrity through encode/decode cycle', () => {
      const original = validAddressPointer;
      const encoded = naddrEncode(original);
      const decoded = naddrDecode(encoded);
      
      expect(decoded.identifier).toBe(original.identifier);
      expect(decoded.pubkey).toBe(original.pubkey);
      expect(decoded.kind).toBe(original.kind);
      expect(decoded.relays).toEqual(original.relays);
    });

    test('should work with Japanese identifiers', () => {
      const japaneseAddr: AddressPointer = {
        identifier: 'バス停-chat',
        pubkey: validAddressPointer.pubkey,
        kind: 34550,
        relays: ['wss://relay.example.com'],
      };
      
      const encoded = naddrEncode(japaneseAddr);
      const decoded = naddrDecode(encoded);
      
      expect(decoded.identifier).toBe(japaneseAddr.identifier);
    });

    test('should work with multiple relays', () => {
      const multiRelayAddr: AddressPointer = {
        ...validAddressPointer,
        relays: [
          'wss://relay1.example.com',
          'wss://relay2.example.com',
          'wss://relay3.example.com',
        ],
      };
      
      const encoded = naddrEncode(multiRelayAddr);
      const decoded = naddrDecode(encoded);
      
      expect(decoded.relays).toEqual(multiRelayAddr.relays);
    });
  });

  describe('edge cases', () => {
    test('should handle very long identifiers', () => {
      const longIdentifier = 'a'.repeat(100);
      const addr: AddressPointer = {
        ...validAddressPointer,
        identifier: longIdentifier,
      };
      
      const encoded = naddrEncode(addr);
      const decoded = naddrDecode(encoded);
      
      expect(decoded.identifier).toBe(longIdentifier);
    });

    test('should handle special characters in identifier', () => {
      const specialCharAddr: AddressPointer = {
        ...validAddressPointer,
        identifier: 'test-chat_2024.01',
      };
      
      const encoded = naddrEncode(specialCharAddr);
      const decoded = naddrDecode(encoded);
      
      expect(decoded.identifier).toBe(specialCharAddr.identifier);
    });

    test('should handle different discussion kinds', () => {
      const differentKindAddr: AddressPointer = {
        ...validAddressPointer,
        kind: 30023, // different kind
      };
      
      const encoded = naddrEncode(differentKindAddr);
      const decoded = naddrDecode(encoded);
      
      expect(decoded.kind).toBe(30023);
    });
  });
});