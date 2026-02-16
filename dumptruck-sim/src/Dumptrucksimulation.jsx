import React, { useState, useEffect, useRef, useCallback } from "react";

/* ───────────────────── distribution helpers ───────────────────── */
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const loadPick = [5, 5, 5, 10, 10, 10, 10, 10, 15, 15];
const weighPick = [12, 12, 12, 12, 12, 12, 12, 16, 16, 16];
const travelPick = [40, 40, 40, 40, 60, 60, 60, 80, 80, 100];

/* predetermined test arrays (index = truck id, 0 unused) */
const loadA =   [0, 10, 5, 5, 10, 15, 10, 10];
const weighA =  [0, 12, 12, 12, 16, 12, 16, 12];
const travelA = [0, 60, 100, 40, 40, 80, 60, 40];

const loadDist =   (testMode, truckId) => testMode ? loadA[truckId] : pick(loadPick);
const weighDist =  (testMode, truckId) => testMode ? weighA[truckId] : pick(weighPick);
const travelDist = (testMode, truckId) => testMode ? travelA[truckId] : pick(travelPick);

/* ────── colour palette for each truck ────── */
const TRUCK_COLORS = [
  "#ef4444", // red
  "#3b82f6", // blue
  "#22c55e", // green
  "#f59e0b", // amber
  "#a855f7", // purple
  "#06b6d4", // cyan
];

/* ───────────────────── simulation engine ───────────────────── */
function buildInitialState(endTime, testMode) {
  // FEL is kept sorted descending so pop() gives smallest-time event
  const fel = [];
  const insert = (tup) => {
    fel.push(tup);
    fel.sort((a, b) => b[1] - a[1]); // descending
  };

  insert(["e", endTime, 0]); // end event
  insert(["s", weighDist(testMode, 1), 1]); // truck 1 weighing
  insert(["l", loadDist(testMode, 3), 3]); // truck 3 loading
  insert(["l", loadDist(testMode, 2), 2]); // truck 2 loading

  return {
    time: 0,
    loadQ: [6, 5, 4], // front → back
    loader: 2,
    weighQ: [],
    scale: 1,
    fel,
    trucks: buildTruckMap(),
    finished: false,
    log: [],
    testMode,
  };
}

function buildTruckMap() {
  // initial positions of all 6 trucks
  return {
    1: { state: "weighing", progress: 0 },
    2: { state: "loading", progress: 0 },
    3: { state: "loading", progress: 0 },
    4: { state: "loadQ", progress: 0 },
    5: { state: "loadQ", progress: 0 },
    6: { state: "loadQ", progress: 0 },
  };
}

function deriveTruckPositions(snap) {
  const trucks = {};
  for (let i = 1; i <= 6; i++) trucks[i] = { state: "unknown", progress: 0 };

  // trucks being loaded (in an FEL 'l' event)
  // trucks being weighed (in an FEL 's' event)
  // trucks travelling (in an FEL 'a' event)
  snap.fel.forEach(([type, , id]) => {
    if (id === 0) return; // end-event
    if (type === "l") trucks[id] = { state: "loading" };
    else if (type === "s") trucks[id] = { state: "weighing" };
    else if (type === "a") trucks[id] = { state: "travelling" };
  });

  // trucks in loadQ
  snap.loadQ.forEach((id) => {
    trucks[id] = { state: "loadQ" };
  });

  // trucks in weighQ
  snap.weighQ.forEach((id) => {
    trucks[id] = { state: "weighQ" };
  });

  return trucks;
}

function stepSimulation(state) {
  const { fel, testMode } = state;
  if (fel.length === 0 || state.finished) return { ...state, finished: true };

  const next = { ...state, fel: [...fel], loadQ: [...state.loadQ], weighQ: [...state.weighQ], log: [...state.log] };
  const insert = (tup) => {
    next.fel.push(tup);
    next.fel.sort((a, b) => b[1] - a[1]);
  };

  const curr = next.fel.pop();
  next.time = curr[1];

  if (curr[0] === "e") {
    next.finished = true;
    next.log.push({ time: next.time, msg: "⏹ Simulation ended" });
    return next;
  }

  if (curr[0] === "s") {
    // finished weighing → start travelling
    insert(["a", next.time + travelDist(testMode, curr[2]), curr[2]]);
    next.scale = 0;
    next.log.push({ time: next.time, msg: `⚖️ Truck ${curr[2]} finished weighing → travelling` });
    if (next.weighQ.length) {
      const nw = next.weighQ.pop();
      insert(["s", next.time + weighDist(testMode, nw), nw]);
      next.scale = 1;
    }
  } else if (curr[0] === "l") {
    // finished loading → go to scale
    next.loader -= 1;
    next.log.push({ time: next.time, msg: `📦 Truck ${curr[2]} finished loading` });
    if (next.scale) {
      next.weighQ.unshift(curr[2]);
    } else {
      next.scale = 1;
      insert(["s", next.time + weighDist(testMode, curr[2]), curr[2]]);
    }
    if (next.loader < 2 && next.loadQ.length) {
      const nl = next.loadQ.pop();
      next.loader += 1;
      insert(["l", next.time + loadDist(testMode, nl), nl]);
    }
  } else if (curr[0] === "a") {
    // arrived back
    next.log.push({ time: next.time, msg: `🚛 Truck ${curr[2]} arrived back` });
    if (next.loader > 1) {
      next.loadQ.unshift(curr[2]);
    } else {
      next.loader += 1;
      insert(["l", next.time + loadDist(testMode, curr[2]), curr[2]]);
    }
  }

  next.trucks = deriveTruckPositions(next);
  return next;
}

/* ───────────────────── Truck SVG ───────────────────── */
const TruckIcon = ({ color, size = 38, label }) => (
  <svg width={size * 1.6} height={size} viewBox="0 0 64 40">
    {/* bed */}
    <rect x="0" y="6" width="38" height="24" rx="3" fill={color} />
    {/* cab */}
    <rect x="38" y="12" width="22" height="18" rx="4" fill={color} opacity={0.85} />
    {/* windshield */}
    <rect x="44" y="15" width="12" height="9" rx="2" fill="#dbeafe" opacity={0.9} />
    {/* wheels */}
    <circle cx="12" cy="34" r="5" fill="#1e293b" />
    <circle cx="30" cy="34" r="5" fill="#1e293b" />
    <circle cx="52" cy="34" r="5" fill="#1e293b" />
    <circle cx="12" cy="34" r="2" fill="#94a3b8" />
    <circle cx="30" cy="34" r="2" fill="#94a3b8" />
    <circle cx="52" cy="34" r="2" fill="#94a3b8" />
    {/* label */}
    <text x="19" y="23" textAnchor="middle" fontSize="13" fontWeight="bold" fill="white">
      {label}
    </text>
  </svg>
);

/* ───────────────────── Zone component ───────────────────── */
const Zone = ({ title, icon, children, color = "#334155" }) => (
  <div
    style={{
      background: "#1e293b",
      border: `2px solid ${color}`,
      borderRadius: 16,
      padding: "12px 16px",
      minHeight: 90,
      flex: 1,
      minWidth: 160,
    }}
  >
    <div style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
      {icon} {title}
    </div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", minHeight: 48, alignItems: "center" }}>
      {children}
    </div>
  </div>
);

/* ───────────────────── Animated truck wrapper ───────────────────── */
const AnimatedTruck = ({ id, color }) => {
  return (
    <div
      style={{
        animation: "truckBounce 0.5s ease",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <TruckIcon color={color} label={id} />
    </div>
  );
};

/* ───────────────────── MAIN COMPONENT ───────────────────── */
export default function DumpTruckSimulation() {
  const [endTime, setEndTime] = useState(200);
  const [speed, setSpeed] = useState(800); // ms per step
  const [testMode, setTestMode] = useState(false);
  const [simState, setSimState] = useState(null);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef(null);
  const logEndRef = useRef(null);

  const startSim = useCallback(() => {
    const initial = buildInitialState(endTime, testMode);
    initial.trucks = deriveTruckPositions(initial);
    setSimState(initial);
    setRunning(true);
  }, [endTime, testMode]);

  const stopSim = useCallback(() => {
    setRunning(false);
    clearInterval(intervalRef.current);
  }, []);

  const resetSim = useCallback(() => {
    stopSim();
    setSimState(null);
  }, [stopSim]);

  // auto-step
  useEffect(() => {
    if (!running || !simState) return;
    if (simState.finished) { // eslint-disable-line react-hooks/exhaustive-deps
      setRunning(false);
      return;
    }
    intervalRef.current = setInterval(() => {
      setSimState((prev) => {
        if (!prev || prev.finished) {
          clearInterval(intervalRef.current);
          setRunning(false);
          return prev;
        }
        return stepSimulation(prev);
      });
    }, speed);
    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, speed, simState?.finished]);

  // scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [simState?.log?.length]);

  // categorize trucks
  const loading = [];
  const loadQ = [];
  const weighing = [];
  const weighQ = [];
  const travelling = [];

  if (simState?.trucks) {
    Object.entries(simState.trucks).forEach(([id, t]) => {
      const numId = Number(id);
      const color = TRUCK_COLORS[numId - 1];
      const el = <AnimatedTruck key={id} id={numId} color={color} />;
      switch (t.state) {
        case "loading":
          loading.push(el);
          break;
        case "loadQ":
          loadQ.push(el);
          break;
        case "weighing":
          weighing.push(el);
          break;
        case "weighQ":
          weighQ.push(el);
          break;
        case "travelling":
          travelling.push(el);
          break;
        default:
          break;
      }
    });
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        color: "#e2e8f0",
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        padding: "24px 16px",
      }}
    >
      {/* keyframes */}
      <style>{`
        @keyframes truckBounce {
          0% { transform: translateY(12px); opacity: 0; }
          60% { transform: translateY(-4px); opacity: 1; }
          100% { transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .55; }
        }
        @keyframes roadDash {
          0% { background-position: 0 0; }
          100% { background-position: 40px 0; }
        }
      `}</style>

      {/* Header */}
      <h1
        style={{
          textAlign: "center",
          fontSize: 28,
          fontWeight: 800,
          marginBottom: 4,
          background: "linear-gradient(90deg, #38bdf8, #818cf8)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        🚛 Dump Truck Simulation
      </h1>
      <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 14, marginBottom: 20 }}>
        Discrete-event simulation of 6 dump trucks with 2 loaders &amp; 1 scale
      </p>

      {/* Controls */}
      <div
        style={{
          display: "flex",
          gap: 12,
          justifyContent: "center",
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 24,
        }}
      >
        <label style={{ fontSize: 13 }}>
          End time (min):{" "}
          <input
            type="number"
            min={50}
            max={1000}
            value={endTime}
            onChange={(e) => setEndTime(Number(e.target.value))}
            disabled={!!simState}
            style={{
              width: 70,
              padding: "4px 8px",
              borderRadius: 8,
              border: "1px solid #475569",
              background: "#0f172a",
              color: "#e2e8f0",
              fontSize: 14,
            }}
          />
        </label>

        <label
          style={{
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: simState ? "not-allowed" : "pointer",
            opacity: simState ? 0.5 : 1,
          }}
        >
          <span
            onClick={() => !simState && setTestMode((p) => !p)}
            style={{
              display: "inline-block",
              width: 40,
              height: 22,
              borderRadius: 11,
              background: testMode ? "#818cf8" : "#475569",
              position: "relative",
              transition: "background .2s",
              cursor: simState ? "not-allowed" : "pointer",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 3,
                left: testMode ? 20 : 3,
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "#fff",
                transition: "left .2s",
              }}
            />
          </span>
          {testMode ? "🧪 Test mode" : "🎲 Random mode"}
        </label>

        <label style={{ fontSize: 13 }}>
          Speed:{" "}
          <input
            type="range"
            min={100}
            max={2000}
            step={100}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            style={{ verticalAlign: "middle", accentColor: "#818cf8" }}
          />
          <span style={{ fontSize: 12, color: "#94a3b8" }}> {speed}ms</span>
        </label>

        {!simState && (
          <button onClick={startSim} style={btnStyle("#22c55e")}>
            ▶ Start
          </button>
        )}
        {simState && !simState.finished && (
          <>
            {running ? (
              <button onClick={stopSim} style={btnStyle("#f59e0b")}>
                ⏸ Pause
              </button>
            ) : (
              <button onClick={() => setRunning(true)} style={btnStyle("#22c55e")}>
                ▶ Resume
              </button>
            )}
            <button
              onClick={() =>
                setSimState((prev) => (prev && !prev.finished ? stepSimulation(prev) : prev))
              }
              disabled={running}
              style={btnStyle("#3b82f6")}
            >
              ⏭ Step
            </button>
          </>
        )}
        {simState && (
          <button onClick={resetSim} style={btnStyle("#ef4444")}>
            ↺ Reset
          </button>
        )}
      </div>

      {!simState && (
        <div style={{ textAlign: "center", color: "#64748b", marginTop: 60 }}>
          Configure end time and press <strong>Start</strong> to begin
        </div>
      )}

      {simState && (
        <>
          {/* Clock + stats bar */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 32,
              marginBottom: 20,
              flexWrap: "wrap",
              fontSize: 15,
            }}
          >
            <Stat label="⏱ Time" value={`${simState.time} min`} accent="#38bdf8" />
            <Stat label="🏗 Loaders free" value={`${simState.loader} / 2`} accent="#22c55e" />
            <Stat label="⚖️ Scale" value={simState.scale ? "Busy" : "Free"} accent={simState.scale ? "#f59e0b" : "#22c55e"} />
            <Stat label="📋 Events left" value={simState.fel.length} accent="#a855f7" />
          </div>

          {/* ───── Visual map ───── */}
          <div
            style={{
              maxWidth: 1000,
              margin: "0 auto 24px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            {/* Row 1: Loading area */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Zone title="Load Queue" icon="🅿️" color="#64748b">
                {loadQ.length ? loadQ : <Empty text="empty" />}
              </Zone>
              <Zone title={`Loading (${simState.loader}/2 loaders used)`} icon="⛏️" color="#22c55e">
                {loading.length ? loading : <Empty text="idle" />}
              </Zone>
            </div>

            {/* Road between loading and scale */}
            <Road direction="↓" />

            {/* Row 2: Scale area */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Zone title="Weigh Queue" icon="🅿️" color="#64748b">
                {weighQ.length ? weighQ : <Empty text="empty" />}
              </Zone>
              <Zone title={`Scale (${simState.scale ? "occupied" : "free"})`} icon="⚖️" color="#f59e0b">
                {weighing.length ? weighing : <Empty text="free" />}
              </Zone>
            </div>

            {/* Road between scale and travel */}
            <Road direction="↓" />

            {/* Row 3: Travelling */}
            <Zone title="Travelling to dump site & back" icon="🛣️" color="#3b82f6">
              {travelling.length ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                  {travelling.map((t, i) => (
                    <div key={i} style={{ animation: `roadDash 0.8s linear infinite`, position: "relative" }}>
                      {t}
                    </div>
                  ))}
                </div>
              ) : (
                <Empty text="no trucks on road" />
              )}
            </Zone>
          </div>

          {/* ───── Event Log ───── */}
          <div
            style={{
              maxWidth: 700,
              margin: "0 auto",
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: 12,
              padding: 16,
              maxHeight: 220,
              overflowY: "auto",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8", marginBottom: 8 }}>
              📜 Event Log
            </div>
            {simState.log.map((l, i) => (
              <div key={i} style={{ fontSize: 13, color: "#cbd5e1", padding: "2px 0", borderBottom: "1px solid #1e293b" }}>
                <span style={{ color: "#38bdf8", fontWeight: 600, marginRight: 8 }}>t={l.time}</span>
                {l.msg}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>

          {/* Finished banner */}
          {simState.finished && (
            <div
              style={{
                textAlign: "center",
                marginTop: 24,
                padding: 16,
                background: "linear-gradient(90deg, #0f172a, #1e293b, #0f172a)",
                border: "2px solid #818cf8",
                borderRadius: 12,
                fontSize: 18,
                fontWeight: 700,
              }}
            >
              ✅ Simulation complete at t = {simState.time} min
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ───── small helpers ───── */
const btnStyle = (bg) => ({
  padding: "8px 18px",
  borderRadius: 10,
  border: "none",
  background: bg,
  color: "#fff",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
  transition: "transform .1s",
});

const Stat = ({ label, value, accent }) => (
  <div style={{ textAlign: "center" }}>
    <div style={{ fontSize: 12, color: "#94a3b8" }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 800, color: accent }}>{value}</div>
  </div>
);

const Empty = ({ text }) => (
  <span style={{ color: "#475569", fontStyle: "italic", fontSize: 13 }}>{text}</span>
);

const Road = ({ direction }) => (
  <div
    style={{
      textAlign: "center",
      fontSize: 22,
      color: "#475569",
      letterSpacing: 6,
      borderLeft: "2px dashed #334155",
      borderRight: "2px dashed #334155",
      margin: "0 auto",
      width: 60,
      padding: "2px 0",
      animation: "pulse 1.5s ease-in-out infinite",
    }}
  >
    {direction}
  </div>
);
