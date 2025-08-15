/**
 * テストデータローダー
 * public/test_data からテスト用のディスカッションデータを読み込む
 *
 * 注意: このファイルはテスト用途のみです
 */

import type {
  DiscussionPost,
  PostEvaluation,
  Discussion,
} from "@/types/discussion";
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
  const results: TestComment[] = [];
  let headers: string[] = [];
  let current = "";
  let inQuotes = false;
  let isFirstLine = true;
  let values: string[] = [];

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    
    if (char === '"') {
      if (inQuotes && i + 1 < csvText.length && csvText[i + 1] === '"') {
        // エスケープされた引用符
        current += '"';
        i++; // 次の引用符をスキップ
      } else {
        // 引用符の開始/終了
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      // フィールドの区切り
      values.push(current.trim());
      current = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      // 行の終了
      if (current.trim() || values.length > 0) {
        values.push(current.trim());
        
        if (isFirstLine) {
          headers = values;
          isFirstLine = false;
        } else {
          // データ行を処理
          const comment: any = {};
          headers.forEach((header, index) => {
            const cleanHeader = header.replace(/"/g, "").trim();
            const value = values[index]?.replace(/^"|"$/g, "").trim() || "";
            comment[cleanHeader] = value;
          });
          
          results.push(comment as TestComment);
        }
        
        values = [];
        current = "";
      }
    } else {
      current += char;
    }
  }

  // 最後の行を処理
  if (current.trim() || values.length > 0) {
    values.push(current.trim());
    if (!isFirstLine && values.length > 0) {
      const comment: any = {};
      headers.forEach((header, index) => {
        const cleanHeader = header.replace(/"/g, "").trim();
        const value = values[index]?.replace(/^"|"$/g, "").trim() || "";
        comment[cleanHeader] = value;
      });
      results.push(comment as TestComment);
    }
  }

  return results;
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
    const commentsResponse = await fetch("/test_data/comments.csv");
    if (!commentsResponse.ok) {
      throw new Error("Failed to load test comments");
    }
    const commentsText = await commentsResponse.text();
    const comments = parseTestCSV(commentsText);

    // 投票データを読み込み
    const votesResponse = await fetch("/test_data/votes.json");
    if (!votesResponse.ok) {
      throw new Error("Failed to load test votes");
    }
    const votes: TestVote[] = await votesResponse.json();

    // テスト用のディスカッションオブジェクトを作成
    const testDiscussion: Discussion = {
      id: "test-discussion-id",
      dTag: "test",
      title: "統計処理のテスト: AI生成物の著作権について",
      description:
        "意見グループを特定し、論点を抽出する統計処理のテストです。\n「意見グループ」セクションをご覧ください。\nAI生成物の著作権や依拠性について議論するテスト用データが書き込まれています。\n新たな書き込みや投票はできません。監査ログもなく、見ようとするとエラーが出るはずです。",
      authorPubkey: "test-admin-pubkey",
      moderators: [{ pubkey: "test-admin-pubkey" }],
      createdAt: Date.now() / 1000,
      event: {
        id: "test-discussion-event-id",
        pubkey: "test-admin-pubkey",
        created_at: Date.now() / 1000,
        kind: 1,
        tags: [["d", "test"]],
        content: "テスト討論: AI生成物の著作権について",
        sig: "test-signature",
      },
    };

    // コメントを投稿オブジェクトに変換
    const testPosts: DiscussionPost[] = comments.map((comment) => ({
      id: `test-post-${comment["comment-id"]}`,
      content: comment["comment-body"],
      authorPubkey: `test-author-${comment["author-id"]}`,
      discussionId: testDiscussion.id,
      busStopTag: undefined,
      createdAt: parseInt(comment.timestamp),
      approved: comment.moderated !== "-1",
      approvedBy: comment.moderated !== "-1" ? ["test-admin-pubkey"] : [],
      approvedAt:
        comment.moderated !== "-1"
          ? parseInt(comment.timestamp) + 3600
          : undefined,
      event: {
        id: `test-post-event-${comment["comment-id"]}`,
        pubkey: `test-author-${comment["author-id"]}`,
        created_at: parseInt(comment.timestamp),
        kind: 1,
        tags: [["e", testDiscussion.id]],
        content: comment["comment-body"],
        sig: "test-signature",
      },
    }));

    // 投票を評価オブジェクトに変換
    const testEvaluations: PostEvaluation[] = votes
      .map((vote, index) => ({
        id: `test-evaluation-${index}`,
        postId: `test-post-${vote.tid}`,
        evaluatorPubkey: `test-evaluator-${vote.pid}`,
        rating: vote.vote === 1 ? ("+" as const) : ("-" as const),
        discussionId: testDiscussion.id,
        createdAt: Date.now() / 1000,
        event: {
          id: `test-evaluation-event-${index}`,
          pubkey: `test-evaluator-${vote.pid}`,
          created_at: Date.now() / 1000,
          kind: 1,
          tags: [
            ["e", `test-post-${vote.tid}`],
            ["d", testDiscussion.id],
          ],
          content: vote.vote === 1 ? "+" : "-",
          sig: "test-signature",
        },
      }))
      .filter(
        (evaluation) => evaluation.rating === "+" || evaluation.rating === "-"
      );

    logger.log("Test data loaded successfully", {
      postsCount: testPosts.length,
      evaluationsCount: testEvaluations.length,
    });

    return {
      discussion: testDiscussion,
      posts: testPosts,
      evaluations: testEvaluations,
    };
  } catch (error) {
    logger.error("Failed to load test data:", error);
    throw error;
  }
}

/**
 * IDが"test"の場合にテストモードかどうかを判定
 */
export function isTestMode(discussionId: string): boolean {
  return discussionId === "a52957e8-b28f-4b43-b037-e6c4fd34ec6c";
}
