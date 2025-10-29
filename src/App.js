import React, { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

function App() {
  const [trades, setTrades] = useState([]);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8884");

    ws.onopen = () => console.log("Connected to WebSocket server");

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setTrades(prev => [data, ...prev]); // không giới hạn số lượng trade
      } catch (err) {
        console.error("Invalid JSON:", event.data);
      }
    };

    ws.onerror = (err) => console.error("WebSocket error:", err);
    ws.onclose = () => console.log("WebSocket connection closed");

    return () => ws.close();
  }, []);

  // Chuẩn hóa dữ liệu cho chart
  const chartData = trades
    .map(trade => ({
      time: new Date(trade.time).toLocaleTimeString(),
      price: trade.price,
      quantity: trade.quantity
    }))
    .reverse(); // chart từ cũ đến mới

  return (
    <div style={{ padding: "20px" }}>
      <h1>Realtime Trades</h1>

      {/* Chart có scroll ngang */}
      <div style={{ overflowX: "auto", width: "100%" }}>
        <div style={{ width: Math.max(trades.length * 50, 800), height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis domain={["auto", "auto"]} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="price" stroke="#8884d8" dot={false} />
              <Line type="monotone" dataKey="quantity" stroke="#82ca9d" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <h2>All Trades</h2>

      {/* Table có scroll ngang */}
      <div style={{ overflowX: "auto" }}>
        <table border="1" cellPadding="5">
          <thead>
            <tr>
              <th>Price</th>
              <th>Quantity</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((trade, idx) => (
              <tr key={idx}>
                <td>{trade.price}</td>
                <td>{trade.quantity}</td>
                <td>{new Date(trade.time).toLocaleTimeString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;
