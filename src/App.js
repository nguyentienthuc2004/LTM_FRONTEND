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

export default function App() {
  const [metrics, setMetrics] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [transactions, setTransactions] = useState([]);

  // format tiền Việt Nam Đồng
  const formatVND = (value) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(value);

  useEffect(() => {
    const socketUrl = "http://localhost:9191/ws";
    const socket = new SockJS(socketUrl);

    const client = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,
      debug: (str) => console.debug("[STOMP DEBUG]", str),
      onConnect: () => {
        console.log("✅ Connected to WebSocket (STOMP)");

        client.subscribe("/topic/metrics", (message) => {
          try {
            const payload = JSON.parse(message.body);
            setMetrics(payload);
          } catch (e) {
            console.warn("Cannot parse /topic/metrics message", e);
          }
        });

        client.subscribe("/topic/alerts", (message) => {
          try {
            const payload = JSON.parse(message.body);
            setAlerts((prev) => [payload, ...prev].slice(0, 50));
          } catch (e) {
            console.warn("Cannot parse /topic/alerts message", e);
          }
        });

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
              return updated.slice(-200); // giữ 200 điểm gần nhất
            });
          } catch (e) {
            console.warn("Cannot parse /topic/transactions message", e);
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
                  label={{
                    value: "Giới hạn 10.000",
                    position: "top",
                    fill: "#ef4444",
                  }}
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

      {/* METRICS & ALERTS */}
      <div className="info-row">
        <div className="card metrics">
          <h2>📊 Metrics</h2>
          {metrics ? (
            <div>
              <p><b>Tổng giao dịch nhận được:</b> {metrics.totalTransactions}</p>
              <p><b>Tổng giao dịch hợp lệ:</b> {metrics.totalValid}</p>
              <p><b>Tổng tiền:</b> {formatVND(metrics.sumAmount)}</p>
              <p><b>Giao dịch lớn nhất:</b> {formatVND(metrics.maxAmount)}</p>
              <p><b>Trung bình:</b> {formatVND(metrics.avgAmount)}</p>
              <h4>Top {metrics.topK?.length || 0} giao dịch</h4>
              <ol className="top-list">
                {metrics.topK?.map((tx, idx) => (
                  <li key={`${tx.transactionId}-${idx}`}>
                    <span className="tx-id">{tx.transactionId}</span> —{" "}
                    <span className="tx-user">{tx.userId}</span> —{" "}
                    <span className="tx-amount">{formatVND(tx.amount)}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <p>Chưa có dữ liệu metrics</p>
          )}
        </div>

        <div className="card alerts">
          <h2>⚠️ Alerts</h2>
          <ul>
            {alerts.map((a, idx) => (
              <li key={`${a.transactionId}-${idx}`}>
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
