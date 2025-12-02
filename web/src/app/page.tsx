/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type RateOption = 30000 | 40000;

type Entry = {
  id: string;
  plateNumber: string;
  yukBilanKg: number;
  yuksizKg: number;
  sofVazinKg: number;
  dateISO: string;
  rate: RateOption;
  price: number;
  checkNumber?: string;
};

function formatNumber(n: number) {
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("en-US");
}

function useLocalStorage<T>(key: string, initial: T) {
  const [val, setVal] = useState<T>(initial);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setVal(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch {
      /* ignore */
    }
  }, [key, val]);
  return [val, setVal] as const;
}

function matchIncludes(values: (string | number)[], q: string) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return values.some((v) => String(v).toLowerCase().includes(needle));
}

function highlight(text: string | number, q: string): React.ReactNode {
  const s = String(text);
  const needle = q.trim();
  if (!needle) return s;
  const idx = s.toLowerCase().indexOf(needle.toLowerCase());
  if (idx === -1) return s;
  const before = s.slice(0, idx);
  const mid = s.slice(idx, idx + needle.length);
  const after = s.slice(idx + needle.length);
  return (
    <>
      {before}
      <span className="red">{mid}</span>
      {highlight(after, q)}
    </>
  );
}

export default function Home() {
  const [theme, setTheme] = useLocalStorage<"light" | "dark">("theme", "light");
  const [entries, setEntries] = useLocalStorage<Entry[]>("entries", []);
  const [search, setSearch] = useState("");
  const [alarmOn, setAlarmOn] = useLocalStorage<boolean>("alarm", true);

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [plateNumber, setPlateNumber] = useState("");
  const [yukBilanKg, setYukBilanKg] = useState<number | "">("");
  const [yuksizKg, setYuksizKg] = useState<number | "">("");
  const [sofVazinKg, setSofVazinKg] = useState(0);
  const [dateISO, setDateISO] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [rate, setRate] = useState<RateOption>(30000);
  const [price, setPrice] = useState<number>(30000);
  const [checkNumber, setCheckNumber] = useState<string>("");

  const audioCtxRef = useRef<AudioContext | null>(null);

  // Theme apply
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Compute sof vazi?n and price
  useEffect(() => {
    const yb = typeof yukBilanKg === "number" ? yukBilanKg : 0;
    const yz = typeof yuksizKg === "number" ? yuksizKg : 0;
    const net = Math.max(0, yb - yz);
    setSofVazinKg(net);
    setPrice(rate);

    // Alarm conditions: negative net weight (if user typed smaller with-load than empty)
    if (alarmOn && yb < yz) {
      try {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const ctx = audioCtxRef.current;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.26);
      } catch {
        /* ignore */
      }
    }
  }, [yukBilanKg, yuksizKg, rate, alarmOn]);

  const filtered = useMemo(() => {
    if (!search.trim()) return entries;
    return entries.filter((e) =>
      matchIncludes(
        [
          e.plateNumber,
          e.yukBilanKg,
          e.yuksizKg,
          e.sofVazinKg,
          e.price,
          new Date(e.dateISO).toLocaleDateString(),
        ],
        search
      )
    );
  }, [entries, search]);

  function resetForm() {
    setEditingId(null);
    setPlateNumber("");
    setYukBilanKg("");
    setYuksizKg("");
    setSofVazinKg(0);
    setDateISO(new Date().toISOString().slice(0, 10));
    setRate(30000);
    setPrice(30000);
    setCheckNumber("");
  }

  function onSubmit() {
    const yb = typeof yukBilanKg === "number" ? yukBilanKg : 0;
    const yz = typeof yuksizKg === "number" ? yuksizKg : 0;
    const net = Math.max(0, yb - yz);
    const rec: Entry = {
      id: editingId ?? crypto.randomUUID(),
      plateNumber: plateNumber.trim(),
      yukBilanKg: yb,
      yuksizKg: yz,
      sofVazinKg: net,
      dateISO,
      rate,
      price: rate,
      checkNumber: checkNumber.trim() || undefined,
    };
    if (editingId) {
      setEntries((arr) => arr.map((x) => (x.id === editingId ? rec : x)));
    } else {
      setEntries((arr) => [rec, ...arr]);
    }
    resetForm();
  }

  function onEdit(id: string) {
    const rec = entries.find((e) => e.id === id);
    if (!rec) return;
    setEditingId(rec.id);
    setPlateNumber(rec.plateNumber);
    setYukBilanKg(rec.yukBilanKg);
    setYuksizKg(rec.yuksizKg);
    setSofVazinKg(rec.sofVazinKg);
    setDateISO(rec.dateISO);
    setRate(rec.rate);
    setPrice(rec.price);
    setCheckNumber(rec.checkNumber ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function onDelete(id: string) {
    setEntries((arr) => arr.filter((e) => e.id !== id));
  }

  function onPrint() {
    window.print();
  }

  function onReload() {
    location.reload();
  }

  const netIsNegative =
    typeof yukBilanKg === "number" &&
    typeof yuksizKg === "number" &&
    yukBilanKg < yuksizKg;

  return (
    <div className="container">
      {/* Top area */}
      <div className="panel topbar">
        <div className="logo" title="Caravan Weighbridge">
          <span className="camels">????</span>
          <span>Caravan Weighbridge</span>
        </div>
        <div className="spacer" />

        {/* Search bar with moon icon */}
        <div className="search">
          <input
            className="input"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {/* Moon icon toggles theme */}
          <svg
            className="moon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            viewBox="0 0 24 24"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 1 0 9.79 9.79z" />
          </svg>
        </div>

        {/* Alarm toggle */}
        <button
          className={`alarm ${alarmOn ? "active" : ""}`}
          onClick={() => setAlarmOn((v) => !v)}
          title="Toggle alarm"
        >
          <svg className="icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2Zm6-6V11a6 6 0 0 0-4-5.65V4a2 2 0 1 0-4 0v1.35A6 6 0 0 0 6 11v5l-2 2v1h16v-1l-2-2Z" />
          </svg>
          <span>{alarmOn ? "Alarm ON" : "Alarm OFF"}</span>
        </button>
      </div>

      {/* Form */}
      <div className="panel formPanel" style={{ marginTop: 16, padding: 16 }}>
        <div className="toolbar" style={{ padding: 0, marginBottom: 12 }}>
          <button className="btn primary" onClick={onSubmit}>
            {editingId ? "Save" : "Add"}
          </button>
          {editingId && (
            <button className="btn ghost" onClick={resetForm}>
              Cancel Edit
            </button>
          )}
          <div className="spacer" />
          <button className="btn" onClick={onPrint}>Print</button>
          <button className="btn" onClick={onReload}>Reload</button>
        </div>

        <div className="grid3" style={{ marginBottom: 12 }}>
          <div className="field">
            <label className="label">Plate Number</label>
            <input
              className="input"
              value={plateNumber}
              onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
              placeholder="ABC 123"
            />
          </div>
          <div className="field">
            <label className="label">Yuk bilan (Kg)</label>
            <input
              className="input"
              inputMode="numeric"
              value={yukBilanKg}
              onChange={(e) =>
                setYukBilanKg(e.target.value === "" ? "" : Number(e.target.value.replaceAll(",", "")))
              }
              placeholder="e.g. 12000"
            />
          </div>
          <div className="field">
            <label className="label">Yuksiz (Kg)</label>
            <input
              className="input"
              inputMode="numeric"
              value={yuksizKg}
              onChange={(e) =>
                setYuksizKg(e.target.value === "" ? "" : Number(e.target.value.replaceAll(",", "")))
              }
              placeholder="e.g. 8000"
            />
          </div>
        </div>

        <div className="grid3" style={{ marginBottom: 12 }}>
          <div className="field">
            <label className="label">Sof Vazin (Kg)</label>
            <input className="input readonly" readOnly value={formatNumber(sofVazinKg)} />
            {netIsNegative && (
              <div className="label bad">With-load must be greater than empty weight.</div>
            )}
          </div>
          <div className="field">
            <label className="label">Sana (Date)</label>
            <input
              className="input"
              type="date"
              value={dateISO}
              onChange={(e) => setDateISO(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="label">Check Number (add-on)</label>
            <input
              className="input"
              value={checkNumber}
              onChange={(e) => setCheckNumber(e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>

        <div className="toolbar" style={{ padding: 0 }}>
          <div className="rate">
            <span className="label">Summa:</span>
            <label>
              <input
                type="radio"
                name="rate"
                checked={rate === 30000}
                onChange={() => setRate(30000)}
              />
              30,000
            </label>
            <label>
              <input
                type="radio"
                name="rate"
                checked={rate === 40000}
                onChange={() => setRate(40000)}
              />
              40,000
            </label>
          </div>
          <div style={{ marginLeft: 12 }}>
            <span className="label">Price</span>
            <div style={{ fontWeight: 700 }}>{formatNumber(price)}</div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="panel" style={{ marginTop: 16, padding: 16 }}>
        <div className="toolbar" style={{ padding: 0, marginBottom: 10 }}>
          <span className="label">Records</span>
          <div className="spacer" />
          <button
            className="btn danger"
            onClick={() => setEntries([])}
            title="Clear all"
          >
            Clear All
          </button>
        </div>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Plate_Number</th>
                <th>Yuk_bilan</th>
                <th>Sana (Date)</th>
                <th>Yuksiz</th>
                <th>Sof_Vazin</th>
                <th>Price</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const rowMatches = matchIncludes(
                  [
                    e.plateNumber,
                    e.yukBilanKg,
                    e.yuksizKg,
                    e.sofVazinKg,
                    e.price,
                    new Date(e.dateISO).toLocaleDateString(),
                  ],
                  search
                );
                const cell = (val: string | number) =>
                  search ? highlight(val, search) : String(val);
                return (
                  <tr key={e.id} style={{ opacity: rowMatches ? 1 : 0.6 }}>
                    <td title={e.checkNumber ? `Check: ${e.checkNumber}` : ""}>
                      {cell(e.plateNumber)}
                    </td>
                    <td>{cell(formatNumber(e.yukBilanKg))}</td>
                    <td>{cell(new Date(e.dateISO).toLocaleDateString())}</td>
                    <td>{cell(formatNumber(e.yuksizKg))}</td>
                    <td>{cell(formatNumber(e.sofVazinKg))}</td>
                    <td>{cell(formatNumber(e.price))}</td>
                    <td>
                      <div className="actions">
                        <button className="btn" onClick={() => onEdit(e.id)}>
                          Edit
                        </button>
                        <button className="btn danger" onClick={() => onDelete(e.id)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: 20, color: "var(--muted)" }}>
                    No records
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
