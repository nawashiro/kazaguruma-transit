import { WALK_WARNING_LABEL, walkAccessLevel } from "@/lib/transit/walk-access-level";

/** 徒歩距離をメートルの整数で示す。距離が分からないときは何も描かない。 */
export function WalkDistance({ walkMeters }: { walkMeters?: number }) {
  if (walkMeters === undefined) {
    return null;
  }
  return <span className="whitespace-nowrap">{Math.round(walkMeters)}m</span>;
}

/**
 * 徒歩距離に応じた警告。色だけで伝えないよう、警告の文字を必ず含める。
 * 遠すぎる候補も一覧から消さず、選べない理由として読める形で残す。
 */
export function WalkWarning({ walkMeters }: { walkMeters?: number }) {
  if (walkMeters === undefined) {
    return null;
  }
  const level = walkAccessLevel(walkMeters);
  if (level === "near") {
    return null;
  }
  return (
    <span
      className={
        level === "tooFar"
          ? "badge badge-md h-auto whitespace-nowrap p-2 text-base badge-neutral"
          : "badge badge-md h-auto whitespace-nowrap p-2 text-base badge-warning"
      }
    >
      {WALK_WARNING_LABEL[level]}
    </span>
  );
}
