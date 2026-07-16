import { getLicensePagePayload } from "@/lib/license/licensePayload";

export default async function LicensePage() {
  const payload = await getLicensePagePayload();

  return (
    <div className="container mx-auto px-2 pb-8 ruby-text sm:px-4">
      <header className="text-center my-4">
        <h1 className="text-3xl font-bold">ライセンス</h1>
      </header>

      <main className="max-w-4xl mx-auto space-y-4">
        <section className="card bg-base-100 shadow-md">
          <div className="card-body p-4 sm:p-6">
            <h2 className="card-title"><span>本ソフトウェア</span></h2>
            <div>
              <table className="table w-full table-fixed text-sm" aria-label="本ソフトウェア">
                <colgroup>
                  <col className="w-[38%] sm:w-[28%]" />
                  <col />
                </colgroup>
                <tbody>
                  <tr>
                    <th scope="row" className="whitespace-normal">名前</th>
                    <td className="break-all whitespace-normal">{payload.software.name}</td>
                  </tr>
                  <tr>
                    <th scope="row" className="whitespace-normal">バージョン</th>
                    <td className="break-all whitespace-normal">{payload.software.version}</td>
                  </tr>
                  <tr>
                    <th scope="row" className="whitespace-normal">ライセンス</th>
                    <td className="whitespace-normal"><span className="badge badge-primary h-auto max-w-full break-all py-1 text-center whitespace-normal">{payload.software.license}</span></td>
                  </tr>
                  <tr>
                    <th scope="row" className="whitespace-normal">権利者</th>
                    <td className="break-all whitespace-normal">{payload.software.author}</td>
                  </tr>
                  {payload.software.repository && (
                    <tr>
                      <th scope="row" className="whitespace-normal">リポジトリ</th>
                      <td className="whitespace-normal"><a href={payload.software.repository} className="link break-all">{payload.software.repository}</a></td>
                    </tr>
                  )}

                  {payload.software.funding && payload.software.funding.length > 0 && (
                    <tr>
                      <th scope="row" className="whitespace-normal">ご支援はこちらから</th>
                      <td className="whitespace-normal">
                        <ul>
                          {payload.software.funding.map((url) => (
                            <li key={url}><a href={url} className="link break-all">{url}</a></li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="card bg-base-100 shadow-md">
          <div className="card-body p-4 sm:p-6">
            <h2 className="card-title"><span>使用オープンデータ</span></h2>
            <div>
              <table className="table w-full table-fixed text-sm" aria-label="使用オープンデータ">
                <colgroup>
                  <col className="w-[62%] sm:w-[70%]" />
                  <col />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col" className="whitespace-normal">データ</th>
                    <th scope="col" className="whitespace-normal">ライセンス</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.openData.map((entry) => (
                    <tr key={entry.id}>
                      <th scope="row" className="break-words whitespace-normal"><a href={entry.sourceUrl} className="link">{entry.name}</a></th>
                      <td className="whitespace-normal"><a href={entry.licenseUrl} className="badge badge-primary h-auto max-w-full break-words py-1 text-center whitespace-normal">{entry.licenseName}</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="card bg-base-100 shadow-md">
          <div className="card-body p-4 sm:p-6">
            <h2 className="card-title"><span>導入パッケージ</span></h2>
            <div>
              <table className="table w-full table-fixed text-sm" aria-label="導入パッケージ">
                <colgroup>
                  <col className="w-[50%] sm:w-[54%]" />
                  <col className="w-[22%] sm:w-[23%]" />
                  <col />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col" className="whitespace-normal">パッケージ</th>
                    <th scope="col" className="whitespace-normal">バージョン</th>
                    <th scope="col" className="whitespace-normal">ライセンス</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.dependencies.map((entry) => (
                    <tr key={`${entry.packageName}@${entry.version}`}>
                      <th scope="row" className="break-all whitespace-normal">{entry.packageName}</th>
                      <td className="break-all whitespace-normal">{entry.version}</td>
                      <td className="whitespace-normal"><span className="badge badge-primary h-auto max-w-full break-all py-1 text-center whitespace-normal">{entry.license || "UNKNOWN"}</span></td>
                    </tr>
                  ))}
                  {payload.dependencies.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-base-content/60 whitespace-normal">依存ライセンス情報は未生成です。</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
