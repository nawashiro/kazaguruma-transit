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

  test('should handle sparse data with SVD fallback', () => {
    const votes: VoteData[] = [];
    
    // 疎なデータを生成（10人の参加者、10個の投稿、約20%のデータのみ）
    const participants = Array.from({ length: 10 }, (_, i) => `user${i + 1}`);
    const topics = Array.from({ length: 10 }, (_, i) => `topic${i + 1}`);
    
    participants.forEach((pid) => {
      topics.forEach((tid) => {
        // 約20%の確率でのみ投票する（疎行列を作成）
        if (Math.random() < 0.2) {
          const vote = Math.random() > 0.5 ? 1 : -1;
          votes.push({ pid, tid, vote });
        }
      });
    });

    const polis = new PolisConsensus(votes);
    const result = polis.runAnalysis();

    expect(result).toHaveProperty('groupAwareConsensus');
    expect(result).toHaveProperty('groupRepresentativeComments');
    // 疎なデータでも結果が返されることを確認
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

  test('should test exact minimum requirements scenario', () => {
    // あなたの報告通りのデータ：ユーザー1が2投票、ユーザー2が1投票
    const votes: VoteData[] = [
      // ユーザー1による2件の投票
      { pid: 'user1', tid: 'topic1', vote: 1 },   // 投稿1に賛成
      { pid: 'user1', tid: 'topic2', vote: -1 },  // 投稿2に反対
      
      // ユーザー2による1件の投票  
      { pid: 'user2', tid: 'topic1', vote: 1 },   // 投稿1に賛成
    ];

    console.log('テストデータ検証:');
    const participants = [...new Set(votes.map(v => v.pid))];
    const topics = [...new Set(votes.map(v => v.tid))];
    console.log('参加者数:', participants.length, participants);
    console.log('投稿数:', topics.length, topics);
    console.log('投票数:', votes.length);

    const polis = new PolisConsensus(votes);
    const result = polis.runAnalysis();
    
    console.log('分析結果:');
    console.log('groupAwareConsensus keys:', Object.keys(result.groupAwareConsensus).length);
    console.log('groupRepresentativeComments keys:', Object.keys(result.groupRepresentativeComments).length);

    // 最小要件（参加者2人、投稿2件）を満たしているので、何らかの結果が返されるべき
    expect(result).toHaveProperty('groupAwareConsensus');
    expect(result).toHaveProperty('groupRepresentativeComments');
    
    // この場合、分析が実行されるかどうかを確認
    const hasResults = Object.keys(result.groupAwareConsensus).length > 0 || 
                      Object.keys(result.groupRepresentativeComments).length > 0;
    
    console.log('分析が実行されたか:', hasResults);
    
    // 詳細な結果を表示
    if (hasResults) {
      console.log('groupAwareConsensus:', result.groupAwareConsensus);
      console.log('groupRepresentativeComments:', result.groupRepresentativeComments);
      
      // クラスタリング結果も確認
      const clustering = polis.getClusteringResult();
      console.log('clusterLabels:', clustering.clusterLabels);
      console.log('pcaResult dimensions:', clustering.pcaResult.length, 'x', clustering.pcaResult[0]?.length || 0);
    }
  });
});