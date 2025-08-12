/**
 * テストデータローダー
 * public/test_data からテスト用のディスカッションデータを読み込む
 * 
 * 注意: このファイルはテスト用途のみです
 */

import type { DiscussionPost, PostEvaluation, Discussion } from "@/types/discussion";
import { logger } from "@/utils/logger";

interface TestComment {
  timestamp: string;
  datetime: string;
  "comment-id": string;
  "author-id": string;
  agrees: string;
  disagrees: string;
  moderated: string;
  "comment-body": string;
}

interface TestVote {
  pid: string;
  tid: number;
  vote: number;
}

/**
 * テスト用CSVデータをパースする
 */
function parseTestCSV(csvText: string): TestComment[] {
  const lines = csvText.split('\n').filter(line => line.trim());
  const headers = lines[0].split(',');
  
  return lines.slice(1).map(line => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' && (i === 0 || line[i-1] === ',')) {
        inQuotes = true;
      } else if (char === '"' && inQuotes && (i === line.length - 1 || line[i+1] === ',')) {
        inQuotes = false;
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);
    
    const comment: any = {};
    headers.forEach((header, index) => {
      const cleanHeader = header.replace(/"/g, '');
      const value = values[index]?.replace(/"/g, '').replace(/^\s+|\s+$/g, '');
      comment[cleanHeader] = value;
    });
    
    return comment as TestComment;
  });
}

/**
 * テストデータを読み込む
 */
export async function loadTestData(): Promise<{
  discussion: Discussion;
  posts: DiscussionPost[];
  evaluations: PostEvaluation[];
}> {
  try {
    // コメントデータを読み込み
    const commentsResponse = await fetch('/test_data/comments.csv');
    if (!commentsResponse.ok) {
      throw new Error('Failed to load test comments');
    }
    const commentsText = await commentsResponse.text();
    const comments = parseTestCSV(commentsText);
    
    // 投票データを読み込み
    const votesResponse = await fetch('/test_data/votes.json');
    if (!votesResponse.ok) {
      throw new Error('Failed to load test votes');
    }
    const votes: TestVote[] = await votesResponse.json();
    
    // テスト用のディスカッションオブジェクトを作成
    const testDiscussion: Discussion = {
      id: 'test-discussion-id',
      dTag: 'test',
      title: 'テスト討論: AI生成物の著作権について',
      description: 'AI生成物の著作権や依拠性について議論するテスト用討論です。\nこれはデモンストレーション用のデータです。',
      authorPubkey: 'test-admin-pubkey',
      moderators: [
        { pubkey: 'test-admin-pubkey', role: 'admin' }
      ],
      createdAt: Date.now() / 1000,
      event: {
        id: 'test-discussion-event-id',
        pubkey: 'test-admin-pubkey',
        created_at: Date.now() / 1000,
        kind: 1,
        tags: [['d', 'test']],
        content: 'テスト討論: AI生成物の著作権について',
        sig: 'test-signature'
      }
    };
    
    // コメントを投稿オブジェクトに変換
    const testPosts: DiscussionPost[] = comments.map(comment => ({
      id: `test-post-${comment['comment-id']}`,
      content: comment['comment-body'],
      authorPubkey: `test-author-${comment['author-id']}`,
      discussionId: testDiscussion.id,
      busStopTag: undefined,
      createdAt: parseInt(comment.timestamp),
      approved: comment.moderated !== '-1',
      approvedBy: comment.moderated !== '-1' ? ['test-admin-pubkey'] : [],
      approvedAt: comment.moderated !== '-1' ? parseInt(comment.timestamp) + 3600 : undefined,
      event: {
        id: `test-post-event-${comment['comment-id']}`,
        pubkey: `test-author-${comment['author-id']}`,
        created_at: parseInt(comment.timestamp),
        kind: 1,
        tags: [['e', testDiscussion.id]],
        content: comment['comment-body'],
        sig: 'test-signature'
      }
    }));
    
    // 投票を評価オブジェクトに変換
    const testEvaluations: PostEvaluation[] = votes.map((vote, index) => ({
      id: `test-evaluation-${index}`,
      postId: `test-post-${vote.tid}`,
      evaluatorPubkey: `test-evaluator-${vote.pid}`,
      rating: vote.vote === 1 ? '+' as const : '-' as const,
      discussionId: testDiscussion.id,
      createdAt: Date.now() / 1000,
      event: {
        id: `test-evaluation-event-${index}`,
        pubkey: `test-evaluator-${vote.pid}`,
        created_at: Date.now() / 1000,
        kind: 1,
        tags: [
          ['e', `test-post-${vote.tid}`],
          ['d', testDiscussion.id]
        ],
        content: vote.vote === 1 ? '+' : '-',
        sig: 'test-signature'
      }
    })).filter(evaluation => evaluation.rating === '+' || evaluation.rating === '-');
    
    logger.log('Test data loaded successfully', {
      postsCount: testPosts.length,
      evaluationsCount: testEvaluations.length
    });
    
    return {
      discussion: testDiscussion,
      posts: testPosts,
      evaluations: testEvaluations
    };
    
  } catch (error) {
    logger.error('Failed to load test data:', error);
    throw error;
  }
}

/**
 * IDが"test"の場合にテストモードかどうかを判定
 */
export function isTestMode(discussionId: string): boolean {
  return discussionId === 'test';
}