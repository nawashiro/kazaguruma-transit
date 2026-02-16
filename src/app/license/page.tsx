import { getLicensePagePayload } from "@/lib/license/licensePayload";

export default async function LicensePage() {
  const payload = await getLicensePagePayload();

  return (
    <div className="container ruby-text">
      <header className="text-center my-4">
        <h1 className="text-3xl font-bold">ライセンス</h1>
      </header>

      <main className="max-w-4xl mx-auto space-y-4">
        <section className="card bg-base-100 shadow-md">
          <div className="card-body">
            <h2 className="card-title"><span>本ソフトウェア</span></h2>
            <div className="overflow-x-auto">
              <table className="table">
                <tbody>
                  <tr>
                    <th>名前</th>
                    <td>{payload.software.name}</td>
                  </tr>
                  <tr>
                    <th>バージョン</th>
                    <td>{payload.software.version}</td>
                  </tr>
                  <tr>
                    <th>ライセンス</th>
                    <td><span className="badge badge-primary">{payload.software.license}</span></td>
                  </tr>
                  <tr>
                    <th>権利者</th>
                    <td>{payload.software.author}</td>
                  </tr>
                  {payload.software.repository && (
                    <tr>
                      <th>リポジトリ</th>
                      <td><a href={payload.software.repository} className="link">{payload.software.repository}</a></td>
                    </tr>
                  )}

                  {payload.software.funding && payload.software.funding.length > 0 && (
                    <tr>
                      <th>ご支援はこちらから</th>
                      <td>
                        <ul>
                          {payload.software.funding.map((url) => (
                            <li key={url}><a href={url} className="link">{url}</a></li>
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
          <div className="card-body">
            <h2 className="card-title"><span>使用オープンデータ</span></h2>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>データ</th>
                    <th>ライセンス</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.openData.map((entry) => (
                    <tr key={entry.id} className="py-3 space-y-2">
                      <th><a href={entry.sourceUrl} className="link">{entry.name}</a></th>
                      <td><a href={entry.licenseUrl} className="badge badge-primary">{entry.licenseName}</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="card bg-base-100 shadow-md">
          <div className="card-body">
            <h2 className="card-title"><span>導入パッケージ</span></h2>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>パッケージ</th>
                    <th>バージョン</th>
                    <th>ライセンス</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.dependencies.map((entry) => (
                    <tr key={`${entry.packageName}@${entry.version}`}>
                      <th>{entry.packageName}</th>
                      <td>{entry.version}</td>
                      <td><span className="badge badge-primary justify-end">{entry.license || "UNKNOWN"}</span></td>
                    </tr>
                  ))}
                  {payload.dependencies.length === 0 && (
                    <li className="list-row text-base-content/60">依存ライセンス情報は未生成です。</li>
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
