"use client";

import { Departure } from "../types/transit";

interface DeparturesListProps {
  departures: Departure[];
  loading: boolean;
  error: string | null;
}

export default function DeparturesList({
  departures,
  loading,
  error,
}: DeparturesListProps) {
  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <span
          className="loading loading-spinner loading-lg"
          role="status"
        ></span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error" data-testid="error-message">
        <span>{error}</span>
      </div>
    );
  }

  if (departures.length === 0) {
    return (
      <div className="alert alert-info" data-testid="no-departures">
        <span>
          出発便が見つかりませんでした。条件を変更して再度お試しください。
        </span>
      </div>
    );
  }

  // 時刻をフォーマットする関数
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // 遅延表示のための関数
  const renderDelay = (departure: Departure) => {
    if (!departure.realtime) {
      return <span className="text-gray-500">（時刻表）</span>;
    }

    if (departure.delay === 0) {
      return <span className="text-green-600">（定刻）</span>;
    }

    return (
      <span className="text-red-600">
        （{Math.round(departure.delay! / 60)}分遅れ）
      </span>
    );
  };

  return (
    <div className="overflow-x-auto" data-testid="departures-list">
      <table className="table table-zebra w-full">
        <thead>
          <tr>
            <th>時刻</th>
            <th>路線</th>
            <th>駅名</th>
            <th>状態</th>
          </tr>
        </thead>
        <tbody>
          {departures.map((departure, index) => (
            <tr key={index} data-testid={`departure-${index}`}>
              <td className="font-bold">
                {formatTime(departure.scheduledTime)}
              </td>
              <td>{departure.routeName}</td>
              <td>{departure.stopName}</td>
              <td>{renderDelay(departure)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
