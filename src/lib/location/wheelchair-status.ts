export type WheelchairTag = "yes" | "limited" | "no" | null;

export type WheelchairState = "全面" | "一部" | "非対応" | "情報なし";

export interface OsmElementRef {
  type: "node" | "way" | "relation";
  id: number;
}

export interface WheelchairStatus {
  state: WheelchairState;
  label: WheelchairState;
  description: string;
  isKnown: boolean;
  borderClass: string;
  iconClass: string;
  referenceUrl: string;
  linkLabelMain: string;
  linkLabelSub: string;
}

const DESCRIPTIONS: Record<WheelchairState, string> = {
  全面: "入口には段がなく、全部の部屋に段がありません。",
  一部: "入口には最大7センチの1段の段差があります。ほとんどの部屋には段がありません。",
  非対応: "入口には段が1段から数段あり、部屋は車いす不可。",
  情報なし: "バリアフリー情報がありません。",
};

function referenceUrlFor(osmElement: OsmElementRef | undefined): string {
  if (osmElement === undefined) {
    return "https://www.openstreetmap.org/";
  }
  if (osmElement.type === "node") {
    return `https://wheelmap.org/nodes/${osmElement.id}`;
  }
  if (osmElement.type === "way") {
    return `https://wheelmap.org/nodes/-${osmElement.id}`;
  }
  return `https://www.openstreetmap.org/relation/${osmElement.id}`;
}

function isWheelMapTarget(osmElement: OsmElementRef | undefined): boolean {
  return osmElement?.type === "node" || osmElement?.type === "way";
}

export function getWheelchairStatus(
  tag: WheelchairTag | string | undefined,
  osmElement: OsmElementRef | undefined,
): WheelchairStatus {
  const normalized: WheelchairTag =
    tag === "yes" || tag === "limited" || tag === "no" ? tag : null;

  const state: WheelchairState =
    normalized === "yes"
      ? "全面"
      : normalized === "limited"
        ? "一部"
        : normalized === "no"
          ? "非対応"
          : "情報なし";

  const isKnown = state !== "情報なし";
  const useWheelMap = isWheelMapTarget(osmElement);

  const borderClass =
    state === "全面"
      ? "border-success"
      : state === "一部"
        ? "border-warning"
        : state === "非対応"
          ? "border-error"
          : "border-base-300";

  const iconClass =
    state === "全面"
      ? "text-success"
      : state === "一部"
        ? "text-warning"
        : state === "非対応"
          ? "text-error"
          : "text-base-content/60";

  const referenceUrl = referenceUrlFor(osmElement);

  const linkLabelMain = isKnown ? "詳細を見る・編集する" : "詳細を見る・追加する";
  const linkLabelSub = useWheelMap
    ? "（WheelMapを開きます）"
    : "（OpenStreetMapを開きます）";

  // relationはWheelMapの対象外のため、既知・未知にかかわらずOSM文言にする
  const finalSub = useWheelMap ? linkLabelSub : "（OpenStreetMapを開きます）";
  const finalMain = useWheelMap
    ? linkLabelMain
    : "詳細を見る・編集する";

  return {
    state,
    label: state,
    description: DESCRIPTIONS[state],
    isKnown,
    borderClass,
    iconClass,
    referenceUrl,
    linkLabelMain: finalMain,
    linkLabelSub: finalSub,
  };
}
