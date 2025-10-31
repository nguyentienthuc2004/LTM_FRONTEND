// App.js
import React, { useEffect, useState, useRef } from "react";
import "./css/style.css";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

function App() {
  const [temps, setTemps] = useState([]); // dữ liệu realtime (chart)
  const [stats, setStats] = useState(null); // thống kê 5s
  const [currentTemp, setCurrentTemp] = useState(null); // nhiệt độ hiện tại
  const [overflowCount, setOverflowCount] = useState(0); // tổng overflow
  const [bufferCapacity, setBufferCapacity] = useState(null); // capacity (nếu server gửi)
  const [lastOverflowAt, setLastOverflowAt] = useState(null); // thời điểm overflow cuối
  const wsRef = useRef(null);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8884");
    wsRef.current = ws;

    ws.onopen = () => console.log("✅ Connected to WebSocket server");

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Dữ liệu realtime (type=current)
        if (data.type === "current") {
          setCurrentTemp(data.temperature);
          setTemps((prev) => {
            const updated = [
              ...prev,
              {
                time: new Date(data.time).toLocaleTimeString(),
                temperature: data.temperature,
              },
            ];
            return updated.slice(-200); // giới hạn 200 điểm
          });
        }

        // Dữ liệu thống kê (type=stats)
        if (data.type === "stats") {
          setStats({
            avg: Number(data.avg).toFixed(2),
            max: Number(data.max).toFixed(2),
            min: Number(data.min).toFixed(2),
            current: Number(data.current).toFixed(2),
            fluctuation: Number(data.fluctuation).toFixed(2),
            rate: Number(data.rate).toFixed(2),
            count: data.count,
            throughput: Number(data.throughput).toFixed(2),
            throttled: data.throttled,
            alert: data.alert,
            bufferSize: data.bufferSize ?? null,
            bufferCapacity: data.bufferCapacity ?? null,
            totalOverflows: data.totalOverflows ?? overflowCount,
            timestamp: new Date(data.timestamp).toLocaleTimeString(),
          });

          if (data.bufferCapacity) setBufferCapacity(data.bufferCapacity);
          if (typeof data.totalOverflows === "number") setOverflowCount(data.totalOverflows);
        }

        // Sự kiện overflow (type=overflow) — server broadcast ngay khi drop sample
        if (data.type === "overflow") {
          setOverflowCount((prev) => {
            const next = data.totalOverflows ?? prev + 1;
            return next;
          });
          setLastOverflowAt(new Date(data.timestamp || Date.now()).toLocaleTimeString());
        }
      } catch (err) {
        console.error("⚠️ Invalid JSON:", event.data);
      }
    };

    ws.onerror = (err) => console.error("❌ WebSocket error:", err);
    ws.onclose = () => console.log("🔌 WebSocket connection closed");

    return () => ws.close();
  }, []);

  // màu theo mức nhiệt
  const getTempColor = (temp) => {
    if (temp == null) return "#444";
    if (temp > 35) return "#dc3545";
    if (temp < 15) return "#007bff";
    return "#28a745";
  };

  // progress % của buffer (0-100)
  const bufferPercent = () => {
    if (!stats || stats.bufferSize == null || bufferCapacity == null) return 0;
    return Math.min(100, Math.round((stats.bufferSize / bufferCapacity) * 100));
  };

  return (
    <div style={{ padding: 20, fontFamily: "Inter, Roboto, Arial, sans-serif", color: "#222" }}>
      <h1 style={{ color: "#333", marginBottom: 6 }}>🌡️ Real-time Temperature Dashboard</h1>
      <p style={{ color: "#666", marginTop: 0 }}>Demo backpressure & buffer overflow (MQTT → Server → WebSocket)</p>

      {/* Overflow banner */}
      {lastOverflowAt && (
        <div style={{
          background: "#ffe6e6",
          border: "1px solid #ffb3b3",
          color: "#a00",
          padding: "10px 12px",
          borderRadius: 6,
          marginBottom: 12
        }}>
          🚨 Overflow detected — sample dropped at {lastOverflowAt}. Total overflows: {overflowCount}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 18 }}>
        {/* Left column: current temp + small stats */}
        <div style={{ background: "#fff", padding: 16, borderRadius: 8, boxShadow: "0 2px 6px rgba(0,0,0,0.06)" }}>
          <h2 style={{ marginTop: 0 }}>Nhiệt độ hiện tại</h2>
          <div style={{ textAlign: "center", margin: "8px 0 16px" }}>
            <p style={{ fontSize: "3.2rem", margin: 0, color: getTempColor(currentTemp) }}>
              {currentTemp != null ? `${currentTemp.toFixed(2)} °C` : "⏳ Đang nhận..."}
            </p>
            <small style={{ color: "#888" }}>{stats ? `Cập nhật: ${stats.timestamp}` : "Chưa có thống kê"}</small>
          </div>

          <div style={{ marginTop: 12 }}>
            <h4 style={{ margin: "6px 0 8px" }}>Buffer</h4>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                flex: 1,
                height: 14,
                background: "#eee",
                borderRadius: 8,
                overflow: "hidden"
              }}>
                <div style={{
                  width: `${bufferPercent()}%`,
                  height: "100%",
                  background: stats && stats.throttled ? "#e74c3c" : "#4caf50",
                  transition: "width 300ms ease"
                }} />
              </div>
              <div style={{ width: 80, textAlign: "right", color: "#555" }}>
                {stats && stats.bufferSize != null ? `${stats.bufferSize}${bufferCapacity ? `/${bufferCapacity}` : ""}` : "-"}
              </div>
            </div>

            <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", color: "#666" }}>
              <div>Overflows: <strong style={{ color: "#c0392b" }}>{overflowCount}</strong></div>
              <div>Throttled: <strong style={{ color: stats && stats.throttled ? "#c0392b" : "#27ae60" }}>
                {stats && stats.throttled ? "YES" : "NO"}</strong></div>
            </div>
          </div>
        </div>

        {/* Right column: realtime chart */}
        <div style={{ background: "#fff", padding: 16, borderRadius: 8, boxShadow: "0 2px 6px rgba(0,0,0,0.06)" }}>
          <h3 style={{ marginTop: 0 }}>📈 Biểu đồ nhiệt độ thời gian thực</h3>
          <div style={{ width: "100%", height: 350 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={temps}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" minTickGap={20} />
                <YAxis domain={["auto", "auto"]} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="temperature"
                  stroke="#ff7300"
                  dot={false}
                  name="Nhiệt độ (°C)"
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Thống kê 5s */}
      <div style={{ marginTop: 18, background: "#fff", padding: 16, borderRadius: 8, boxShadow: "0 2px 6px rgba(0,0,0,0.06)" }}>
        <h3 style={{ marginTop: 0 }}>📊 Thống kê mỗi 5 giây</h3>
        {stats ? (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 12,
            marginTop: 12
          }}>
            <StatCard label="🌡️ Trung bình" value={`${stats.avg} °C`} color="#28a745" />
            <StatCard label="⬆️ Cao nhất" value={`${stats.max} °C`} color="#dc3545" />
            <StatCard label="⬇️ Thấp nhất" value={`${stats.min} °C`} color="#007bff" />
            <StatCard label="Δ Dao động" value={`${stats.fluctuation} °C`} color="#ffc107" />
            <StatCard label="📈 Tốc độ" value={`${stats.rate} °C/s`} color="#17a2b8" />
            <StatCard label="📦 Số mẫu" value={stats.count} color="#6c757d" />
            <StatCard label="🚀 Throughput" value={`${stats.throughput} mẫu/s`} color="#6f42c1" />
            <StatCard label="📦 Buffer" value={`${stats.bufferSize}${bufferCapacity ? `/${bufferCapacity}` : ""}`} color="#6c757d" />
            <StatCard label="⚙️ Trạng thái" value={stats.throttled ? "⚠️ Quá tải" : "Ổn định"} color={stats.throttled ? "#e74c3c" : "#28a745"} />
            <StatCard label="🚨 Cảnh báo nhiệt" value={stats.alert ? "Nguy hiểm" : "Bình thường"} color={stats.alert ? "#ff0000" : "#28a745"} />
          </div>
        ) : (
          <p>⏳ Đang chờ dữ liệu thống kê...</p>
        )}
      </div>
    </div>
  );
}

// small stat card
function StatCard({ label, value, color }) {
  return (
    <div style={{
      padding: 12, borderRadius: 8, border: "1px solid #f0f0f0",
      background: "#fafafa"
    }}>
      <div style={{ fontSize: 13, color: "#555", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

export default App;
