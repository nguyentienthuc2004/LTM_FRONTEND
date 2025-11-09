// File: src/App.js
import React, { useEffect, useState } from "react";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import "./App.css";

// Component cho các card nhỏ hiển thị số đo
function StatCard({ label, value, color }) {
  return (
    <div className="stat-card" style={{ borderTop: `4px solid ${color}` }}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

function ProgressBar({ percent }) {
  const clamped = Math.max(0, Math.min(100, percent));
  let barColor = "#10b981"; // green
  if (clamped >= 90) barColor = "#dc3545"; // red
  else if (clamped >= 70) barColor = "#f59e0b"; // amber

  return (
    <div className="progress-outer" aria-hidden>
      <div
        className="progress-inner"
        style={{
          width: `${clamped}%`,
          backgroundColor: barColor,
        }}
      />
    </div>
  );
}

export default function App() {
  const [metrics, setMetrics] = useState(null); // business metrics
  const [performance, setPerformance] = useState(null); // performance metrics
  const [alerts, setAlerts] = useState([]); // stream alerts (AlertPayload)
  const [totalAlerts, setTotalAlerts] = useState(0); // tổng số alert
  const [transactions, setTransactions] = useState([]);
  const [bpAlerts, setBpAlerts] = useState([]); // các sự kiện backpressure gần đây
  const [banner, setBanner] = useState(null); // banner ngắn khi có backpressure event

  // Format tiền Việt Nam Đồng
  const formatVND = (value) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(value ?? 0);

  const formatNumber = (v) => {
    if (v == null || Number.isNaN(Number(v))) return "-";
    return Number(v).toFixed(2);
  };

  useEffect(() => {
    const socketUrl = "http://localhost:9191/ws"; // đổi nếu server khác
    const socket = new SockJS(socketUrl);

    const client = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,
      debug: (str) => console.debug("[STOMP DEBUG]", str),
      onConnect: () => {
        console.log("✅ Connected to WebSocket (STOMP)");

        // business metrics (MetricsPayload)
        client.subscribe("/topic/metrics", (message) => {
          try {
            const payload = JSON.parse(message.body);
            // MetricsPayload: totalTransactions, totalValid, sumAmount, maxAmount, avgAmount, topK (list), recentAlerts (list)
            setMetrics(payload);
          } catch (e) {
            console.warn("Cannot parse /topic/metrics message", e);
          }
        });

        // alerts (AlertPayload) - stream khi transaction > threshold
        client.subscribe("/topic/alerts", (message) => {
          try {
            const payload = JSON.parse(message.body);
            setAlerts((prev) => [payload, ...prev].slice(0, 50));
          } catch (e) {
            console.warn("Cannot parse /topic/alerts message", e);
          }
        });

        // tổng số alert
        client.subscribe("/topic/alertStats", (message) => {
          try {
            const payload = JSON.parse(message.body);
            setTotalAlerts(payload.totalAlerts || 0);
          } catch (e) {
            console.warn("Cannot parse /topic/alertStats message", e);
          }
        });

        // transactions (stream chart) - server gửi Transaction objects
        client.subscribe("/topic/transactions", (message) => {
          try {
            const tx = JSON.parse(message.body);
            const point = {
              id: `${tx.transactionId || Math.random()}-${Date.now()}`,
              amount: Number(tx.amount) || 0,
              time: new Date().toLocaleTimeString(),
              ...tx,
            };
            setTransactions((prev) => {
              const updated = [...prev, point];
              return updated.slice(-200); // lưu tối đa 200 điểm
            });
          } catch (e) {
            console.warn("Cannot parse /topic/transactions message", e);
          }
        });

        // performance metrics (perf map)
        client.subscribe("/topic/performance", (message) => {
          try {
            const payload = JSON.parse(message.body);
            // payload: { timestamp, throughputWindowTxPerSec, pending, avgProcessingMs }
            setPerformance(payload);
          } catch (e) {
            console.warn("Cannot parse /topic/performance message", e);
          }
        });

        // backpressure / overflow events
        client.subscribe("/topic/backpressure", (message) => {
          try {
            const payload = JSON.parse(message.body);
            // backend gửi { event, timestamp } (có thể mở rộng thêm fields)
            const timeStr = payload.timestamp
              ? new Date(payload.timestamp).toLocaleTimeString()
              : new Date().toLocaleTimeString();
            const bannerObj = {
              event: payload.event || "BACKPRESSURE",
              time: timeStr,
              // nếu backend gửi thêm capacity/size thì dùng luôn
              size: payload.size,
              capacity: payload.capacity,
            };
            setBanner(bannerObj);
            setBpAlerts((prev) => [payload, ...prev].slice(0, 50));

            // xóa banner sau 8s
            setTimeout(() => setBanner(null), 8000);
          } catch (e) {
            console.warn("Cannot parse /topic/backpressure message", e);
          }
        });
      },
      onStompError: (frame) => {
        console.error("❌ STOMP error", frame);
      },
    });

    client.activate();

    return () => {
      try {
        client.deactivate();
      } catch (e) {
        console.warn("Error deactivating STOMP client", e);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="container">
      <h1>⚡ Real-time Transaction Dashboard</h1>

      {/* Banner hiển thị event tràn (backpressure) */}
      {banner && (
        <div className="banner">
          🚨 <b>{banner.event}</b>
          {banner.size != null && <> — size: {banner.size}</>}
          {banner.capacity != null && <> / {banner.capacity}</>}
          <span className="banner-time"> ({banner.time})</span>
        </div>
      )}

      {/* CHART */}
      <div className="chart-wrapper">
        <div className="chart-container">
          {transactions.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={transactions}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6e6e6" />
                <XAxis
                  dataKey="time"
                  tick={{ fill: "#333", fontSize: 12 }}
                  interval={0}
                  textAnchor="middle"
                />
                <YAxis
                  tick={{ fill: "#333" }}
                  label={{
                    value: "Số tiền (VNĐ)",
                    angle: -90,
                    position: "insideLeft",
                    fill: "#333",
                  }}
                />
                <Tooltip
                  formatter={(v) => formatVND(v)}
                  contentStyle={{ backgroundColor: "#fff", border: "1px solid #eee" }}
                  labelStyle={{ color: "#333" }}
                />
                <Legend />
                <ReferenceLine
                  y={10000}
                  label={{ value: "Giới hạn 10.000", position: "top", fill: "#ef4444" }}
                  stroke="#ef4444"
                  strokeDasharray="6 3"
                />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p>Chưa có dữ liệu giao dịch</p>
          )}
        </div>
      </div>

      {/* METRICS & PERFORMANCE */}
      <div className="info-row">
        <div className="card metrics">
          <h2>📊 Metrics & Performance</h2>
          <div className="stat-grid">
            {metrics && (
              <>
                <StatCard label="📦 Tổng giao dịch nhận" value={metrics.totalTransactions} color="#6f42c1" />
                <StatCard label="✅ Giao dịch hợp lệ" value={metrics.totalValid} color="#28a745" />
                <StatCard label="💰 Tổng tiền" value={formatVND(metrics.sumAmount)} color="#ffc107" />
                <StatCard label="⬆️ Giao dịch lớn nhất" value={formatVND(metrics.maxAmount)} color="#dc3545" />
                <StatCard label="📊 Trung bình" value={formatVND(metrics.avgAmount)} color="#007bff" />
              </>
            )}

            {performance && (
              <>
                <StatCard
                  label="🚀 Throughput (tx/s)"
                  value={formatNumber(performance.throughputWindowTxPerSec)}
                  color="#6f42c1"
                />
                <StatCard
                  label="⏳ Pending (ingested - processed)"
                  value={performance.pending != null ? performance.pending : "-"}
                  color="#6c757d"
                />
                <StatCard
                  label="⏱️ Avg processing (ms)"
                  value={formatNumber(performance.avgProcessingMs || performance.avgProcessingMs === 0 ? performance.avgProcessingMs : performance.avgProcessingMs)}
                  color="#17a2b8"
                />
              </>
            )}
          </div>
        </div>

        {/* ALERTS (stream từ /topic/alerts) */}
        <div className="card alerts">
          <h2>⚠️ Alerts ({totalAlerts})</h2>
          <ul>
            {alerts.map((a, idx) => (
              <li key={`${a.transactionId || idx}-${idx}`}>
                🧨 <b>{a.userId}</b> — {a.transactionId} — {" "}
                <span className="alert-amount">{formatVND(a.amount)}</span> — {" "}
                <span className="alert-reason">{a.reason}</span>
              </li>
            ))}
          </ul>

          {/* Backpressure recent events */}
          {bpAlerts.length > 0 && (
            <>
              <h4>⚠ Backpressure events (gần đây)</h4>
              <ul className="bp-list">
                {bpAlerts.map((b, i) => (
                  <li key={i}>
                    <b>{b.event}</b> — {b.timestamp ? new Date(b.timestamp).toLocaleTimeString() : ""}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
