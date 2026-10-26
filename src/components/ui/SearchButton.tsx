import { Search } from "lucide-react";
import Button from "./Button";

export default function SearchButton({ disabled = false, loading = false, testId, joined = false }: {
  disabled?: boolean;
  loading?: boolean;
  testId?: string;
  joined?: boolean;
}) {
  return (
    <Button type="submit" disabled={disabled} loading={loading} iconOnly joined={joined}
      className={joined ? "join-item h-11 w-11 p-0 focus-visible:!outline-2 focus-visible:!outline-offset-2 focus-visible:!outline-base-content" : ""}
      testId={testId} aria-label="検索">
      <Search className="h-5 w-5" aria-hidden="true" />
    </Button>
  );
}
