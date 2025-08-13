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
  adjustedPValue: number;
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

          // 標準的なシルエットスコア計算
          const score = this.calculateSilhouetteScore(data, labels);

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
   * 適応的シルエットスコア計算（サンプルサイズに応じて最適化）
   */
  private calculateSilhouetteScore(data: number[][], labels: number[]): number {
    if (data.length === 0) return 0;

    const n = data.length;

    // 計算量に基づいて適応的に手法を選択
    // O(n²)の計算量制限: 200点以下は完全計算、それ以上は近似
    if (n <= 200) {
      return this.calculateFullSilhouetteScore(data, labels);
    } else {
      return this.calculateApproximateSilhouetteScore(data, labels);
    }
  }

  /**
   * 完全なシルエットスコア計算（小～中規模データ用）
   */
  private calculateFullSilhouetteScore(
    data: number[][],
    labels: number[]
  ): number {
    const n = data.length;
    let totalSilhouette = 0;

    // 各クラスタのサイズを計算
    const clusterSizes: Record<number, number> = {};
    for (const label of labels) {
      clusterSizes[label] = (clusterSizes[label] || 0) + 1;
    }

    // 各データポイントのシルエット値を計算
    for (let i = 0; i < n; i++) {
      const point = data[i];
      const cluster = labels[i];

      // クラスタサイズが1の場合、シルエット値は0
      if (clusterSizes[cluster] === 1) {
        continue;
      }

      // a(i): 同じクラスタ内の他の点との平均距離
      let aValue = 0;
      let sameClusterCount = 0;

      for (let j = 0; j < n; j++) {
        if (i !== j && labels[j] === cluster) {
          aValue += this.euclideanDistance(point, data[j]);
          sameClusterCount++;
        }
      }

      if (sameClusterCount > 0) {
        aValue /= sameClusterCount;
      }

      // b(i): 最も近い他のクラスタとの平均距離の最小値
      let bValue = Infinity;
      const otherClusters = Array.from(new Set(labels)).filter(
        (c) => c !== cluster
      );

      for (const otherCluster of otherClusters) {
        let otherClusterDistance = 0;
        let otherClusterCount = 0;

        for (let j = 0; j < n; j++) {
          if (labels[j] === otherCluster) {
            otherClusterDistance += this.euclideanDistance(point, data[j]);
            otherClusterCount++;
          }
        }

        if (otherClusterCount > 0) {
          const avgDistanceToOtherCluster =
            otherClusterDistance / otherClusterCount;
          bValue = Math.min(bValue, avgDistanceToOtherCluster);
        }
      }

      // シルエット値 s(i) = (b(i) - a(i)) / max(a(i), b(i))
      if (bValue !== Infinity) {
        const maxValue = Math.max(aValue, bValue);
        if (maxValue > 0) {
          const silhouetteValue = (bValue - aValue) / maxValue;
          totalSilhouette += silhouetteValue;
        }
      }
    }

    return totalSilhouette / n;
  }

  /**
   * 近似シルエットスコア計算（大規模データ用）
   * サンプリングベース近似とクラスタ重心近似を組み合わせ
   */
  private calculateApproximateSilhouetteScore(
    data: number[][],
    labels: number[]
  ): number {
    const n = data.length;

    // サンプリングサイズを動的に決定（√n、最小100、最大500）
    const sampleSize = Math.min(500, Math.max(100, Math.floor(Math.sqrt(n))));
    const sampleIndices = this.stratifiedSample(labels, sampleSize);

    let totalSilhouette = 0;
    let validSamples = 0;

    // クラスタ別の重心を事前計算（計算効率化）
    const clusterCentroids = this.calculateClusterCentroids(data, labels);
    const clusterSizes: Record<number, number> = {};

    for (const label of labels) {
      clusterSizes[label] = (clusterSizes[label] || 0) + 1;
    }

    for (const i of sampleIndices) {
      const point = data[i];
      const cluster = labels[i];

      if (clusterSizes[cluster] <= 1) continue;

      // a(i): 同一クラスタ重心との距離で近似
      const ownCentroid = clusterCentroids[cluster];
      const aValue = this.euclideanDistance(point, ownCentroid);

      // b(i): 最近傍クラスタ重心との距離
      let bValue = Infinity;
      for (const [otherCluster, centroid] of Object.entries(clusterCentroids)) {
        if (parseInt(otherCluster) !== cluster) {
          const distance = this.euclideanDistance(point, centroid);
          bValue = Math.min(bValue, distance);
        }
      }

      if (bValue !== Infinity && (aValue > 0 || bValue > 0)) {
        const maxValue = Math.max(aValue, bValue);
        if (maxValue > 0) {
          const silhouetteValue = (bValue - aValue) / maxValue;
          totalSilhouette += silhouetteValue;
          validSamples++;
        }
      }
    }

    return validSamples > 0 ? totalSilhouette / validSamples : 0;
  }

  /**
   * 層化サンプリング（各クラスタから比例的にサンプル）
   */
  private stratifiedSample(labels: number[], sampleSize: number): number[] {
    const clusterIndices: Record<number, number[]> = {};

    // クラスタ別にインデックスを分類
    labels.forEach((label, index) => {
      if (!clusterIndices[label]) {
        clusterIndices[label] = [];
      }
      clusterIndices[label].push(index);
    });

    const totalSize = labels.length;
    const sampleIndices: number[] = [];

    // 各クラスタから比例的にサンプリング
    for (const indices of Object.values(clusterIndices)) {
      const clusterProportion = indices.length / totalSize;
      const clusterSampleSize = Math.max(
        1,
        Math.floor(sampleSize * clusterProportion)
      );

      // ランダムサンプリング
      const shuffled = indices.sort(() => 0.5 - Math.random());
      sampleIndices.push(
        ...shuffled.slice(0, Math.min(clusterSampleSize, indices.length))
      );
    }

    // 目標サンプルサイズに調整
    if (sampleIndices.length < sampleSize) {
      const remaining = sampleSize - sampleIndices.length;
      const allIndices = Array.from({ length: labels.length }, (_, i) => i);
      const unusedIndices = allIndices.filter(
        (i) => !sampleIndices.includes(i)
      );
      const additionalSamples = unusedIndices
        .sort(() => 0.5 - Math.random())
        .slice(0, remaining);
      sampleIndices.push(...additionalSamples);
    }

    return sampleIndices.slice(0, sampleSize);
  }

  /**
   * クラスタ別重心計算
   */
  private calculateClusterCentroids(
    data: number[][],
    labels: number[]
  ): Record<number, number[]> {
    const centroids: Record<number, number[]> = {};
    const clusterSums: Record<number, number[]> = {};
    const clusterCounts: Record<number, number> = {};

    // クラスタ別の合計と個数を計算
    for (let i = 0; i < data.length; i++) {
      const cluster = labels[i];
      const point = data[i];

      if (!clusterSums[cluster]) {
        clusterSums[cluster] = new Array(point.length).fill(0);
        clusterCounts[cluster] = 0;
      }

      for (let j = 0; j < point.length; j++) {
        clusterSums[cluster][j] += point[j];
      }
      clusterCounts[cluster]++;
    }

    // 重心を計算
    for (const cluster in clusterSums) {
      const count = clusterCounts[cluster];
      centroids[cluster] = clusterSums[cluster].map((sum) => sum / count);
    }

    return centroids;
  }

  private euclideanDistance(a: number[], b: number[]): number {
    return Math.sqrt(a.reduce((sum, val, i) => sum + (val - b[i]) ** 2, 0));
  }

  /**
   * フィルタ前の標本に対してパーセンテージを計算
   */
  private calculateOriginalPercentages(): Record<
    string,
    { agreeRatio: number; disagreeRatio: number }
  > {
    const results: Record<
      string,
      { agreeRatio: number; disagreeRatio: number }
    > = {};
    const uniqueClusters = Array.from(new Set(this.clusterLabels));

    for (let tidIndex = 0; tidIndex < this.topicIds.length; tidIndex++) {
      const tid = this.topicIds[tidIndex];

      for (const cluster of uniqueClusters) {
        const clusterIndices = this.clusterLabels
          .map((label, i) => (label === cluster ? i : -1))
          .filter((i) => i >= 0);

        if (clusterIndices.length === 0) continue;

        // クラスタ内の全投票（フィルタ前）
        const clusterVotes = clusterIndices.map(
          (i) => this.voteMatrix[i][tidIndex]
        );

        // フィルタ前の標本に対するパーセンテージを計算
        const totalVotes = clusterVotes.length;
        const agreeCount = clusterVotes.filter((v) => v === 1).length;
        const disagreeCount = clusterVotes.filter((v) => v === -1).length;

        const agreeRatio = totalVotes > 0 ? agreeCount / totalVotes : 0;
        const disagreeRatio = totalVotes > 0 ? disagreeCount / totalVotes : 0;

        const key = `${cluster}-${tid}`;
        if (!results[key]) {
          results[key] = { agreeRatio: 0, disagreeRatio: 0 };
        }
        results[key] = { agreeRatio, disagreeRatio };
      }
    }

    return results;
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

        // Network Algorithm + mid-P値アプローチを使用してp値を計算
        const pAgree = this.calculateNetworkMidPValue(
          agreeCount,
          clusterVotes.length,
          otherAgreeCount,
          otherVotes.length
        );

        const disagreeCount = clusterVotes.filter((v) => v === -1).length;
        const otherDisagreeCount = otherVotes.filter((v) => v === -1).length;

        const pDisagree = this.calculateNetworkMidPValue(
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
   * Network Algorithm (Mehta & Patel, 1983) を使用したFisher正確検定の近似計算
   * 2x2分割表に対する効率的な確率計算を実行
   */
  private calculateNetworkAlgorithmPValue(
    a: number,
    b: number,
    c: number,
    d: number
  ): number {
    if (a < 0 || b < 0 || c < 0 || d < 0) return 1.0;

    const n = a + b + c + d;
    if (n === 0) return 1.0;

    const n1 = a + b; // 行1の合計
    const n2 = c + d; // 行2の合計
    const k1 = a + c; // 列1の合計

    // 観測値の対数確率を計算
    const observedLogProb = this.logHypergeometricProb(a, n1, k1, n);

    // Network Algorithmによる確率の累積計算
    let pValue = 0;

    // 可能なa値の範囲を計算
    const minA = Math.max(0, k1 - n2);
    const maxA = Math.min(n1, k1);

    // 各可能なa値について確率を計算し、観測値以下の確率を合計
    for (let testA = minA; testA <= maxA; testA++) {
      const testB = n1 - testA;
      const testC = k1 - testA;
      const testD = n2 - testC;

      if (testB >= 0 && testC >= 0 && testD >= 0) {
        const testLogProb = this.logHypergeometricProb(testA, n1, k1, n);

        // 観測値以下の確率値を選択（両側検定）
        if (testLogProb <= observedLogProb + 1e-12) {
          // 数値誤差を考慮
          pValue += Math.exp(testLogProb);
        }
      }
    }

    return Math.min(pValue, 1.0);
  }

  /**
   * 超幾何分布の対数確率を計算（オーバーフロー対策）
   * P(X = k) = C(K,k) * C(N-K,n-k) / C(N,n)
   */
  private logHypergeometricProb(
    k: number,
    n: number,
    K: number,
    N: number
  ): number {
    if (k > n || k > K || n > N || K > N) return -Infinity;
    if (k < 0 || k < K - (N - n)) return -Infinity;

    // log P(X = k) = log C(K,k) + log C(N-K,n-k) - log C(N,n)
    const numerator =
      this.logCombination(K, k) + this.logCombination(N - K, n - k);
    const denominator = this.logCombination(N, n);

    return numerator - denominator;
  }

  /**
   * Network Algorithm (Mehta & Patel, 1983) + mid-P値アプローチの組み合わせ
   * 効率的な確率計算と過度な保守性の緩和を同時に実現
   */
  private calculateNetworkMidPValue(
    x1: number,
    n1: number,
    x2: number,
    n2: number
  ): number {
    if (n1 === 0 || n2 === 0) return 1.0;

    // 2x2分割表の形式に変換
    const a = x1;
    const b = n1 - x1;
    const c = x2;
    const d = n2 - x2;

    if (a < 0 || b < 0 || c < 0 || d < 0) return 1.0;

    const n = a + b + c + d;
    if (n === 0) return 1.0;

    const n1Total = a + b; // 行1の合計
    const n2Total = c + d; // 行2の合計
    const k1 = a + c; // 列1の合計

    // Network Algorithmによる効率的な確率計算
    // 観測値の対数確率を計算
    const observedLogProb = this.logHypergeometricProb(a, n1Total, k1, n);
    const observedProb = Math.exp(observedLogProb);

    // Network Algorithmによる効率的な範囲計算と確率累積
    let extremePValue = 0;

    // 可能なa値の範囲を計算（Network Algorithm）
    const minA = Math.max(0, k1 - n2Total);
    const maxA = Math.min(n1Total, k1);

    // Network Algorithmによる効率的な確率累積
    for (let testA = minA; testA <= maxA; testA++) {
      const testB = n1Total - testA;
      const testC = k1 - testA;
      const testD = n2Total - testC;

      if (testB >= 0 && testC >= 0 && testD >= 0) {
        const testLogProb = this.logHypergeometricProb(testA, n1Total, k1, n);

        // Network Algorithmの効率的な確率比較
        // 観測値より極端（確率がより小さい）な場合を合計
        if (testLogProb < observedLogProb - 1e-12) {
          // 数値誤差を考慮
          extremePValue += Math.exp(testLogProb);
        }
      }
    }

    // mid-P値アプローチを適用してNetwork Algorithmの過度な保守性を緩和
    // mid-P = P(X < observed) + 0.5 * P(X = observed)
    const networkMidPValue = extremePValue + 0.5 * observedProb;

    logger.log("Network Algorithm + mid-P値を使用", {
      in: { x1, n1, x2, n2 },
      contingencyTable: { a, b, c, d },
      networkAlgorithm: {
        observedProb,
        extremePValue,
        totalRange: maxA - minA + 1,
      },
      out: { networkMidPValue },
    });

    return Math.min(networkMidPValue, 1.0);
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

        // Jeffreys事前分布ベースのベイジアン平滑化を適用した確率を計算
        // Beta(0.5, 0.5)事前分布（Jeffreys事前分布）を使用
        const prob = S > 0 ? (A + 0.5) / (S + 1.0) : 0.5;
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
   * Benjamini-Hochberg法による多重比較補正を適用
   */
  private getGroupRepresentativeComments(
    topN: number = 5,
    fdrAlpha: number = 0.05
  ): Record<number, GroupRepresentativeComment[]> {
    const repnessResults = this.computeRepresentativeness();
    const originalPercentages = this.calculateOriginalPercentages();
    const groupRepresentativeComments: Record<
      number,
      GroupRepresentativeComment[]
    > = {};

    const uniqueClusters = Array.from(new Set(this.clusterLabels));

    // 全てのp値を収集（多重比較補正のため）
    const allPValues: number[] = [];
    const pValueMappings: {
      cluster: number;
      tid: string;
      type: "agree" | "disagree";
      pValue: number;
      adjustedPValue?: number;
    }[] = [];

    for (const cluster of uniqueClusters) {
      for (const tid of this.topicIds) {
        const key = `${cluster}-${tid}`;
        const statsData = repnessResults[key];

        if (!statsData) continue;

        // 賛成と反対の両方のp値を追加
        allPValues.push(statsData.pAgree);
        pValueMappings.push({
          cluster,
          tid,
          type: "agree",
          pValue: statsData.pAgree,
        });

        allPValues.push(statsData.pDisagree);
        pValueMappings.push({
          cluster,
          tid,
          type: "disagree",
          pValue: statsData.pDisagree,
        });
      }
    }

    // Benjamini-Hochberg法を適用
    const adjustedPValues = this.benjaminiHochbergCorrection(allPValues);

    // 調整済みp値をマッピングに追加
    pValueMappings.forEach((mapping, index) => {
      mapping.adjustedPValue = adjustedPValues[index];
    });

    // 各クラスタについて代表的コメントを抽出
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
        let bestAdjustedPValue: number;

        // 対応する調整済みp値を取得
        const agreeMapping = pValueMappings.find(
          (m) => m.cluster === cluster && m.tid === tid && m.type === "agree"
        );
        const disagreeMapping = pValueMappings.find(
          (m) => m.cluster === cluster && m.tid === tid && m.type === "disagree"
        );

        if (agreeScore > disagreeScore) {
          bestScore = agreeScore;
          bestType = "agree";
          bestPValue = statsData.pAgree;
          bestAdjustedPValue = agreeMapping?.adjustedPValue || 1.0;
        } else {
          bestScore = disagreeScore;
          bestType = "disagree";
          bestPValue = statsData.pDisagree;
          bestAdjustedPValue = disagreeMapping?.adjustedPValue || 1.0;
        }

        // Z値の近似計算（調整済みp値を使用）
        const zScore =
          bestAdjustedPValue > 0
            ? this.inverseNormalCDF(1 - bestAdjustedPValue)
            : 0;

        // FDR制御済みp値が有意かつ代表性スコアが正の場合のみ追加
        if (bestAdjustedPValue < fdrAlpha && bestScore > 0) {
          // フィルタ前の標本に対するパーセンテージを使用
          const originalPercentage = originalPercentages[key];
          const displayAgreeRatio = originalPercentage?.agreeRatio || 0;
          const displayDisagreeRatio = originalPercentage?.disagreeRatio || 0;

          logger.log({
            bestAdjustedPValue,
            bestPValue,
            displayAgreeRatio,
            displayDisagreeRatio,
          });

          clusterComments.push({
            tid,
            reppnessScore: bestScore,
            zScore,
            pValue: bestPValue,
            adjustedPValue: bestAdjustedPValue,
            voteType: bestType,
            agreeRatio: displayAgreeRatio,
            disagreeRatio: displayDisagreeRatio,
          });
        }
      }

      // 代表性スコアで降順にソート
      clusterComments.sort((a, b) => b.reppnessScore - a.reppnessScore);

      // 上位N件を選択
      groupRepresentativeComments[cluster] = clusterComments.slice(0, topN);
    }

    logger.log("多重比較補正適用完了", {
      totalTests: allPValues.length,
      significantAfterCorrection: Object.values(
        groupRepresentativeComments
      ).flat().length,
      fdrAlpha,
      out: groupRepresentativeComments,
    });

    return groupRepresentativeComments;
  }

  /**
   * Benjamini-Hochberg法による偽発見率（FDR）制御
   * 多重比較補正を適用してadjusted p-valueを計算
   */
  private benjaminiHochbergCorrection(pValues: number[]): number[] {
    if (pValues.length === 0) return [];

    // p値とインデックスのペアを作成し、p値でソート
    const indexedPValues = pValues.map((p, i) => ({ p, index: i }));
    indexedPValues.sort((a, b) => a.p - b.p);

    const n = pValues.length;
    const adjustedPValues = new Array(n).fill(0);

    // Benjamini-Hochberg手順を適用
    // 最大のp値から開始して、逆順に処理
    let previousAdjusted = 1.0;

    for (let i = n - 1; i >= 0; i--) {
      const rank = i + 1; // ランク（1から始まる）
      const rawP = indexedPValues[i].p;
      const originalIndex = indexedPValues[i].index;

      // adjusted p-value = min(1, (n/rank) * p)
      const adjustedP = Math.min(1.0, (n / rank) * rawP);

      // 単調性を保持（前の値より小さくならないようにする）
      const monotoneAdjustedP = Math.min(previousAdjusted, adjustedP);

      adjustedPValues[originalIndex] = monotoneAdjustedP;
      previousAdjusted = monotoneAdjustedP;
    }

    return adjustedPValues;
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

    // 各グループの代表的意見を抽出（賛成・反対両方、多重比較補正適用）
    const groupRepresentativeComments = this.getGroupRepresentativeComments(
      5,
      0.05
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
