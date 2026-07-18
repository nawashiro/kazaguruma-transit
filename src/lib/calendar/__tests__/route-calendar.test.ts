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
  test("直通経路を両端の徒歩と乗車の3イベントにする", () => {
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

    expect(calendar).toContain("BEGIN:VCALENDAR\r\n");
    expect(calendar.match(/BEGIN:VEVENT/g)).toHaveLength(3);
    expect(calendar).toContain("SUMMARY:歩き 和泉橋出張所バス停へ");
    expect(calendar).toContain(
      "SUMMARY:歩き 和泉橋出張所バス停へ\r\nDTSTART:20260718T092000\r\nDTEND:20260718T092900"
    );
    expect(calendar).toContain("TRIGGER:-PT10M");
    expect(calendar).toContain("SUMMARY:風ぐるま 和泉橋出張所 神田ルート");
    expect(calendar).toContain("DTSTART:20260718T093000");
    expect(calendar).toContain("DTEND:20260718T101500");
    expect(calendar).toContain("LOCATION:和泉橋出張所");
    expect(calendar).toContain("GEO:35.697;139.78");
    expect(calendar).toContain("SUMMARY:歩き 千代田区役所バス停から");
    expect(calendar).toContain(
      "SUMMARY:歩き 千代田区役所バス停から\r\nDTSTART:20260718T101600\r\nDTEND:20260718T102200"
    );
  });

  test("1回乗換を徒歩・乗車・乗換・乗車・徒歩の順にする", () => {
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

    const summaries = [...calendar.matchAll(/SUMMARY:(.+)\r\n/g)].map(
      (match) => match[1]
    );
    expect(summaries).toEqual([
      "歩き 和泉橋出張所バス停へ",
      "風ぐるま 和泉橋出張所 神田ルート",
      "乗り換え 千代田区役所",
      "風ぐるま 千代田区役所 内神田ルート",
      "歩き 毎日新聞バス停から",
    ]);
    expect(calendar).toContain(
      "SUMMARY:乗り換え 千代田区役所\r\nDTSTART:20260718T095100\r\nDTEND:20260718T095900"
    );
    expect(calendar).toContain(
      "SUMMARY:歩き 毎日新聞バス停から\r\nDTSTART:20260718T102100\r\nDTEND:20260718T102700"
    );
    expect(calendar.match(/TRIGGER:-PT5M/g)).toHaveLength(4);
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

  test("短い乗換でもバスと重ならない正の長さのイベントにする", () => {
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
                departureTime: "09:52:00",
                arrivalTime: "10:20:00",
              },
            },
          ],
        },
      ],
      selectedDateTime: "2026-07-18T08:00",
    });

    expect(calendar).toContain(
      "SUMMARY:乗り換え 千代田区役所\r\nDTSTART:20260718T095040\r\nDTEND:20260718T095120"
    );
  });

  test("停留所の距離が未設定なら地点と停留所の座標から徒歩時間を求める", () => {
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
          departureTime: "09:30:00",
          arrivalTime: "10:15:00",
        },
      ],
      selectedDateTime: "2026-07-18T08:00",
      originLat: 35.696,
      originLng: 139.78,
      destLat: 35.695,
      destLng: 139.753,
    });

    expect(calendar).toContain("DTSTART:20260718T092500");
    expect(calendar).toContain("DTEND:20260718T102000");
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
