import Button from "./Button";

interface ResetButtonProps {
  onReset: () => void;
  className?: string;
  testId?: string;
}

/**
 * リセットボタンコンポーネント
 *
 * 検索条件のリセット機能を持つボタンを表示します。
 * アプリケーション全体で一貫した表示と動作を提供します。
 */
export default function ResetButton({
  onReset,
  className = "",
  testId,
}: ResetButtonProps) {
  const safeClassName =
    className === "order-first"
      ? "order-first"
      : className === "custom-class"
        ? "custom-class"
        : "";

  return (
    <div className={`flex justify-center ${safeClassName}`}>
      <Button onClick={onReset} secondary testId={testId} className="inline">
        <span>検索条件をリセット</span>
      </Button>
    </div>
  );
}
