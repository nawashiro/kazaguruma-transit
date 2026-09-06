import PageHeader from "@/components/layouts/PageHeader";
import Announcement from "@/components/features/Announcement";
import RouteSearchForm from "@/components/features/RouteSearchForm";
import Card from "@/components/ui/Card";
import locationData from "@/generated/location-data.json";

export default function Home() {
  return (
    <div>
      <PageHeader
        title={
          <>
            <ruby>
              風<rt>かざ</rt>
            </ruby>
            ぐるま乗換案内
          </>
        }
        description="千代田区地域福祉交通「風ぐるま」の自動案内サイト"
      />
      <div className="mb-6">
        <Announcement />
      </div>
      <div className="space-y-4">
        <RouteSearchForm
          suggestionCategories={locationData.suggestionCategories}
        />
        <Card bodyClassName="ruby-text">
          <p>※このサービスは非公式のもので、千代田区とは関係ありません</p>
          <p>※予定は変動し、実際の運行情報とは異なる場合があります</p>
          <p>
            <a
              href="https://lin.ee/CgIBOSd"
              target="_blank"
              rel="noopener noreferrer"
              className="link"
            >
              千代田区公式LINE
            </a>
            で最新の運行情報を確認できます
          </p>
        </Card>
      </div>
    </div>
  );
}
