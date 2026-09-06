import PageHeader from "@/components/layouts/PageHeader";

export default function NotFound() {
  return (
    <div className="py-8 ruby-text">
      <PageHeader title="ページが見つかりません" />
      <p>お探しのページは見つかりませんでした。</p>
    </div>
  );
}
