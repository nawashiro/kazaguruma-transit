/**
 * 評価サービス
 * Polisアルゴリズムを使用して投稿のコンセンサス分析を行う
 */

import { PolisConsensus, VoteData, ConsensusResult } from "./polis-consensus";
import type { PostEvaluation, DiscussionPost } from "@/types/discussion";
import { logger } from "@/utils/logger";

export interface GroupConsensusData {
  groupId: number;
  comments: Array<{
    postId: string;
    post: DiscussionPost;
    representativenessScore: number;
    zScore: number;
    pValue: number;
    voteType: "agree" | "disagree";
    agreeRatio: number;
    disagreeRatio: number;
  }>;
}

export interface EvaluationAnalysisResult {
  groupAwareConsensus: Array<{
    postId: string;
    post: DiscussionPost;
    consensusScore: number;
    overallAgreePercentage: number;
  }>;
  groupRepresentativeComments: GroupConsensusData[];
}

export class EvaluationService {
  /**
   * 評価データを投票データに変換
   */
  private convertEvaluationsToVotes(
    evaluations: PostEvaluation[],
    posts: DiscussionPost[]
  ): VoteData[] {
    const votes: VoteData[] = [];
    const postIds = new Set(posts.map((p) => p.id));

    // 評価データを投票データに変換
    for (const evaluation of evaluations) {
      // 投稿が存在する場合のみ処理
      if (postIds.has(evaluation.postId)) {
        votes.push({
          pid: evaluation.evaluatorPubkey,
          tid: evaluation.postId,
          vote: evaluation.rating === "+" ? 1 : -1,
        });
      }
    }

    return votes;
  }

  /**
   * コンセンサス分析を実行
   */
  public async analyzeConsensus(
    evaluations: PostEvaluation[],
    posts: DiscussionPost[]
  ): Promise<EvaluationAnalysisResult> {
    try {
      logger.log("コンセンサス分析開始", {
        evaluations: evaluations.length,
        totalPosts: posts.length,
      });

      // 承認された投稿のみを対象とする
      const approvedPosts = posts.filter((p) => p.approved);

      logger.log("データ検証", {
        approvedPosts: approvedPosts.length,
        evaluationsCount: evaluations.length,
      });

      // 評価データが不十分な場合は空の結果を返す
      if (evaluations.length < 5 || approvedPosts.length < 2) {
        logger.warn("データ不足のため分析をスキップ", {
          evaluations: evaluations.length,
          approvedPosts: approvedPosts.length,
          minRequired: { evaluations: 5, posts: 2 },
        });
        return {
          groupAwareConsensus: [],
          groupRepresentativeComments: [],
        };
      }

      // 承認された投稿の評価データのみを抽出
      const approvedPostIds = new Set(approvedPosts.map((p) => p.id));
      const approvedEvaluations = evaluations.filter((e) =>
        approvedPostIds.has(e.postId)
      );

      // 評価データを投票データに変換
      const votes = this.convertEvaluationsToVotes(
        approvedEvaluations,
        approvedPosts
      );

      logger.log("投票データ変換完了", {
        votesCount: votes.length,
        uniqueParticipants: new Set(votes.map((v) => v.pid)).size,
        uniqueTopics: new Set(votes.map((v) => v.tid)).size,
      });

      // 投票データが不十分な場合は空の結果を返す
      if (votes.length < 5) {
        logger.warn("投票データ不足", { votes: votes.length, minRequired: 5 });
        return {
          groupAwareConsensus: [],
          groupRepresentativeComments: [],
        };
      }

      // 最小参加者数・投稿数チェック
      const uniqueParticipants = new Set(votes.map((v) => v.pid)).size;
      const uniqueTopics = new Set(votes.map((v) => v.tid)).size;

      if (uniqueParticipants < 2 || uniqueTopics < 2) {
        logger.warn("ユニーク参加者または投稿数が不足", {
          uniqueParticipants,
          uniqueTopics,
          minRequired: { participants: 2, topics: 2 },
        });
        return {
          groupAwareConsensus: [],
          groupRepresentativeComments: [],
        };
      }

      // Polisコンセンサス分析を実行
      const polisConsensus = new PolisConsensus(votes);
      const result = await this.runPolisAnalysis(polisConsensus);

      // 投稿情報と結合
      const postMap = new Map(approvedPosts.map((p) => [p.id, p]));

      // グループ考慮型コンセンサス結果を処理
      const groupAwareConsensus = Object.entries(result.groupAwareConsensus)
        .map(([postId, consensusScore]) => {
          const post = postMap.get(postId)!;
          if (!post) return null;

          // 全体の賛成率を計算（承認された投稿の評価のみ）
          const postEvaluations = approvedEvaluations.filter(
            (e) => e.postId === postId
          );
          const totalVotes = postEvaluations.length;
          const agreeVotes = postEvaluations.filter(
            (e) => e.rating === "+"
          ).length;
          const overallAgreePercentage =
            totalVotes > 0 ? Math.round((agreeVotes / totalVotes) * 100) : 0;

          return {
            postId,
            post,
            consensusScore,
            overallAgreePercentage,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null) // 投稿が存在する場合のみ
        .sort((a, b) => b.consensusScore - a.consensusScore)
        .slice(0, 10); // 上位10件

      // グループの代表的意見を処理
      const groupRepresentativeComments: GroupConsensusData[] = [];

      for (const [groupIdStr, comments] of Object.entries(
        result.groupRepresentativeComments
      )) {
        const groupId = parseInt(groupIdStr, 10);
        const groupComments = comments
          .map((comment) => ({
            postId: comment.tid,
            post: postMap.get(comment.tid)!,
            representativenessScore: comment.reppnessScore,
            zScore: comment.zScore,
            pValue: comment.pValue,
            voteType: comment.voteType,
            agreeRatio: comment.agreeRatio,
            disagreeRatio: comment.disagreeRatio,
          }))
          .filter((item) => item.post) // 投稿が存在する場合のみ
          .slice(0, 5); // 各グループ上位5件

        if (groupComments.length > 0) {
          groupRepresentativeComments.push({
            groupId,
            comments: groupComments,
          });
        }
      }

      return {
        groupAwareConsensus,
        groupRepresentativeComments,
      };
    } catch (error) {
      logger.error("コンセンサス分析エラー:", error);
      return {
        groupAwareConsensus: [],
        groupRepresentativeComments: [],
      };
    }
  }

  /**
   * Polis分析を実行（非同期として扱う）
   */
  private async runPolisAnalysis(
    polisConsensus: PolisConsensus
  ): Promise<ConsensusResult> {
    return new Promise((resolve, reject) => {
      try {
        // Web Workerではなく、メインスレッドで実行
        // 重い処理の場合は、setTimeoutを使って分割実行することも可能
        const result = polisConsensus.runAnalysis();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 参加者のクラスタリング情報を取得
   */
  public async getParticipantClusters(
    evaluations: PostEvaluation[],
    posts: DiscussionPost[]
  ): Promise<Record<string, number>> {
    try {
      const approvedPosts = posts.filter((p) => p.approved);

      if (evaluations.length < 5 || approvedPosts.length < 2) {
        return {};
      }

      const votes = this.convertEvaluationsToVotes(evaluations, approvedPosts);

      if (votes.length < 5) {
        return {};
      }

      const polisConsensus = new PolisConsensus(votes);
      await this.runPolisAnalysis(polisConsensus);

      return polisConsensus.getParticipantClusters();
    } catch (error) {
      logger.error("参加者クラスタリング取得エラー:", error);
      return {};
    }
  }
}

// シングルトンインスタンス
export const evaluationService = new EvaluationService();
