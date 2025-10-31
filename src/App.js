import React, { useEffect, useState } from "react";
import "./css/style.css"
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
  const [temps, setTemps] = useState([]); // dữ liệu realtime
  const [stats, setStats] = useState(null); // dữ liệu thống kê
  const [currentTemp, setCurrentTemp] = useState(null); // nhiệt độ hiện tại

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8884");

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
            avg: data.avg.toFixed(2),
            max: data.max.toFixed(2),
            min: data.min.toFixed(2),
            current: data.current.toFixed(2),
            fluctuation: data.fluctuation.toFixed(2),
            rate: data.rate.toFixed(2),
            count: data.count,
            throughput: data.throughput.toFixed(2),
            throttled: data.throttled,
            alert: data.alert,
            timestamp: new Date(data.timestamp).toLocaleTimeString(),
          });
        }
      } catch (err) {
        console.error("⚠️ Invalid JSON:", event.data);
      }
    };

    ws.onerror = (err) => console.error("❌ WebSocket error:", err);
    ws.onclose = () => console.log("🔌 WebSocket connection closed");

    return () => ws.close();
  }, []);

  // Hàm chọn màu theo mức nhiệt độ
  const getTempColor = (temp) => {
    if (temp > 35) return "#dc3545"; // đỏ - quá nóng
    if (temp < 15) return "#007bff"; // xanh - quá lạnh
    return "#28a745"; // xanh lá - bình thường
  };

  return (
    <div>
      <h1 style={{ color: "#333", marginBottom: "10px" }}>🌡️ Real-time Temperature Dashboard</h1>
      {/* ===================== Khối nhiệt độ hiện tại ===================== */}
      <div
        className="temperature"
      >
        <h2>Nhiệt độ hiện tại</h2>
        <p
          style={{
            fontSize: "3em",
            fontWeight: "bold",
            color: getTempColor(currentTemp),
          }}
        >
          {currentTemp ? `${currentTemp.toFixed(2)} °C` : "⏳ Đang nhận dữ liệu..."}
        </p>
        {stats && (
          <p style={{ fontSize: "0.9em", color: "#999" }}>
            Cập nhật lúc: {stats.timestamp}
          </p>
        )}
      </div>

      {/* ===================== Biểu đồ nhiệt độ realtime ===================== */}
      <div
        className="temperature-chart"
      >
        <h3>📈 Biểu đồ nhiệt độ thời gian thực</h3>
        <div style={{ width: "100%", height: 350 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={temps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis domain={["auto", "auto"]} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="temperature"
                stroke="#ff7300"
                dot={false}
                name="Nhiệt độ (°C)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ===================== Thống kê 5s ===================== */}
      <div
        className="statistic"
      >
        <h3>📊 Thống kê mỗi 5 giây</h3>
        {stats ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "15px",
              marginTop: "15px",
            }}
          >
            <StatCard label="🌡️ Trung bình" value={`${stats.avg} °C`} color="#28a745" />
            <StatCard label="⬆️ Cao nhất" value={`${stats.max} °C`} color="#dc3545" />
            <StatCard label="⬇️ Thấp nhất" value={`${stats.min} °C`} color="#007bff" />
            <StatCard label="Δ Dao động" value={`${stats.fluctuation} °C`} color="#ffc107" />
            <StatCard label="📈 Tốc độ thay đổi" value={`${stats.rate} °C/s`} color="#17a2b8" />
            <StatCard label="📦 Số mẫu nhận" value={stats.count} color="#6c757d" />
            <StatCard label="🚀 Throughput" value={`${stats.throughput} mẫu/s`} color="#6f42c1" />
            <StatCard
              label="⚙️ Trạng thái tải"
              value={stats.throttled ? "⚠️ Quá tải" : "Ổn định"}
              color={stats.throttled ? "#e74c3c" : "#28a745"}
            />
            <StatCard
              label="🚨 Cảnh báo nhiệt độ"
              value={stats.alert ? "Nguy hiểm" : "Bình thường"}
              color={stats.alert ? "#ff0000" : "#28a745"}
            />
          </div>
        ) : (
          <p>⏳ Đang chờ dữ liệu thống kê...</p>
        )}
      </div>
    </div>
  );
}

// Thành phần nhỏ hiển thị từng chỉ số
function StatCard({ label, value, color }) {
  return (
    <div
      className="stat-card"
    >
      <h4 style={{ color: "#555", fontSize: "0.95em", marginBottom: "8px" }}>{label}</h4>
      <p style={{ fontSize: "1.4em", fontWeight: "bold", color }}>{value}</p>
    </div>
  );
}

export default App;
