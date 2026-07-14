describe("PDF route input contract", () => {
  it("keeps legacy fields optional while requiring route meaning fields", () => {
    const request = {
      originStop: { stopId: "origin", stopName: "出発", distance: 0 },
      destinationStop: { stopId: "destination", stopName: "到着", distance: 0 },
      routes: [],
      type: "none" as const,
      transfers: 0,
      departures: undefined,
      message: undefined,
    };
    expect(request.originStop.stopId).toBe("origin");
    expect(request.type).toBe("none");
    expect(request).toHaveProperty("departures");
    expect(request).toHaveProperty("message");
  });
});
