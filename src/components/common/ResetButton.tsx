import Button from "./Button";

interface ResetButtonProps {
  onReset: () => void;
  className?: string;
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
}: ResetButtonProps) {
  return (
    <div className={`flex justify-center ${className}`}>
      <Button onClick={onReset} secondary testId="reset-search">
        検索条件をリセット
      </Button>
    </div>
  );
}
