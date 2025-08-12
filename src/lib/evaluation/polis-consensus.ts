/**
 * Polis コンセンサス検出アルゴリズム実装
 * ML-JSライブラリを使用してPolisのコンセンサス検出を実装
 */

import { Matrix, SingularValueDecomposition } from "ml-matrix";
import { PCA } from "ml-pca";
import { kmeans } from "ml-kmeans";
import { logger } from "@/utils/logger";

export interface VoteData {
  pid: string; // 参加者ID
  tid: string; // 意見ID（投稿ID）
  vote: number; // 1: 賛成, -1: 反対, 0: パス
}

export interface GroupRepresentativeComment {
  tid: string;
  reppnessScore: number;
  zScore: number;
  pValue: number;
  voteType: "agree" | "disagree";
  agreeRatio: number;
  disagreeRatio: number;
}

export interface ConsensusResult {
  groupAwareConsensus: Record<string, number>;
  groupRepresentativeComments: Record<number, GroupRepresentativeComment[]>;
}

export interface ClusteringResult {
  clusterLabels: number[];
  pcaResult: number[][];
}

export class PolisConsensus {
  private voteMatrix: number[][] = [];
  private voteData: VoteData[] = [];
  private participantIds: string[] = [];
  private topicIds: string[] = [];
  private clusterLabels: number[] = [];
  private pcaResult: number[][] = [];

  constructor(votes: VoteData[]) {
    this.voteData = votes;
    this.preprocess();
  }

  private preprocess() {
    // データ検証
    if (!this.voteData || this.voteData.length === 0) {
      logger.warn("投票データが空です");
      this.participantIds = [];
      this.topicIds = [];
      this.voteMatrix = [];
      return;
    }

    // 参加者IDと意見IDのユニークリストを作成
    const participantSet = new Set(this.voteData.map((v) => v.pid));
    const topicSet = new Set(this.voteData.map((v) => v.tid));

    this.participantIds = Array.from(participantSet).filter(
      (pid) => pid && pid.length > 0
    );
    this.topicIds = Array.from(topicSet).filter((tid) => tid && tid.length > 0);

    // 最小要件の確認
    if (this.participantIds.length < 2 || this.topicIds.length < 2) {
      logger.warn("参加者または意見数が不足しています", {
        participants: this.participantIds.length,
        topics: this.topicIds.length,
      });
      this.voteMatrix = [];
      return;
    }

    // 評価行列を作成（参加者 × 意見）
    this.voteMatrix = this.participantIds.map((pid) => {
      return this.topicIds.map((tid) => {
        const vote = this.voteData.find((v) => v.pid === pid && v.tid === tid);
        return vote ? vote.vote : 0; // 欠損値は0（パス）
      });
    });

    logger.log("前処理完了:", {
      participants: this.participantIds.length,
      topics: this.topicIds.length,
      matrixSize: `${this.voteMatrix.length}x${
        this.voteMatrix[0]?.length || 0
      }`,
    });
  }

  /**
   * PCAによる次元削減を実行
   * 疎行列の場合はSVDフォールバックを使用
   */
  private runPCA(nComponents: number = 2): number[][] {
    // データ検証
    if (!this.voteMatrix || this.voteMatrix.length === 0) {
      logger.warn("投票行列が空です");
      return [];
    }

    if (this.voteMatrix[0].length === 0) {
      logger.warn("投票行列の次元が無効です");
      return [];
    }

    // 最小要件チェック
    if (
      this.voteMatrix.length < nComponents ||
      this.voteMatrix[0].length < nComponents
    ) {
      logger.warn("PCAに必要な最小データサイズが不足しています", {
        rows: this.voteMatrix.length,
        cols: this.voteMatrix[0].length,
        required: nComponents,
      });
      // 簡単な次元削減として最初のn列を返す
      return this.voteMatrix.map((row) =>
        row.slice(0, Math.min(nComponents, row.length))
      );
    }

    try {
      logger.log("PCA実行開始", {
        matrixShape: `${this.voteMatrix.length}x${this.voteMatrix[0].length}`,
        components: nComponents,
      });

      // データの有効性をチェック
      const validMatrix = this.voteMatrix.every(
        (row) =>
          Array.isArray(row) &&
          row.length === this.voteMatrix[0].length &&
          row.every((val) => typeof val === "number" && !isNaN(val))
      );

      if (!validMatrix) {
        throw new Error("投票行列に無効な値が含まれています");
      }

      // ml-matrixでMatrixオブジェクトを作成
      const matrix = new Matrix(this.voteMatrix);

      // データの疎密度を確認
      const totalElements = matrix.rows * matrix.columns;
      const nonZeroCount = this.voteMatrix.reduce(
        (count, row) => count + row.filter((val) => val !== 0).length,
        0
      );
      const sparsity = 1.0 - nonZeroCount / totalElements;

      logger.log("データ密度分析", {
        totalElements,
        nonZeroCount,
        sparsity: `${(sparsity * 100).toFixed(1)}%`,
      });

      // 疎行列の場合はSVDフォールバックを使用
      if (sparsity > 0.5) {
        logger.log("疎行列検出 - SVDフォールバックを使用");
        return this.runSVDFallback(matrix, nComponents);
      } else {
        // 密行列の場合は通常のPCAを使用
        logger.log("密行列 - 通常のPCAを使用");
        const pca = new PCA(matrix);
        const transformedMatrix = pca.predict(matrix, { nComponents });
        const result = transformedMatrix.to2DArray();

        logger.log("PCA実行成功", {
          inputShape: `${this.voteMatrix.length}x${this.voteMatrix[0].length}`,
          outputShape: `${result.length}x${result[0]?.length || 0}`,
        });

        return result;
      }
    } catch (error) {
      logger.error("PCA実行エラー:", error);
      logger.log("フォールバック: 元データの最初の列を使用");

      // エラー時は元データの最初のn列を返す
      return this.voteMatrix.map((row) => {
        const cols = Math.min(nComponents, row.length);
        const result = row.slice(0, cols);
        // 不足する次元をゼロで埋める
        while (result.length < nComponents) {
          result.push(0);
        }
        return result;
      });
    }
  }

  /**
   * SVDを使用した次元削減（疎行列用フォールバック）
   */
  private runSVDFallback(matrix: Matrix, nComponents: number): number[][] {
    try {
      // SVD分解を実行
      const svd = new SingularValueDecomposition(matrix, {
        computeLeftSingularVectors: true,
        computeRightSingularVectors: true,
      });

      // 左特異ベクトル（U行列）の最初のnComponents列を取得
      const leftVectors = svd.leftSingularVectors;
      const result: number[][] = [];

      // 各行について、最初のnComponents個の成分を取得
      for (let i = 0; i < leftVectors.rows; i++) {
        const row: number[] = [];
        for (let j = 0; j < Math.min(nComponents, leftVectors.columns); j++) {
          row.push(leftVectors.get(i, j));
        }
        // 不足する次元をゼロで埋める
        while (row.length < nComponents) {
          row.push(0);
        }
        result.push(row);
      }

      logger.log("SVDフォールバック実行成功", {
        inputShape: `${matrix.rows}x${matrix.columns}`,
        outputShape: `${result.length}x${result[0]?.length || 0}`,
        rank: svd.rank,
        condition: svd.condition,
      });

      return result;
    } catch (svdError) {
      logger.error("SVDフォールバック実行エラー:", svdError);

      // SVDも失敗した場合は、元データの最初のn列を返す
      const result = this.voteMatrix.map((row) => {
        const cols = Math.min(nComponents, row.length);
        const resultRow = row.slice(0, cols);
        while (resultRow.length < nComponents) {
          resultRow.push(0);
        }
        return resultRow;
      });

      logger.log("最終フォールバック: 元データの最初の列を使用");
      return result;
    }
  }

  /**
   * K-meansクラスタリングを実行
   */
  private runClustering(
    data: number[][],
    maxClusters: number = 10
  ): ClusteringResult {
    // データ検証
    if (!data || data.length === 0) {
      logger.warn("クラスタリング用データが空です");
      return { clusterLabels: [], pcaResult: [] };
    }

    // データポイント数が少なすぎる場合は全て同じクラスタに分類
    if (data.length < 3) {
      logger.warn("データポイント数が不足しています - 単一クラスタに分類", {
        dataPoints: data.length,
        required: 3,
      });
      return {
        clusterLabels: new Array(data.length).fill(0),
        pcaResult: data,
      };
    }

    try {
      logger.log("クラスタリング実行開始", {
        dataPoints: data.length,
        dimensions: data[0]?.length || 0,
        maxClusters,
      });

      // データの有効性をチェック
      const validData = data.every(
        (row) =>
          Array.isArray(row) &&
          row.length === data[0].length &&
          row.every(
            (val) => typeof val === "number" && !isNaN(val) && isFinite(val)
          )
      );

      if (!validData) {
        throw new Error("クラスタリング用データに無効な値が含まれています");
      }

      // 最適なクラスタ数を決定（参加者数の1/12 + 2に制限）
      const maxK = Math.min(
        maxClusters,
        2 + Math.floor(data.length / 12),
        data.length
      );
      const kRange = Array.from(
        { length: Math.max(1, maxK - 1) },
        (_, i) => i + 2
      );

      let bestK = 2;
      let bestScore = -1;

      // シルエットスコアに基づいて最適なクラスタ数を決定
      for (const k of kRange) {
        if (k > data.length) continue; // クラスタ数がデータポイント数を超えないように

        try {
          // ml-kmeansを使用
          const result = kmeans(data, k, {
            maxIterations: 100,
            tolerance: 1e-6,
          });
          const labels = result.clusters;

          // 簡単なシルエットスコアの近似計算
          const score = this.calculateSimpleClusterScore(data, labels, k);

          if (score > bestScore) {
            bestScore = score;
            bestK = k;
          }
        } catch (error) {
          logger.warn(`K=${k}でのクラスタリングに失敗:`, error);
          continue;
        }
      }

      logger.log("最適なクラスタ数決定:", bestK);

      // 最適なクラスタ数でK-meansを実行
      const result = kmeans(data, bestK, {
        maxIterations: 100,
        tolerance: 1e-6,
      });
      const labels = result.clusters;

      logger.log("クラスタリング実行成功", {
        clusters: bestK,
        labelDistribution: this.getClusterDistribution(labels),
      });

      return {
        clusterLabels: labels,
        pcaResult: data,
      };
    } catch (error) {
      logger.error("クラスタリング実行エラー:", error);
      logger.log("フォールバック: 全データを単一クラスタに分類");

      // エラー時はすべて同じクラスタに分類
      return {
        clusterLabels: new Array(data.length).fill(0),
        pcaResult: data,
      };
    }
  }

  /**
   * クラスタ分布を取得（デバッグ用）
   */
  private getClusterDistribution(labels: number[]): Record<number, number> {
    const distribution: Record<number, number> = {};
    for (const label of labels) {
      distribution[label] = (distribution[label] || 0) + 1;
    }
    return distribution;
  }

  /**
   * 簡単なクラスター品質スコア計算
   */
  private calculateSimpleClusterScore(
    data: number[][],
    labels: number[],
    k: number
  ): number {
    if (k === 1) return 0;

    // クラスタ内分散とクラスタ間分散の比を計算
    let totalWithinVariance = 0;
    let totalBetweenVariance = 0;

    for (let cluster = 0; cluster < k; cluster++) {
      const clusterPoints = data.filter((_, i) => labels[i] === cluster);
      if (clusterPoints.length <= 1) continue;

      // クラスタ内分散を計算
      const centroid = this.calculateCentroid(clusterPoints);
      const withinVariance =
        clusterPoints.reduce(
          (sum, point) => sum + this.euclideanDistance(point, centroid) ** 2,
          0
        ) / clusterPoints.length;

      totalWithinVariance += withinVariance;
    }

    // 全体の中心を計算
    const globalCentroid = this.calculateCentroid(data);

    // クラスタ間分散を計算
    for (let cluster = 0; cluster < k; cluster++) {
      const clusterPoints = data.filter((_, i) => labels[i] === cluster);
      if (clusterPoints.length === 0) continue;

      const centroid = this.calculateCentroid(clusterPoints);
      const betweenVariance =
        this.euclideanDistance(centroid, globalCentroid) ** 2;
      totalBetweenVariance += betweenVariance * clusterPoints.length;
    }

    totalBetweenVariance /= data.length;

    return totalWithinVariance > 0
      ? totalBetweenVariance / totalWithinVariance
      : 0;
  }

  private calculateCentroid(points: number[][]): number[] {
    if (points.length === 0) return [];

    const dimensions = points[0].length;
    const centroid = new Array(dimensions).fill(0);

    for (const point of points) {
      for (let i = 0; i < dimensions; i++) {
        centroid[i] += point[i];
      }
    }

    return centroid.map((sum) => sum / points.length);
  }

  private euclideanDistance(a: number[], b: number[]): number {
    return Math.sqrt(a.reduce((sum, val, i) => sum + (val - b[i]) ** 2, 0));
  }

  /**
   * 代表性分析を実行
   */
  private computeRepresentativeness(): Record<string, Record<string, number>> {
    const results: Record<string, Record<string, number>> = {};

    const uniqueClusters = Array.from(new Set(this.clusterLabels));

    for (let tidIndex = 0; tidIndex < this.topicIds.length; tidIndex++) {
      const tid = this.topicIds[tidIndex];

      for (const cluster of uniqueClusters) {
        const clusterIndices = this.clusterLabels
          .map((label, i) => (label === cluster ? i : -1))
          .filter((i) => i >= 0);
        const otherIndices = this.clusterLabels
          .map((label, i) => (label !== cluster ? i : -1))
          .filter((i) => i >= 0);

        if (clusterIndices.length === 0 || otherIndices.length === 0) continue;

        // クラスタ内の賛成・反対の比率
        const clusterVotes = clusterIndices.map(
          (i) => this.voteMatrix[i][tidIndex]
        );
        const agreeRatio =
          clusterVotes.filter((v) => v === 1).length / clusterVotes.length;
        const disagreeRatio =
          clusterVotes.filter((v) => v === -1).length / clusterVotes.length;

        // 他のクラスタでの賛成・反対の比率
        const otherVotes = otherIndices.map(
          (i) => this.voteMatrix[i][tidIndex]
        );
        const otherAgreeRatio =
          otherVotes.filter((v) => v === 1).length / otherVotes.length;
        const otherDisagreeRatio =
          otherVotes.filter((v) => v === -1).length / otherVotes.length;

        // 比率の差の統計的有意性テスト（簡易版）
        const agreeCount = clusterVotes.filter((v) => v === 1).length;
        const otherAgreeCount = otherVotes.filter((v) => v === 1).length;

        // 適切な統計的検定を選択してp値を計算
        const pAgree = this.calculateStatisticalTestPValue(
          agreeCount,
          clusterVotes.length,
          otherAgreeCount,
          otherVotes.length
        );

        const disagreeCount = clusterVotes.filter((v) => v === -1).length;
        const otherDisagreeCount = otherVotes.filter((v) => v === -1).length;

        const pDisagree = this.calculateStatisticalTestPValue(
          disagreeCount,
          clusterVotes.length,
          otherDisagreeCount,
          otherVotes.length
        );

        // 代表性スコアの計算
        const repnessAgree = agreeRatio - otherAgreeRatio;
        const repnessDisagree = disagreeRatio - otherDisagreeRatio;

        // 統計的有意性を考慮した代表性スコア
        const repnessScoreAgree = repnessAgree * (1 - pAgree);
        const repnessScoreDisagree = repnessDisagree * (1 - pDisagree);

        const key = `${cluster}-${tid}`;
        results[key] = {
          agreeRatio,
          disagreeRatio,
          repnessAgree: repnessScoreAgree,
          repnessDisagree: repnessScoreDisagree,
          pAgree,
          pDisagree,
        };
      }
    }

    return results;
  }

  /**
   * 適切な統計的検定を選択してp値を計算
   * 標本サイズや計算量を考慮してZ検定またはFisher正確確率検定を選択
   */
  private calculateStatisticalTestPValue(
    x1: number,
    n1: number,
    x2: number,
    n2: number
  ): number {
    if (n1 === 0 || n2 === 0) return 1.0;

    const totalN = n1 + n2;
    const expectedFrequencies = [
      ((x1 + (n2 - x2)) * n1) / totalN, // グループ1の期待成功数
      ((n1 - x1 + x2) * n1) / totalN, // グループ1の期待失敗数
      ((x1 + (n2 - x2)) * n2) / totalN, // グループ2の期待成功数
      ((n1 - x1 + x2) * n2) / totalN, // グループ2の期待失敗数
    ];

    // Fisher正確確率検定の条件判定
    // 1. 標本サイズが小さい（合計30未満）
    // 2. 期待度数が5未満のセルがある
    // 3. 計算量制限（総数100以下でクライアント側実行を考慮）
    const hasSmallExpectedFreq = expectedFrequencies.some((freq) => freq < 5);
    const isSmallSample = totalN < 30;
    const isComputationallyFeasible = totalN <= 100;

    if ((isSmallSample || hasSmallExpectedFreq) && isComputationallyFeasible) {
      // Fisher正確確率検定を使用
      const a = x1;
      const b = n1 - x1;
      const c = n2 - x2;
      const d = x2;

      const p = this.calculateFisherExactTestPValue(a, b, c, d);

      logger.log("Fisher正確確率検定を使用", {
        in: {
          x1: x1,
          n1: n1,
          x2: x2,
          n2: n2,
        },
        out: { p: p },
      });

      return p;
    } else {
      // Z検定（正規近似）を使用
      const p = this.calculateZTestPValue(x1, n1, x2, n2);

      logger.log("Z検定（正規近似）を使用", {
        in: {
          x1: x1,
          n1: n1,
          x2: x2,
          n2: n2,
        },
        out: { p: p },
      });

      return p;
    }
  }

  /**
   * Z検定のp値を計算（簡易版）
   */
  private calculateZTestPValue(
    x1: number,
    n1: number,
    x2: number,
    n2: number
  ): number {
    if (n1 === 0 || n2 === 0) return 1.0;

    const p1 = x1 / n1;
    const p2 = x2 / n2;
    const pPooled = (x1 + x2) / (n1 + n2);

    if (pPooled === 0 || pPooled === 1) return 1.0;

    const se = Math.sqrt(pPooled * (1 - pPooled) * (1 / n1 + 1 / n2));
    const z = Math.abs(p1 - p2) / se;

    // 標準正規分布のCDF近似
    return 2 * (1 - this.normalCDF(z));
  }

  /**
   * 標準正規分布の累積分布関数の近似
   */
  private normalCDF(x: number): number {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp((-x * x) / 2);
    const prob =
      d *
      t *
      (0.3193815 +
        t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));

    return x > 0 ? 1 - prob : prob;
  }

  /**
   * Fisher正確確率検定のp値を計算
   */
  private calculateFisherExactTestPValue(
    a: number,
    b: number,
    c: number,
    d: number
  ): number {
    if (a < 0 || b < 0 || c < 0 || d < 0) return 1.0;

    // 2x2分割表:
    //      成功  失敗  合計
    // グループ1  a     b    a+b
    // グループ2  c     d    c+d
    // 合計    a+c   b+d    n

    const n = a + b + c + d;
    if (n === 0) return 1.0;

    const n1 = a + b;
    const n2 = c + d;
    const k1 = a + c;

    // 観測値のhypergeometric確率を計算
    const observedProb = this.hypergeometricProbability(a, n1, k1, n);

    // より極端な場合の確率を合計（両側検定）
    let pValue = 0;

    // 可能な全てのa値について確率を計算
    const maxA = Math.min(n1, k1);
    const minA = Math.max(0, k1 - n2);

    for (let testA = minA; testA <= maxA; testA++) {
      const testB = n1 - testA;
      const testC = k1 - testA;
      const testD = n2 - testC;

      if (testB >= 0 && testC >= 0 && testD >= 0) {
        const testProb = this.hypergeometricProbability(testA, n1, k1, n);

        // 観測値と同等またはより極端な場合を合計
        if (testProb <= observedProb) {
          pValue += testProb;
        }
      }
    }

    return Math.min(pValue, 1.0);
  }

  /**
   * 超幾何分布の確率を計算
   */
  private hypergeometricProbability(
    k: number,
    n: number,
    K: number,
    N: number
  ): number {
    if (k > n || k > K || n > N || K > N) return 0;
    if (k < 0 || k < K - (N - n)) return 0;

    // P(X = k) = C(K,k) * C(N-K,n-k) / C(N,n)
    const numerator =
      this.logCombination(K, k) + this.logCombination(N - K, n - k);
    const denominator = this.logCombination(N, n);

    return Math.exp(numerator - denominator);
  }

  /**
   * 組み合わせの対数を計算（オーバーフロー対策）
   */
  private logCombination(n: number, k: number): number {
    if (k > n || k < 0) return -Infinity;
    if (k === 0 || k === n) return 0;

    k = Math.min(k, n - k); // 計算の効率化

    let result = 0;
    for (let i = 0; i < k; i++) {
      result += Math.log(n - i) - Math.log(i + 1);
    }

    return result;
  }

  /**
   * グループ考慮型コンセンサス検出
   */
  private detectGroupAwareConsensus(): Record<string, number> {
    const tidGidProbs: Record<string, Record<number, number>> = {};

    // 各コメントとグループの組み合わせについて賛成確率を計算
    for (let tidIndex = 0; tidIndex < this.topicIds.length; tidIndex++) {
      const tid = this.topicIds[tidIndex];
      tidGidProbs[tid] = {};

      const uniqueClusters = Array.from(new Set(this.clusterLabels));

      for (const gid of uniqueClusters) {
        const groupIndices = this.clusterLabels
          .map((label, i) => (label === gid ? i : -1))
          .filter((i) => i >= 0);

        if (groupIndices.length === 0) continue;

        // グループ内での投票を抽出
        const groupVotes = groupIndices
          .map((i) => this.voteMatrix[i][tidIndex])
          .filter((v) => v !== 0); // パス（0）は除外

        // 賛成数と投票総数を計算
        const A = groupVotes.filter((v) => v === 1).length;
        const S = groupVotes.length;

        // ベイジアンスムージングを適用した確率を計算
        const prob = S > 0 ? (A + 1.0) / (S + 2.0) : 0.5;
        tidGidProbs[tid][gid] = prob;
      }
    }

    // 各コメントについて、全グループの賛成確率の積を計算
    const tidConsensus: Record<string, number> = {};
    for (const [tid, gidProbs] of Object.entries(tidGidProbs)) {
      if (Object.keys(gidProbs).length > 0) {
        const productProb = Object.values(gidProbs).reduce(
          (prod, prob) => prod * prob,
          1
        );
        tidConsensus[tid] = productProb;
      }
    }

    return tidConsensus;
  }

  /**
   * 各グループの代表的意見を抽出（賛成・反対両方を考慮）
   */
  private getGroupRepresentativeComments(
    topN: number = 5,
    zThreshold: number = 1.28
  ): Record<number, GroupRepresentativeComment[]> {
    const repnessResults = this.computeRepresentativeness();
    const groupRepresentativeComments: Record<
      number,
      GroupRepresentativeComment[]
    > = {};

    const uniqueClusters = Array.from(new Set(this.clusterLabels));

    for (const cluster of uniqueClusters) {
      const clusterComments: GroupRepresentativeComment[] = [];

      for (const tid of this.topicIds) {
        const key = `${cluster}-${tid}`;
        const statsData = repnessResults[key];

        if (!statsData) continue;

        // 賛成と反対、どちらの代表性が高いかを判断
        const agreeScore = statsData.repnessAgree;
        const disagreeScore = statsData.repnessDisagree;

        let bestScore: number;
        let bestType: "agree" | "disagree";
        let bestPValue: number;

        if (agreeScore > disagreeScore) {
          bestScore = agreeScore;
          bestType = "agree";
          bestPValue = statsData.pAgree;
        } else {
          bestScore = disagreeScore;
          bestType = "disagree";
          bestPValue = statsData.pDisagree;
        }

        // Z値の近似計算
        const zScore =
          bestPValue > 0 ? this.inverseNormalCDF(1 - bestPValue) : 0;

        // 統計的に有意かつ代表性スコアが正の場合のみ追加
        if (zScore >= zThreshold && bestScore > 0) {
          clusterComments.push({
            tid,
            reppnessScore: bestScore,
            zScore,
            pValue: bestPValue,
            voteType: bestType,
            agreeRatio: statsData.agreeRatio,
            disagreeRatio: statsData.disagreeRatio,
          });
        }
      }

      // 代表性スコアで降順にソート
      clusterComments.sort((a, b) => b.reppnessScore - a.reppnessScore);

      // 上位N件を選択
      groupRepresentativeComments[cluster] = clusterComments.slice(0, topN);
    }

    return groupRepresentativeComments;
  }

  /**
   * 標準正規分布の逆累積分布関数の近似
   */
  private inverseNormalCDF(p: number): number {
    if (p <= 0 || p >= 1) return 0;

    // Beasley-Springer-Moro algorithm の簡易版
    const c = [2.515517, 0.802853, 0.010328];
    const d = [1.432788, 0.189269, 0.001308];

    let t, x;

    if (p > 0.5) {
      t = Math.sqrt(-2.0 * Math.log(1 - p));
      x =
        t -
        ((c[2] * t + c[1]) * t + c[0]) /
          (((d[2] * t + d[1]) * t + d[0]) * t + 1.0);
    } else {
      t = Math.sqrt(-2.0 * Math.log(p));
      x =
        -t +
        ((c[2] * t + c[1]) * t + c[0]) /
          (((d[2] * t + d[1]) * t + d[0]) * t + 1.0);
    }

    return x;
  }

  /**
   * 全体の分析を実行
   */
  public runAnalysis(): ConsensusResult {
    // データ不足の場合は空の結果を返す
    if (
      !this.voteMatrix ||
      this.voteMatrix.length === 0 ||
      this.participantIds.length < 2 ||
      this.topicIds.length < 2
    ) {
      logger.warn("データ不足のため分析をスキップします");
      return {
        groupAwareConsensus: {},
        groupRepresentativeComments: {},
      };
    }

    // PCAによる次元削減
    this.pcaResult = this.runPCA(2);

    // クラスタリング
    const clusteringResult = this.runClustering(this.pcaResult, 10);
    this.clusterLabels = clusteringResult.clusterLabels;

    // グループ考慮型コンセンサス検出
    const groupAwareConsensus = this.detectGroupAwareConsensus();

    // 各グループの代表的意見を抽出（賛成・反対両方）
    const groupRepresentativeComments = this.getGroupRepresentativeComments(
      5,
      1.28
    );

    return {
      groupAwareConsensus,
      groupRepresentativeComments,
    };
  }

  /**
   * クラスタリング結果を取得
   */
  public getClusteringResult(): ClusteringResult {
    return {
      clusterLabels: this.clusterLabels,
      pcaResult: this.pcaResult,
    };
  }

  /**
   * 参加者IDとクラスタのマッピングを取得
   */
  public getParticipantClusters(): Record<string, number> {
    const result: Record<string, number> = {};
    this.participantIds.forEach((pid, index) => {
      if (index < this.clusterLabels.length) {
        result[pid] = this.clusterLabels[index];
      }
    });
    return result;
  }
}
