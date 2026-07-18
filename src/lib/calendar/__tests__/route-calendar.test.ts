import { buildRouteCalendar } from "../route-calendar";

const originStop = {
  stopId: "origin",
  stopName: "和泉橋出張所",
  distance: 0.3,
  stop_lat: 35.697,
  stop_lon: 139.78,
};

const destinationStop = {
  stopId: "destination",
  stopName: "千代田区役所",
  distance: 0.2,
  stop_lat: 35.694,
  stop_lon: 139.753,
};

describe("buildRouteCalendar", () => {
  test("直通経路は乗車時間だけを10分前通知付きで登録する", () => {
    const calendar = buildRouteCalendar({
      originStop,
      destinationStop,
      routes: [
        {
          routeId: "route-1",
          routeName: "神田ルート",
          routeShortName: "神田",
          routeLongName: "神田ルート",
          routeColor: "000000",
          routeTextColor: "ffffff",
          departureTime: "09:30:00",
          arrivalTime: "10:15:00",
        },
      ],
      selectedDateTime: "2026-07-18T08:00",
    });
    const unfoldedCalendar = calendar.replace(/\r\n[ \t]/g, "");

    expect(calendar).toContain("BEGIN:VCALENDAR\r\n");
    expect(calendar.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(unfoldedCalendar).toContain(
      "SUMMARY:風ぐるま 和泉橋出張所 神田ルート 千代田区役所"
    );
    expect(calendar).toContain("DTSTART:20260718T093000");
    expect(calendar).toContain("DTEND:20260718T101500");
    expect(calendar).toContain("LOCATION:和泉橋出張所");
    expect(calendar).toContain("GEO:35.697;139.78");
    expect(calendar.match(/TRIGGER:-PT10M/g)).toHaveLength(1);
    expect(calendar).not.toContain("SUMMARY:歩き");
  });

  test("1回乗換は2つの乗車区間だけを登録する", () => {
    const calendar = buildRouteCalendar({
      originStop,
      destinationStop: {
        ...destinationStop,
        stopName: "毎日新聞",
      },
      routes: [
        {
          routeId: "route-1",
          routeName: "神田ルート",
          routeShortName: "神田",
          routeLongName: "神田ルート",
          routeColor: "000000",
          routeTextColor: "ffffff",
          departureTime: "09:30:00",
          arrivalTime: "09:50:00",
          transfers: [
            {
              transferStop: {
                stopId: "transfer",
                stopName: "千代田区役所",
                stopLat: 35.694,
                stopLon: 139.753,
              },
              nextRoute: {
                routeId: "route-2",
                routeName: "内神田ルート",
                routeShortName: "内神田",
                routeLongName: "内神田ルート",
                routeColor: "000000",
                routeTextColor: "ffffff",
                departureTime: "10:00:00",
                arrivalTime: "10:20:00",
              },
            },
          ],
        },
      ],
      selectedDateTime: "2026-07-18T08:00",
    });
    const unfoldedCalendar = calendar.replace(/\r\n[ \t]/g, "");

    const summaries = [...unfoldedCalendar.matchAll(/SUMMARY:(.+)\r\n/g)].map(
      (match) => match[1]
    );
    expect(summaries).toEqual([
      "風ぐるま 和泉橋出張所 神田ルート 千代田区役所",
      "風ぐるま 千代田区役所 内神田ルート 毎日新聞",
    ]);
    expect(calendar.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(calendar.match(/TRIGGER:-PT10M/g)).toHaveLength(2);
    expect(calendar).not.toContain("SUMMARY:乗り換え");
    expect(calendar).not.toContain("SUMMARY:歩き");
  });

  test("日付をまたぐGTFS時刻を翌日のイベントにする", () => {
    const calendar = buildRouteCalendar({
      originStop: { ...originStop, distance: 0 },
      destinationStop: { ...destinationStop, distance: 0 },
      routes: [
        {
          routeId: "route-1",
          routeName: "神田ルート",
          routeShortName: "神田",
          routeLongName: "神田ルート",
          routeColor: "000000",
          routeTextColor: "ffffff",
          departureTime: "23:55:00",
          arrivalTime: "24:15:00",
        },
      ],
      selectedDateTime: "2026-07-18T23:00",
    });

    expect(calendar).toContain("DTSTART:20260718T235500");
    expect(calendar).toContain("DTEND:20260719T001500");
  });

  test("必須時刻がなければ生成せず日本語エラーにする", () => {
    expect(() =>
      buildRouteCalendar({
        originStop,
        destinationStop,
        routes: [
          {
            routeId: "route-1",
            routeName: "神田ルート",
            routeShortName: "神田",
            routeLongName: "神田ルート",
            routeColor: "000000",
            routeTextColor: "ffffff",
          },
        ],
        selectedDateTime: "2026-07-18T08:00",
      })
    ).toThrow("カレンダーに必要な時刻情報がありません");
  });
});
