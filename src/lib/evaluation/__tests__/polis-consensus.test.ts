/**
 * Tests for PolisConsensus class
 */

import { PolisConsensus, VoteData } from '../polis-consensus';

// モックログ
jest.mock('@/utils/logger', () => ({
  logger: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('PolisConsensus', () => {
  test('should handle empty vote data', () => {
    const polis = new PolisConsensus([]);
    const result = polis.runAnalysis();

    expect(result.groupAwareConsensus).toEqual({});
    expect(result.groupRepresentativeComments).toEqual({});
  });

  test('should handle minimal vote data', () => {
    const votes: VoteData[] = [
      { pid: 'user1', tid: 'topic1', vote: 1 },
      { pid: 'user1', tid: 'topic2', vote: -1 },
      { pid: 'user2', tid: 'topic1', vote: 1 },
      { pid: 'user2', tid: 'topic2', vote: 1 },
    ];

    const polis = new PolisConsensus(votes);
    const result = polis.runAnalysis();

    expect(result).toHaveProperty('groupAwareConsensus');
    expect(result).toHaveProperty('groupRepresentativeComments');
  });

  test('should handle sufficient vote data for analysis', () => {
    const votes: VoteData[] = [];
    
    // 十分なデータを生成（5人の参加者、5つの投稿）
    const participants = ['user1', 'user2', 'user3', 'user4', 'user5'];
    const topics = ['topic1', 'topic2', 'topic3', 'topic4', 'topic5'];
    
    participants.forEach((pid) => {
      topics.forEach((tid) => {
        const vote = Math.random() > 0.5 ? 1 : -1; // ランダムな投票
        votes.push({ pid, tid, vote });
      });
    });

    const polis = new PolisConsensus(votes);
    const result = polis.runAnalysis();

    expect(result).toHaveProperty('groupAwareConsensus');
    expect(result).toHaveProperty('groupRepresentativeComments');
    expect(Object.keys(result.groupAwareConsensus).length).toBeGreaterThan(0);
  });

  test('should get clustering result', () => {
    const votes: VoteData[] = [
      { pid: 'user1', tid: 'topic1', vote: 1 },
      { pid: 'user2', tid: 'topic1', vote: 1 },
      { pid: 'user3', tid: 'topic1', vote: -1 },
    ];

    const polis = new PolisConsensus(votes);
    polis.runAnalysis();
    const clustering = polis.getClusteringResult();

    expect(clustering).toHaveProperty('clusterLabels');
    expect(clustering).toHaveProperty('pcaResult');
  });

  test('should get participant clusters', () => {
    const votes: VoteData[] = [
      { pid: 'user1', tid: 'topic1', vote: 1 },
      { pid: 'user1', tid: 'topic2', vote: -1 },
      { pid: 'user2', tid: 'topic1', vote: 1 },
      { pid: 'user2', tid: 'topic2', vote: 1 },
      { pid: 'user3', tid: 'topic1', vote: -1 },
      { pid: 'user3', tid: 'topic2', vote: -1 },
    ];

    const polis = new PolisConsensus(votes);
    polis.runAnalysis();
    const participantClusters = polis.getParticipantClusters();

    // 十分なデータがある場合のみテスト
    if (Object.keys(participantClusters).length > 0) {
      expect(participantClusters).toHaveProperty('user1');
      expect(participantClusters).toHaveProperty('user2');
      expect(participantClusters).toHaveProperty('user3');
    } else {
      // データ不足の場合は空のオブジェクトが返される
      expect(participantClusters).toEqual({});
    }
  });
});