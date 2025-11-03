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

export default function App() {
  const [metrics, setMetrics] = useState(null); // business metrics
  const [performance, setPerformance] = useState(null); // performance metrics
  const [alerts, setAlerts] = useState([]);
  const [totalAlerts, setTotalAlerts] = useState(0); // tổng số alert
  const [transactions, setTransactions] = useState([]);

  // format tiền Việt Nam Đồng
  const formatVND = (value) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(value);

  const formatNumber = (v) => {
    if (v == null || Number.isNaN(v)) return "-";
    return Number(v).toFixed(2);
  };

  useEffect(() => {
    const socketUrl = "http://localhost:9191/ws";
    const socket = new SockJS(socketUrl);

    const client = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,
      debug: (str) => console.debug("[STOMP DEBUG]", str),
      onConnect: () => {
        console.log("✅ Connected to WebSocket (STOMP)");

        // business metrics
        client.subscribe("/topic/metrics", (message) => {
          try {
            const payload = JSON.parse(message.body);
            setMetrics(payload);
          } catch (e) {
            console.warn("Cannot parse /topic/metrics message", e);
          }
        });

        // alerts
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

        // transactions
        client.subscribe("/topic/transactions", (message) => {
          try {
            const tx = JSON.parse(message.body);
            const point = {
              id: `${tx.transactionId}-${Date.now()}-${Math.random()}`,
              amount: Number(tx.amount) || 0,
              time: new Date().toLocaleTimeString(),
            };
            setTransactions((prev) => {
              const updated = [...prev, point];
              return updated.slice(-200);
            });
          } catch (e) {
            console.warn("Cannot parse /topic/transactions message", e);
          }
        });

        // performance metrics
        client.subscribe("/topic/performance", (message) => {
          try {
            const payload = JSON.parse(message.body);
            setPerformance(payload);
          } catch (e) {
            console.warn("Cannot parse /topic/performance message", e);
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
  }, []);

  return (
    <div className="container">
      <h1>⚡ Real-time Transaction Dashboard</h1>

      {/* CHART */}
      <div className="chart-wrapper">
        <div className="chart-container">
          {transactions.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={transactions}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
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
                  contentStyle={{ backgroundColor: "#fff", border: "1px solid #ccc" }}
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
                <StatCard label="🚀 Throughput (tx/s)" value={formatNumber(performance.throughputWindowTxPerSec)} color="#6f42c1" />
                <StatCard label="📦 Pending (backlog)" value={performance.pending} color="#6c757d" />
                <StatCard label="⏱️ Avg processing (ms)" value={formatNumber(performance.avgProcessingMs)} color="#17a2b8" />
              </>
            )}
          </div>
        </div>

        {/* ALERTS */}
        <div className="card alerts">
          <h2>⚠️ Alerts ({totalAlerts})</h2> {/* hiển thị tổng số alert */}
          <ul>
            {alerts.map((a, idx) => (
              <li key={`${a.transactionId || idx}-${idx}`}>
                🧨 <b>{a.userId}</b> — {a.transactionId} —{" "}
                <span className="alert-amount">{formatVND(a.amount)}</span> —{" "}
                <span className="alert-reason">{a.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="footer">
        Made with ❤️ using <b>Spring Boot</b> + <b>RxJava</b> + <b>React</b>
      </div>
    </div>
  );
}
