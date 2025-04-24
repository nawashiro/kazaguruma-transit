export default function StructuredData() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "風ぐるま乗換案内【非公式】",
    description:
      "千代田区の地域福祉交通「風ぐるま」の乗換案内サービス。出発地と目的地を入力するだけで最適な経路を案内します。",
    applicationCategory: "TravelApplication",
    operatingSystem: "All",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "JPY",
    },
    audience: {
      "@type": "PeopleAudience",
      audienceType: "千代田区民および千代田区を訪れる方",
    },
    author: {
      "@type": "Person",
      name: "Nawashiro",
    },
    provider: {
      "@type": "Person",
      name: "Nawashiro",
    },
    about: {
      "@type": "BusService",
      name: "風ぐるま",
      description: "千代田区の地域福祉交通バスサービス",
      areaServed: {
        "@type": "City",
        name: "千代田区",
        containedIn: {
          "@type": "State",
          name: "東京都",
        },
      },
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}
