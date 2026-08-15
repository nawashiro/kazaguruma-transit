import PageHeader from "@/components/layouts/PageHeader";

export default function LocationDetailLoading() {
  return (
    <div className="py-8">
      <PageHeader title="場所の詳細" description="データを確認しています" />
      <p role="status" aria-live="polite" className="text-lg">
        場所の詳細を読み込み中です...
      </p>
    </div>
  );
}
