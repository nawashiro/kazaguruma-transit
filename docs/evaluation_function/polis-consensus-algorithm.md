# Polis におけるコンセンサスアルゴリズムの分析

## 概要

Polis（ポリス）は、AI を活用した意見収集プラットフォームであり、参加者の意見をクラスタリングして高次元の意見空間をマッピングすることで、多様な考えの中からコンセンサスを導き出すシステムです。このレポートでは、Polis の数学的処理部分（math モジュール）を分析し、どのようにコンセンサスが導き出されるかを説明します。

## 基本アーキテクチャ

Polis のコードベースは主に Clojure で書かれており、数学的処理を担当する`math`モジュールが意見分析のコアとなっています。特に以下のファイルが重要です：

- `conversation.clj` - 会話データの処理と全体のワークフロー管理
- `clusters.clj` - クラスタリングアルゴリズムの実装
- `pca.clj` - 主成分分析の実装
- `repness.clj` - 代表性分析アルゴリズム

## アルゴリズムの流れ

### 1. データ収集と前処理

参加者は様々なステートメント（意見）に対して賛成（1）、反対（-1）、もしくはパス（0）の投票を行います。これらのデータは以下のように処理されます：

```python
# Pythonでの実装
import pandas as pd
import numpy as np

# 評価行列の作成
rating_matrix = pd.DataFrame(columns=['pid', 'tid', 'vote'])
# pidは参加者ID、tidは意見ID、voteは投票値（1, -1, 0）
```

各参加者の投票は「rating matrix（評価行列）」として格納され、行が参加者（pid）、列が意見（tid）を表します。

### 2. 次元削減 - 主成分分析（PCA）

高次元の意見データ（多数の参加者 × 多数の意見）を 2 次元平面に投影するため、主成分分析（PCA）が使用されます：

```python
# scikit-learnを使用したPCA実装
from sklearn.decomposition import PCA

def perform_pca(data, n_components=2):
    """
    scikit-learnのPCAを使用して次元削減を行う関数

    Parameters:
    data: 投票データの行列（参加者 × 意見）
    n_components: 削減後の次元数

    Returns:
    pca_result: 次元削減後のデータ
    pca: 学習済みPCAモデル
    """
    # 欠損値を0で埋める（パスの場合）
    data_filled = data.fillna(0)

    # PCAの実行
    pca = PCA(n_components=n_components)
    pca_result = pca.fit_transform(data_filled)

    return pca_result, pca
```

元の Clojure コードでは疎行列に対応するための特別な対策が施されていましたが、scikit-learn の PCA は疎行列を効率的に処理できます。投票数が少ない参加者は中心からやや遠くに投影され、適切な位置に配置されます。

### 3. クラスタリング - 階層的 K-means

参加者をグループに分けるため、scikit-learn の K-means クラスタリングが使用されます：

```python
# scikit-learnを使用したK-meansクラスタリング
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

def perform_clustering(data, max_clusters=10):
    """
    最適なクラスタ数を決定してK-meansクラスタリングを実行する関数

    Parameters:
    data: PCAで次元削減されたデータ
    max_clusters: 検討する最大クラスタ数

    Returns:
    kmeans: 学習済みK-meansモデル
    optimal_k: 最適なクラスタ数
    """
    # シルエットスコアに基づいて最適なクラスタ数を決定
    silhouette_scores = []
    k_values = range(2, max_clusters + 1)

    for k in k_values:
        kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
        labels = kmeans.fit_predict(data)

        # シルエットスコアの計算
        if len(np.unique(labels)) > 1:  # クラスタが2つ以上ある場合のみ
            score = silhouette_score(data, labels)
            silhouette_scores.append(score)
        else:
            silhouette_scores.append(0)

    # 最適なクラスタ数を選択
    optimal_k = k_values[np.argmax(silhouette_scores)]

    # 最適なクラスタ数でK-meansを実行
    kmeans = KMeans(n_clusters=optimal_k, random_state=42, n_init=10)
    kmeans.fit(data)

    return kmeans, optimal_k
```

クラスタリングの品質は、シルエット係数を用いて最適な k 値（クラスタ数）を動的に決定します。

### 4. 代表性分析（Representativeness Analysis）

各グループを特徴づける代表的な意見を特定するため、統計的な代表性分析が行われます：

```python
# 代表性分析の実装
from scipy import stats
import numpy as np

def compute_representativeness(data, group_clusters, votes):
    """
    各クラスタにおける意見の代表性を計算する関数

    Parameters:
    data: 元の投票データ
    group_clusters: クラスタリング結果（ラベル）
    votes: 投票データ行列

    Returns:
    repness_results: 代表性分析の結果
    """
    # 結果を格納する辞書
    repness_results = {}

    # 各クラスタの一意なラベル
    unique_clusters = np.unique(group_clusters)

    # 各意見（列）について処理
    for tid in votes.columns:
        tid_votes = votes[tid].fillna(0)  # NAを0に変換

        # 各クラスタについて処理
        for cluster in unique_clusters:
            # クラスタに属する参加者のインデックス
            cluster_indices = np.where(group_clusters == cluster)[0]
            other_indices = np.where(group_clusters != cluster)[0]

            # クラスタ内の賛成・反対の比率
            cluster_votes = tid_votes.iloc[cluster_indices]
            agree_ratio = (cluster_votes == 1).mean()
            disagree_ratio = (cluster_votes == -1).mean()

            # 他のクラスタでの賛成・反対の比率
            other_votes = tid_votes.iloc[other_indices]
            other_agree_ratio = (other_votes == 1).mean()
            other_disagree_ratio = (other_votes == -1).mean()

            # 比率の差の統計的有意性テスト
            _, p_agree = stats.proportions_ztest(
                [(cluster_votes == 1).sum(), (other_votes == 1).sum()],
                [len(cluster_votes), len(other_votes)]
            )

            _, p_disagree = stats.proportions_ztest(
                [(cluster_votes == -1).sum(), (other_votes == -1).sum()],
                [len(cluster_votes), len(other_votes)]
            )

            # 代表性スコアの計算
            repness_agree = agree_ratio - other_agree_ratio
            repness_disagree = disagree_ratio - other_disagree_ratio

            # 統計的有意性を考慮した代表性スコア
            repness_score_agree = repness_agree * (1 - p_agree)
            repness_score_disagree = repness_disagree * (1 - p_disagree)

            # 結果を格納
            if (cluster, tid) not in repness_results:
                repness_results[(cluster, tid)] = {}

            repness_results[(cluster, tid)].update({
                'agree_ratio': agree_ratio,
                'disagree_ratio': disagree_ratio,
                'repness_agree': repness_score_agree,
                'repness_disagree': repness_score_disagree,
                'p_agree': p_agree,
                'p_disagree': p_disagree
            })

    return repness_results
```

代表性スコア（repness）は、クラスタ内の賛成/反対の割合と他クラスタとの差異、そして統計的有意性を組み合わせて計算されます。

### 5. コンセンサスの発見

Polis では主に 2 種類のコンセンサス検出方法を実装しています：

1. **ベースコンセンサス（consensus）**

   - すべての参加者間で高い同意または不同意を示すコメントを特定
   - 統計的有意性テスト（90%信頼水準の z 検定）を使用して、意見の支持が偶然よりも統計的に有意であることを確認
   - 上位 5 件の賛成意見と上位 5 件の反対意見を抽出
   - 有意性判定には`z-sig-90?`関数を使用し、z 値が 1.2816 を超える場合に統計的に有意と判断

2. **グループ考慮型コンセンサス（group-aware-consensus）**
   - 各グループの意見分布を考慮したより洗練されたコンセンサス検出
   - 各グループのコメントへの賛成確率を計算し、その確率の積を取ることでグループ間の共通見解を特定
   - ベイジアンアプローチとして、各確率計算に「+1」のスムージングを適用して、少数の投票でも安定した結果を得る
   - 具体的には各グループごとの賛成数 A、投票総数 S に対して、確率を `(A + 1.0) / (S + 2.0)` として計算
   - これらの確率をすべてのグループについて乗算し、最終的なコンセンサススコアを算出
   - スコアに関する明示的な閾値は設定されていないが、相対的に高いスコアのコメントがコンセンサスとして扱われる

このアプローチにより、異なる意見グループ間でも広く支持される見解を特定でき、分断された議論の中から「隠れたコンセンサス」を発見することが可能になります。

## 特徴と利点

### 1. 多次元データの視覚化

PCR によって複雑な意見空間を 2 次元に視覚化し、参加者がポジションを直感的に理解できるようにします。

```python
# 視覚化
import matplotlib.pyplot as plt
import seaborn as sns

def visualize_clusters(pca_result, group_clusters):
    """
    クラスタリング結果を視覚化する関数

    Parameters:
    pca_result: PCAで次元削減されたデータ
    group_clusters: クラスタリング結果（ラベル）
    """
    # データフレームに変換
    df = pd.DataFrame({
        'x': pca_result[:, 0],
        'y': pca_result[:, 1],
        'cluster': group_clusters
    })

    # プロット
    plt.figure(figsize=(10, 8))
    sns.scatterplot(x='x', y='y', hue='cluster', data=df, palette='viridis')
    plt.title('参加者のクラスタリング結果')
    plt.xlabel('主成分1')
    plt.ylabel('主成分2')
    plt.legend(title='クラスタ')
    plt.show()
```

### 2. 自動グループ形成

K-means クラスタリングによって、事前に定義されたグループではなく、実際の意見パターンに基づいてグループを形成します。

### 3. 代表的意見の特定

各グループを特徴付ける代表的な意見を統計的に特定することで、グループの本質を理解しやすくします。

### 4. コンセンサスの発見

異なるグループが同意する意見を特定することで、議論の中から自然に生まれるコンセンサスを検出します。

### 5. インクリメンタル処理

新しい投票を受け取るたびにモデルを更新する設計で、リアルタイムでの意見分析が可能です。

## 数学的基盤

1. **主成分分析（PCA）**: scikit-learn による効率的な実装で、疎行列にも対応
2. **K-means**: シルエット係数最適化による拡張実装
3. **統計的検定**: 比率検定（proportion test）、2 群間比率検定（two-proportion test）などによる有意性評価
4. **代表性スコアリング**: 複数の指標（比率、統計的有意性など）を組み合わせた総合評価

## まとめ

Polis は複雑な意見空間から自然なコンセンサスを導き出すための洗練されたアルゴリズムを実装しています。特に重要なのは：

1. 参加者は単純に賛成/反対/パスで投票するだけで済む
2. 意見の複雑なパターンを PCA とクラスタリングで自動的に解析
3. 代表性分析によって各グループの特徴を明らかにする
4. グループ間の共通見解を自然なコンセンサスとして特定

このアプローチにより、従来の投票や議論では見落とされがちな「隠れたコンセンサス」を発見することができ、より包括的な意思決定が可能になります。

## 総合実装例

```python
# PolisMathパッケージの最新実装例
import pandas as pd
import numpy as np
from sklearn.decomposition import PCA, TruncatedSVD
from sklearn.cluster import KMeans, AgglomerativeClustering
from sklearn.metrics import silhouette_score
from scipy import stats
from scipy.stats import norm
import matplotlib.pyplot as plt
import japanize_matplotlib
import seaborn as sns
from statsmodels.stats.proportion import proportions_ztest
import warnings
warnings.filterwarnings('ignore')

class PolisMath:
    """
    Polisの数学的処理を行うクラス
    """
    def __init__(self, votes_data):
        """
        初期化関数

        Parameters:
        votes_data: 投票データ（DataFrameまたはCSVファイルパス）
        """
        if isinstance(votes_data, str):
            self.votes = pd.read_csv(votes_data)
        else:
            self.votes = votes_data

        # 処理結果を格納する属性
        self.pca_result = None
        self.pca_model = None
        self.kmeans_model = None
        self.cluster_labels = None
        self.repness_results = None
        self.consensus_statements = None
        self.group_aware_consensus = None
        self.group_representative_comments = None  # 各グループを特徴づける意見

    def preprocess(self):
        """
        データの前処理を行う関数
        """
        # 評価行列に変換（ピボットテーブル形式）
        self.vote_matrix = self.votes.pivot(index='pid', columns='tid', values='vote')
        # 欠損値を0に（パスの場合）
        self.vote_matrix_filled = self.vote_matrix.fillna(0)

        return self

    def run_pca(self, n_components=2):
        """
        PCAによる次元削減を実行する関数

        疎行列に対応したTruncatedSVDも選択可能
        """
        # データの疎密度を確認
        sparsity = 1.0 - np.count_nonzero(self.vote_matrix_filled) / self.vote_matrix_filled.size

        if sparsity > 0.5:
            # 疎行列の場合はTruncatedSVDを使用
            svd = TruncatedSVD(n_components=n_components)
            self.pca_result = svd.fit_transform(self.vote_matrix_filled)
            self.pca_model = svd
        else:
            # 密行列の場合は通常のPCAを使用
            pca = PCA(n_components=n_components)
            self.pca_result = pca.fit_transform(self.vote_matrix_filled)
            self.pca_model = pca

        return self

    def run_clustering(self, max_clusters=10, method='kmeans'):
        """
        クラスタリングを実行する関数
        """
        # シルエットスコアに基づいて最適なクラスタ数を決定
        silhouette_scores = []
        # クラスタ数を参加者数の1/12 + 2に制限
        max_k = min(max_clusters, 2 + len(self.pca_result) // 12)
        k_values = range(2, max_k + 1)

        for k in k_values:
            if method == 'kmeans':
                model = KMeans(n_clusters=k, n_init="auto")
            else:
                model = AgglomerativeClustering(n_clusters=k)

            labels = model.fit_predict(self.pca_result)

            if len(np.unique(labels)) > 1:
                score = silhouette_score(self.pca_result, labels)
                silhouette_scores.append(score)
            else:
                silhouette_scores.append(0)

        # 最適なクラスタ数を選択
        optimal_k = k_values[np.argmax(silhouette_scores)] if silhouette_scores else 2

        # 最適なクラスタ数でクラスタリングを実行
        if method == 'kmeans':
            self.kmeans_model = KMeans(n_clusters=optimal_k, n_init="auto")
        else:
            self.kmeans_model = AgglomerativeClustering(n_clusters=optimal_k)

        self.cluster_labels = self.kmeans_model.fit_predict(self.pca_result)

        # クラスタごとのインデックスを格納
        self.cluster_indices = {}
        for cluster in np.unique(self.cluster_labels):
            self.cluster_indices[cluster] = np.where(self.cluster_labels == cluster)[0]

        return self

    def compute_representativeness(self):
        """
        代表性分析を実行する関数
        """
        # 結果を格納する辞書
        self.repness_results = {}

        # 各意見（列）について処理
        for tid in self.vote_matrix.columns:
            tid_votes = self.vote_matrix[tid].fillna(0)

            # 各クラスタについて処理
            for cluster in np.unique(self.cluster_labels):
                # クラスタに属する参加者のインデックス
                cluster_indices = np.where(self.cluster_labels == cluster)[0]
                other_indices = np.where(self.cluster_labels != cluster)[0]

                # クラスタ内の賛成・反対の比率
                cluster_votes = tid_votes.iloc[cluster_indices]
                agree_ratio = (cluster_votes == 1).mean()
                disagree_ratio = (cluster_votes == -1).mean()

                # 他のクラスタでの賛成・反対の比率
                other_votes = tid_votes.iloc[other_indices]
                other_agree_ratio = (other_votes == 1).mean()
                other_disagree_ratio = (other_votes == -1).mean()

                # 比率の差の統計的有意性テスト
                if len(cluster_votes) > 0 and len(other_votes) > 0:
                    try:
                        # statsmodelsを使用したより高度な比率検定
                        success_counts = [(cluster_votes == 1).sum(), (other_votes == 1).sum()]
                        total_counts = [len(cluster_votes), len(other_votes)]

                        # より安定した比率検定の実装
                        _, p_agree = proportions_ztest(success_counts, total_counts)

                        success_counts = [(cluster_votes == -1).sum(), (other_votes == -1).sum()]
                        _, p_disagree = proportions_ztest(success_counts, total_counts)
                    except:
                        p_agree = 1.0
                        p_disagree = 1.0
                else:
                    p_agree = 1.0
                    p_disagree = 1.0

                # 代表性スコアの計算
                repness_agree = agree_ratio - other_agree_ratio
                repness_disagree = disagree_ratio - other_disagree_ratio

                # 統計的有意性を考慮した代表性スコア
                repness_score_agree = repness_agree * (1 - p_agree)
                repness_score_disagree = repness_disagree * (1 - p_disagree)

                # 結果を格納
                if (cluster, tid) not in self.repness_results:
                    self.repness_results[(cluster, tid)] = {}

                self.repness_results[(cluster, tid)].update({
                    'agree_ratio': agree_ratio,
                    'disagree_ratio': disagree_ratio,
                    'repness_agree': repness_score_agree,
                    'repness_disagree': repness_score_disagree,
                    'p_agree': p_agree,
                    'p_disagree': p_disagree
                })

        return self

    def get_group_representative_comments(self, top_n=5, z_threshold=1.28):
        """
        各グループを特徴づける代表的な意見を抽出する関数

        Parameters:
        top_n: 各グループごとに抽出する代表的な意見の数
        z_threshold: 統計的有意性の閾値（z値が1.28で90%信頼区間）

        Returns:
        group_rep_comments: {グループID: [代表的な意見のリスト]}
        """
        if not self.repness_results:
            print("代表性分析を先に実行してください")
            return {}

        # 結果を格納する辞書
        self.group_representative_comments = {}

        # 各クラスタについて処理
        for cluster in np.unique(self.cluster_labels):
            # このクラスタに関連する全意見の代表性情報を収集
            cluster_comments = []

            for tid in self.vote_matrix.columns:
                if (cluster, tid) in self.repness_results:
                    stats_data = self.repness_results[(cluster, tid)]

                    # 賛成と反対、どちらの代表性が高いかを判断
                    if stats_data['repness_agree'] > stats_data['repness_disagree']:
                        repness_type = 'agree'
                        repness_score = stats_data['repness_agree']
                        p_value = stats_data['p_agree']
                        # z値の近似計算（p値から）- 90%信頼区間のZ値は約1.28
                        # 片側検定なので、p値が小さいほどZ値は大きい
                        z_score = stats.norm.ppf(1 - p_value)
                    else:
                        repness_type = 'disagree'
                        repness_score = stats_data['repness_disagree']
                        p_value = stats_data['p_disagree']
                        # z値の近似計算
                        z_score = stats.norm.ppf(1 - p_value)

                    # 統計的に有意な場合のみ追加
                    if z_score >= z_threshold:
                        cluster_comments.append({
                            'tid': tid,
                            'repness_type': repness_type,
                            'repness_score': repness_score,
                            'z_score': z_score,
                            'p_value': p_value
                        })

            # 代表性スコアで降順にソート
            cluster_comments = sorted(cluster_comments, key=lambda x: x['repness_score'], reverse=True)

            # 上位N件を選択
            self.group_representative_comments[cluster] = cluster_comments[:top_n]

        return self.group_representative_comments

    def get_group_agree_comments(self, top_n=5, z_threshold=1.28):
        """
        各グループの賛成タイプの代表的意見のみを抽出する関数

        Parameters:
        top_n: 各グループごとに抽出する代表的な意見の数
        z_threshold: 統計的有意性の閾値（z値が1.28で90%信頼区間）

        Returns:
        group_agree_comments: {グループID: [賛成タイプの代表的な意見のリスト]}
        """
        if not self.repness_results:
            print("代表性分析を先に実行してください")
            return {}

        # 結果を格納する辞書
        group_agree_comments = {}

        # 各クラスタについて処理
        for cluster in np.unique(self.cluster_labels):
            # このクラスタに関連する全意見の代表性情報を収集
            cluster_comments = []

            for tid in self.vote_matrix.columns:
                if (cluster, tid) in self.repness_results:
                    stats_data = self.repness_results[(cluster, tid)]

                    # 賛成の代表性のみを考慮
                    repness_score = stats_data['repness_agree']
                    p_value = stats_data['p_agree']

                    # z値の近似計算
                    z_score = stats.norm.ppf(1 - p_value)

                    # 統計的に有意かつ代表性スコアが正の場合のみ追加
                    if z_score >= z_threshold and repness_score > 0:
                        cluster_comments.append({
                            'tid': tid,
                            'repness_score': repness_score,
                            'z_score': z_score,
                            'p_value': p_value
                        })

            # 代表性スコアで降順にソート
            cluster_comments = sorted(cluster_comments, key=lambda x: x['repness_score'], reverse=True)

            # 上位N件を選択
            group_agree_comments[cluster] = cluster_comments[:top_n]

        return group_agree_comments

    def detect_consensus(self):
        """
        コンセンサスを検出する関数
        """
        # 基本的なコンセンサス検出
        self._detect_basic_consensus()

        # グループ考慮型コンセンサス検出
        self._detect_group_aware_consensus()

        return self

    def _detect_basic_consensus(self):
        """
        基本的なコンセンサス検出（全体の賛成/反対率と統計的有意性に基づく）
        """
        # 結果を格納するリスト
        self.consensus_statements = {'agree': [], 'disagree': []}

        # 各意見（列）について処理
        for tid in self.vote_matrix.columns:
            tid_votes = self.vote_matrix[tid].dropna()

            if len(tid_votes) == 0:
                continue

            # 全体の賛成・反対率を計算
            agree_ratio = (tid_votes == 1).mean()
            disagree_ratio = (tid_votes == -1).mean()
            n_success = (tid_votes == 1).sum()
            n_trials = len(tid_votes)

            # 統計的有意性テスト（90%信頼水準のz検定）
            # 帰無仮説: 真の賛成率は0.5（偶然）
            if n_trials > 0:
                # scipy 1.7.0以降ではbinom_testからbinomtestに変更されている
                try:
                    p_value = stats.binomtest(n_success, n_trials, p=0.5).pvalue
                except AttributeError:
                    # 古いバージョンのSciPyの場合
                    p_value = stats.binom_test(n_success, n_trials, p=0.5)

                is_significant = p_value < 0.1  # 90%信頼水準
            else:
                is_significant = False

            # コンセンサスの判定と格納
            if agree_ratio > 0.5 and is_significant:
                self.consensus_statements['agree'].append({
                    'tid': tid,
                    'strength': agree_ratio,
                    'n_success': n_success,
                    'n_trials': n_trials,
                    'p_value': p_value
                })
            elif disagree_ratio > 0.5 and is_significant:
                self.consensus_statements['disagree'].append({
                    'tid': tid,
                    'strength': disagree_ratio,
                    'n_success': (tid_votes == -1).sum(),
                    'n_trials': n_trials,
                    'p_value': p_value
                })

        # 強度でソートして上位5件を選択
        self.consensus_statements['agree'] = sorted(
            self.consensus_statements['agree'],
            key=lambda x: x['strength'],
            reverse=True
        )[:5]

        self.consensus_statements['disagree'] = sorted(
            self.consensus_statements['disagree'],
            key=lambda x: x['strength'],
            reverse=True
        )[:5]

    def _detect_group_aware_consensus(self):
        """
        グループ考慮型コンセンサス検出

        各グループごとの賛成確率を計算し、その積を取ることで
        全グループが同意する見解を特定する高度なコンセンサス検出手法
        """
        # クラスタリングが実行済みか確認
        if not hasattr(self, 'cluster_indices') or not self.cluster_indices:
            print("クラスタリングを先に実行してください")
            return self

        tid_gid_probs = {}

        # 各コメントとグループの組み合わせについて賛成確率を計算
        for tid in self.vote_matrix.columns:
            tid_gid_probs[tid] = {}

            for gid, group_indices in self.cluster_indices.items():
                # グループ内での投票を抽出
                group_votes = self.vote_matrix[tid].iloc[group_indices].dropna()

                # 賛成数と投票総数を計算
                A = (group_votes == 1).sum()
                S = len(group_votes)

                # ベイジアンスムージングを適用した確率を計算
                prob = (A + 1.0) / (S + 2.0)
                tid_gid_probs[tid][gid] = prob

        # 各コメントについて、全グループの賛成確率の積を計算
        tid_consensus = {}
        for tid, gid_probs in tid_gid_probs.items():
            if gid_probs:  # グループがある場合のみ
                product_prob = np.prod(list(gid_probs.values()))
                tid_consensus[tid] = product_prob

        # スコアの降順でソート
        self.group_aware_consensus = dict(sorted(
            tid_consensus.items(),
            key=lambda x: x[1],
            reverse=True
        ))

        return self

    def visualize_clusters(self):
        """
        クラスタリング結果を視覚化する関数
        """
        if self.pca_result is None or self.cluster_labels is None:
            print("PCAとクラスタリングを先に実行してください")
            return

        # データフレームに変換
        df = pd.DataFrame({
            'x': self.pca_result[:, 0],
            'y': self.pca_result[:, 1],
            'cluster': self.cluster_labels
        })

        # プロット
        plt.figure(figsize=(10, 8))
        sns.scatterplot(x='x', y='y', hue='cluster', data=df, palette='viridis')
        plt.title('参加者のクラスタリング結果')
        plt.xlabel('主成分1')
        plt.ylabel('主成分2')
        plt.legend(title='クラスタ')

        return plt

    def run_analysis(self):
        """
        全分析工程を実行する関数
        """
        self.preprocess()
        self.run_pca()
        self.run_clustering()
        self.compute_representativeness()
        self.detect_consensus()
        self.get_group_representative_comments()

        return self
```

使用例：

```python
# サンプルデータの作成（実際には実データを使用）
import pandas as pd
import numpy as np

# ランダムな投票データを生成
np.random.seed()
n_participants = 100
n_statements = 20

# 投票データフレームの作成
data = [{'pid': f'p0','tid': f's2','vote': 1},
{'pid': f'p3','tid': f's2','vote': -1},
{'pid': f'p4','tid': f's2','vote': 1},
{'pid': f'p5','tid': f's2','vote': 1},
{'pid': f'p7','tid': f's2','vote': -1},
{'pid': f'p8','tid': f's2','vote': 1},
{'pid': f'p9','tid': f's2','vote': -1},
{'pid': f'p10','tid': f's2','vote': 1},
{'pid': f'p11','tid': f's2','vote': 1},
{'pid': f'p12','tid': f's2','vote': 1},
{'pid': f'p14','tid': f's2','vote': 1},
{'pid': f'p15','tid': f's2','vote': -1},
{'pid': f'p16','tid': f's2','vote': 0},
{'pid': f'p17','tid': f's2','vote': 1},
{'pid': f'p18','tid': f's2','vote': 1},
{'pid': f'p20','tid': f's2','vote': -1},
{'pid': f'p21','tid': f's2','vote': 1},
{'pid': f'p23','tid': f's2','vote': 0},
{'pid': f'p24','tid': f's2','vote': 1},
{'pid': f'p26','tid': f's2','vote': 1},
{'pid': f'p28','tid': f's2','vote': 1},
{'pid': f'p29','tid': f's2','vote': -1},
{'pid': f'p30','tid': f's2','vote': 1},
{'pid': f'p31','tid': f's2','vote': 1},
{'pid': f'p0','tid': f's3','vote': -1},
{'pid': f'p3','tid': f's3','vote': -1},
{'pid': f'p4','tid': f's3','vote': 1},
{'pid': f'p5','tid': f's3','vote': -1},
{'pid': f'p7','tid': f's3','vote': -1},
{'pid': f'p8','tid': f's3','vote': -1},
{'pid': f'p10','tid': f's3','vote': 0},
{'pid': f'p11','tid': f's3','vote': 1},
{'pid': f'p14','tid': f's3','vote': 1},
{'pid': f'p15','tid': f's3','vote': -1},
{'pid': f'p16','tid': f's3','vote': -1},
{'pid': f'p17','tid': f's3','vote': -1},
{'pid': f'p18','tid': f's3','vote': 0},
{'pid': f'p21','tid': f's3','vote': 1},
{'pid': f'p22','tid': f's3','vote': -1},
{'pid': f'p23','tid': f's3','vote': -1},
{'pid': f'p24','tid': f's3','vote': -1},
{'pid': f'p26','tid': f's3','vote': 1},
{'pid': f'p28','tid': f's3','vote': -1},
{'pid': f'p30','tid': f's3','vote': 1},
{'pid': f'p31','tid': f's3','vote': 0},
{'pid': f'p0','tid': f's4','vote': -1},
{'pid': f'p3','tid': f's4','vote': 0},
{'pid': f'p4','tid': f's4','vote': 1},
{'pid': f'p5','tid': f's4','vote': 1},
{'pid': f'p7','tid': f's4','vote': -1},
{'pid': f'p8','tid': f's4','vote': -1},
{'pid': f'p9','tid': f's4','vote': 1},
{'pid': f'p11','tid': f's4','vote': 1},
{'pid': f'p12','tid': f's4','vote': 0},
{'pid': f'p13','tid': f's4','vote': 0},
{'pid': f'p14','tid': f's4','vote': -1},
{'pid': f'p15','tid': f's4','vote': -1},
{'pid': f'p16','tid': f's4','vote': 0},
{'pid': f'p17','tid': f's4','vote': -1},
{'pid': f'p18','tid': f's4','vote': 0},
{'pid': f'p21','tid': f's4','vote': 1},
{'pid': f'p23','tid': f's4','vote': 0},
{'pid': f'p24','tid': f's4','vote': 1},
{'pid': f'p26','tid': f's4','vote': 0},
{'pid': f'p28','tid': f's4','vote': 1},
{'pid': f'p30','tid': f's4','vote': 1},
{'pid': f'p31','tid': f's4','vote': 0},
{'pid': f'p0','tid': f's5','vote': 1},
{'pid': f'p3','tid': f's5','vote': 1},
{'pid': f'p4','tid': f's5','vote': -1},
{'pid': f'p5','tid': f's5','vote': 1},
{'pid': f'p7','tid': f's5','vote': 1},
{'pid': f'p8','tid': f's5','vote': 1},
{'pid': f'p9','tid': f's5','vote': -1},
{'pid': f'p10','tid': f's5','vote': -1},
{'pid': f'p11','tid': f's5','vote': -1},
{'pid': f'p12','tid': f's5','vote': 1},
{'pid': f'p14','tid': f's5','vote': -1},
{'pid': f'p15','tid': f's5','vote': -1},
{'pid': f'p16','tid': f's5','vote': 1},
{'pid': f'p17','tid': f's5','vote': 1},
{'pid': f'p18','tid': f's5','vote': 0},
{'pid': f'p20','tid': f's5','vote': 1},
{'pid': f'p21','tid': f's5','vote': 0},
{'pid': f'p23','tid': f's5','vote': 0},
{'pid': f'p24','tid': f's5','vote': 1},
{'pid': f'p26','tid': f's5','vote': 0},
{'pid': f'p28','tid': f's5','vote': 1},
{'pid': f'p30','tid': f's5','vote': 0},
{'pid': f'p31','tid': f's5','vote': 0},
{'pid': f'p0','tid': f's7','vote': -1},
{'pid': f'p3','tid': f's7','vote': 0},
{'pid': f'p4','tid': f's7','vote': -1},
{'pid': f'p5','tid': f's7','vote': -1},
{'pid': f'p7','tid': f's7','vote': -1},
{'pid': f'p8','tid': f's7','vote': -1},
{'pid': f'p11','tid': f's7','vote': 1},
{'pid': f'p14','tid': f's7','vote': -1},
{'pid': f'p15','tid': f's7','vote': 0},
{'pid': f'p16','tid': f's7','vote': 0},
{'pid': f'p17','tid': f's7','vote': -1},
{'pid': f'p18','tid': f's7','vote': 1},
{'pid': f'p20','tid': f's7','vote': 0},
{'pid': f'p21','tid': f's7','vote': 1},
{'pid': f'p23','tid': f's7','vote': 0},
{'pid': f'p24','tid': f's7','vote': -1},
{'pid': f'p26','tid': f's7','vote': -1},
{'pid': f'p28','tid': f's7','vote': -1},
{'pid': f'p30','tid': f's7','vote': 1},
{'pid': f'p31','tid': f's7','vote': 0},
{'pid': f'p0','tid': f's8','vote': 1},
{'pid': f'p1','tid': f's8','vote': 1},
{'pid': f'p2','tid': f's8','vote': 1},
{'pid': f'p3','tid': f's8','vote': 1},
{'pid': f'p4','tid': f's8','vote': 1},
{'pid': f'p5','tid': f's8','vote': 1},
{'pid': f'p6','tid': f's8','vote': 1},
{'pid': f'p7','tid': f's8','vote': -1},
{'pid': f'p8','tid': f's8','vote': -1},
{'pid': f'p10','tid': f's8','vote': -1},
{'pid': f'p11','tid': f's8','vote': 0},
{'pid': f'p12','tid': f's8','vote': 1},
{'pid': f'p14','tid': f's8','vote': 1},
{'pid': f'p15','tid': f's8','vote': 1},
{'pid': f'p16','tid': f's8','vote': 1},
{'pid': f'p17','tid': f's8','vote': 1},
{'pid': f'p18','tid': f's8','vote': 0},
{'pid': f'p20','tid': f's8','vote': 1},
{'pid': f'p21','tid': f's8','vote': -1},
{'pid': f'p23','tid': f's8','vote': 0},
{'pid': f'p24','tid': f's8','vote': 1},
{'pid': f'p26','tid': f's8','vote': 1},
{'pid': f'p27','tid': f's8','vote': 1},
{'pid': f'p28','tid': f's8','vote': 1},
{'pid': f'p30','tid': f's8','vote': 1},
{'pid': f'p31','tid': f's8','vote': -1},
{'pid': f'p0','tid': f's9','vote': 1},
{'pid': f'p2','tid': f's9','vote': 0},
{'pid': f'p3','tid': f's9','vote': 1},
{'pid': f'p4','tid': f's9','vote': -1},
{'pid': f'p5','tid': f's9','vote': 1},
{'pid': f'p7','tid': f's9','vote': -1},
{'pid': f'p8','tid': f's9','vote': 1},
{'pid': f'p9','tid': f's9','vote': 1},
{'pid': f'p10','tid': f's9','vote': 1},
{'pid': f'p11','tid': f's9','vote': 0},
{'pid': f'p14','tid': f's9','vote': 1},
{'pid': f'p15','tid': f's9','vote': 1},
{'pid': f'p16','tid': f's9','vote': 1},
{'pid': f'p17','tid': f's9','vote': 0},
{'pid': f'p18','tid': f's9','vote': 0},
{'pid': f'p20','tid': f's9','vote': 0},
{'pid': f'p21','tid': f's9','vote': 1},
{'pid': f'p23','tid': f's9','vote': 0},
{'pid': f'p24','tid': f's9','vote': -1},
{'pid': f'p26','tid': f's9','vote': 1},
{'pid': f'p28','tid': f's9','vote': 1},
{'pid': f'p30','tid': f's9','vote': 0},
{'pid': f'p31','tid': f's9','vote': 0},
{'pid': f'p0','tid': f's10','vote': 1},
{'pid': f'p3','tid': f's10','vote': -1},
{'pid': f'p4','tid': f's10','vote': 1},
{'pid': f'p5','tid': f's10','vote': -1},
{'pid': f'p7','tid': f's10','vote': -1},
{'pid': f'p8','tid': f's10','vote': -1},
{'pid': f'p9','tid': f's10','vote': 1},
{'pid': f'p10','tid': f's10','vote': 1},
{'pid': f'p11','tid': f's10','vote': 1},
{'pid': f'p12','tid': f's10','vote': -1},
{'pid': f'p14','tid': f's10','vote': 0},
{'pid': f'p15','tid': f's10','vote': -1},
{'pid': f'p16','tid': f's10','vote': -1},
{'pid': f'p17','tid': f's10','vote': 1},
{'pid': f'p18','tid': f's10','vote': 1},
{'pid': f'p20','tid': f's10','vote': 1},
{'pid': f'p21','tid': f's10','vote': 1},
{'pid': f'p23','tid': f's10','vote': 0},
{'pid': f'p24','tid': f's10','vote': -1},
{'pid': f'p26','tid': f's10','vote': 1},
{'pid': f'p28','tid': f's10','vote': 1},
{'pid': f'p29','tid': f's10','vote': 1},
{'pid': f'p30','tid': f's10','vote': 1},
{'pid': f'p31','tid': f's10','vote': 1},
{'pid': f'p0','tid': f's11','vote': 1},
{'pid': f'p2','tid': f's11','vote': 0},
{'pid': f'p3','tid': f's11','vote': 1},
{'pid': f'p4','tid': f's11','vote': -1},
{'pid': f'p5','tid': f's11','vote': 1},
{'pid': f'p7','tid': f's11','vote': 1},
{'pid': f'p8','tid': f's11','vote': 1},
{'pid': f'p9','tid': f's11','vote': 1},
{'pid': f'p10','tid': f's11','vote': -1},
{'pid': f'p11','tid': f's11','vote': 0},
{'pid': f'p14','tid': f's11','vote': 1},
{'pid': f'p15','tid': f's11','vote': 0},
{'pid': f'p16','tid': f's11','vote': 1},
{'pid': f'p17','tid': f's11','vote': 1},
{'pid': f'p18','tid': f's11','vote': 0},
{'pid': f'p20','tid': f's11','vote': 0},
{'pid': f'p21','tid': f's11','vote': 1},
{'pid': f'p23','tid': f's11','vote': 0},
{'pid': f'p24','tid': f's11','vote': 1},
{'pid': f'p26','tid': f's11','vote': -1},
{'pid': f'p28','tid': f's11','vote': 1},
{'pid': f'p30','tid': f's11','vote': 1},
{'pid': f'p31','tid': f's11','vote': 1},
{'pid': f'p0','tid': f's13','vote': 1},
{'pid': f'p3','tid': f's13','vote': 1},
{'pid': f'p4','tid': f's13','vote': -1},
{'pid': f'p5','tid': f's13','vote': 1},
{'pid': f'p6','tid': f's13','vote': 0},
{'pid': f'p7','tid': f's13','vote': 1},
{'pid': f'p8','tid': f's13','vote': 1},
{'pid': f'p9','tid': f's13','vote': 1},
{'pid': f'p10','tid': f's13','vote': -1},
{'pid': f'p11','tid': f's13','vote': -1},
{'pid': f'p14','tid': f's13','vote': 1},
{'pid': f'p15','tid': f's13','vote': 1},
{'pid': f'p16','tid': f's13','vote': 1},
{'pid': f'p17','tid': f's13','vote': 1},
{'pid': f'p18','tid': f's13','vote': 0},
{'pid': f'p20','tid': f's13','vote': 1},
{'pid': f'p21','tid': f's13','vote': 1},
{'pid': f'p22','tid': f's13','vote': 1},
{'pid': f'p23','tid': f's13','vote': 0},
{'pid': f'p24','tid': f's13','vote': 1},
{'pid': f'p25','tid': f's13','vote': 0},
{'pid': f'p26','tid': f's13','vote': -1},
{'pid': f'p28','tid': f's13','vote': 1},
{'pid': f'p30','tid': f's13','vote': 1},
{'pid': f'p31','tid': f's13','vote': 1},
{'pid': f'p0','tid': f's14','vote': -1},
{'pid': f'p3','tid': f's14','vote': -1},
{'pid': f'p4','tid': f's14','vote': 1},
{'pid': f'p5','tid': f's14','vote': -1},
{'pid': f'p7','tid': f's14','vote': -1},
{'pid': f'p8','tid': f's14','vote': -1},
{'pid': f'p11','tid': f's14','vote': 1},
{'pid': f'p14','tid': f's14','vote': 1},
{'pid': f'p15','tid': f's14','vote': 1},
{'pid': f'p16','tid': f's14','vote': -1},
{'pid': f'p17','tid': f's14','vote': -1},
{'pid': f'p18','tid': f's14','vote': 0},
{'pid': f'p20','tid': f's14','vote': -1},
{'pid': f'p21','tid': f's14','vote': 1},
{'pid': f'p23','tid': f's14','vote': 0},
{'pid': f'p24','tid': f's14','vote': -1},
{'pid': f'p26','tid': f's14','vote': -1},
{'pid': f'p28','tid': f's14','vote': -1},
{'pid': f'p29','tid': f's14','vote': -1},
{'pid': f'p30','tid': f's14','vote': 1},
{'pid': f'p31','tid': f's14','vote': -1},
{'pid': f'p0','tid': f's15','vote': 1},
{'pid': f'p4','tid': f's15','vote': 0},
{'pid': f'p9','tid': f's15','vote': 1},
{'pid': f'p11','tid': f's15','vote': 0},
{'pid': f'p14','tid': f's15','vote': 0},
{'pid': f'p15','tid': f's15','vote': 1},
{'pid': f'p16','tid': f's15','vote': 1},
{'pid': f'p17','tid': f's15','vote': 0},
{'pid': f'p18','tid': f's15','vote': 0},
{'pid': f'p20','tid': f's15','vote': 1},
{'pid': f'p21','tid': f's15','vote': 1},
{'pid': f'p23','tid': f's15','vote': 1},
{'pid': f'p24','tid': f's15','vote': 1},
{'pid': f'p26','tid': f's15','vote': 1},
{'pid': f'p28','tid': f's15','vote': 1},
{'pid': f'p29','tid': f's15','vote': 1},
{'pid': f'p30','tid': f's15','vote': 0},
{'pid': f'p31','tid': f's15','vote': 1},
{'pid': f'p0','tid': f's16','vote': 1},
{'pid': f'p4','tid': f's16','vote': 1},
{'pid': f'p9','tid': f's16','vote': 1},
{'pid': f'p11','tid': f's16','vote': 1},
{'pid': f'p12','tid': f's16','vote': 1},
{'pid': f'p14','tid': f's16','vote': -1},
{'pid': f'p15','tid': f's16','vote': -1},
{'pid': f'p16','tid': f's16','vote': -1},
{'pid': f'p17','tid': f's16','vote': -1},
{'pid': f'p18','tid': f's16','vote': 1},
{'pid': f'p20','tid': f's16','vote': -1},
{'pid': f'p21','tid': f's16','vote': 0},
{'pid': f'p23','tid': f's16','vote': 0},
{'pid': f'p24','tid': f's16','vote': 1},
{'pid': f'p26','tid': f's16','vote': 1},
{'pid': f'p28','tid': f's16','vote': -1},
{'pid': f'p30','tid': f's16','vote': 1},
{'pid': f'p31','tid': f's16','vote': 1},
{'pid': f'p0','tid': f's17','vote': 0},
{'pid': f'p4','tid': f's17','vote': 1},
{'pid': f'p14','tid': f's17','vote': 1},
{'pid': f'p16','tid': f's17','vote': 1},
{'pid': f'p17','tid': f's17','vote': 1},
{'pid': f'p18','tid': f's17','vote': 0},
{'pid': f'p19','tid': f's17','vote': 1},
{'pid': f'p20','tid': f's17','vote': 0},
{'pid': f'p21','tid': f's17','vote': 1},
{'pid': f'p23','tid': f's17','vote': 1},
{'pid': f'p24','tid': f's17','vote': 1},
{'pid': f'p26','tid': f's17','vote': 1},
{'pid': f'p28','tid': f's17','vote': 1},
{'pid': f'p30','tid': f's17','vote': 1},
{'pid': f'p31','tid': f's17','vote': 1}]

votes_df = pd.DataFrame(data)

# PolisMatbの実行
polis = PolisMath(votes_df)
polis.run_analysis()

# 結果の可視化
plt = polis.visualize_clusters()
plt.show()

# 基本的なコンセンサス意見の表示
print("基本的なコンセンサス意見:")
for opinion_type, statements in polis.consensus_statements.items():
    print(f"\n{opinion_type}:")
    for statement in statements:
        print(f"  意見ID: {statement['tid']}, 強度: {statement['strength']:.2f}, p値: {statement['p_value']:.3f}")

# グループ考慮型コンセンサスの表示
print("\nグループ考慮型コンセンサス:")
if polis.group_aware_consensus:
    for tid, score in sorted(polis.group_aware_consensus.items(), key=lambda x: x[1], reverse=True)[:5]:
        print(f"  意見ID: {tid}, スコア: {score:.3f}")
else:
    print("  グループ考慮型コンセンサスがありません")

# 各グループの代表的な意見を表示
print("\n各グループの代表的な意見:")
for cluster, comments in polis.group_representative_comments.items():
    print(f"\nグループ {cluster}:")
    for comment in comments:
        print(f"  意見ID: {comment['tid']}, タイプ: {comment['repness_type']}, スコア: {comment['repness_score']:.3f}, Z値: {comment['z_score']:.3f}")

# 各グループの賛成タイプの代表的意見のみを表示
print("\n各グループの賛成タイプの代表的意見:")
agree_comments = polis.get_group_agree_comments()
for cluster, comments in agree_comments.items():
    print(f"\nグループ {cluster}:")
    for comment in comments:
        print(f"  意見ID: {comment['tid']}, スコア: {comment['repness_score']:.3f}, Z値: {comment['z_score']:.3f}")
```
