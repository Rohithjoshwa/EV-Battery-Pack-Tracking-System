import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import "./App.css";

const API = "http://localhost:5000/api";
const PROJECT_TITLE = "EV Battery Pack Tracking System";
const COMPANY_TITLE = "";
const statuses = ["Cell Inspection", "Module Assembly", "Pack Assembly", "Testing", "Ready for Dispatch", "Dispatched"];
const initialForm = { pack_id: "", model: "", voltage: "", temperature: "", soc: "", soh: "", status: "Cell Inspection", defect_status: "Good", remarks: "" };
const initialSupplier = { name: "", contact: "", material: "", location: "" };
const initialMaintenance = { pack_id: "", service_type: "", engineer: "", notes: "" };

export default function App() {
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState("login");
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("ev_user") || "null"));
  const [authForm, setAuthForm] = useState({ name: "", email: "admin@evtrack.com", password: "1234" });
  const [activePage, setActivePage] = useState("Dashboard");
  const [packs, setPacks] = useState([]);
  const [dashboard, setDashboard] = useState({});
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState([]);
  const [historyTitle, setHistoryTitle] = useState("");
  const [alerts, setAlerts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierForm, setSupplierForm] = useState(initialSupplier);
  const [maintenance, setMaintenance] = useState([]);
  const [maintenanceForm, setMaintenanceForm] = useState(initialMaintenance);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1400);
    return () => clearTimeout(timer);
  }, []);

  const loadData = async () => {
    try {
      const [packRes, dashRes, alertRes, supplierRes, maintenanceRes] = await Promise.all([
        axios.get(`${API}/battery?search=${encodeURIComponent(search)}`),
        axios.get(`${API}/dashboard`),
        axios.get(`${API}/alerts`),
        axios.get(`${API}/suppliers`),
        axios.get(`${API}/maintenance`)
      ]);
      setPacks(packRes.data);
      setDashboard(dashRes.data);
      setAlerts(alertRes.data);
      setSuppliers(supplierRes.data);
      setMaintenance(maintenanceRes.data);
    } catch (error) {
      setMessage(error.response?.data?.error || "Backend is not connected. Run backend on http://localhost:5000");
    }
  };

  useEffect(() => {
    if (!loading && user) loadData();
  }, [loading, search, user]);

  const statusChart = useMemo(() => statuses.map((status) => {
    const found = (dashboard.statusRows || []).find((r) => r.name === status);
    return { name: status, value: found ? found.value : 0 };
  }), [dashboard]);

  const authChange = (e) => setAuthForm({ ...authForm, [e.target.name]: e.target.value });
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const supplierChange = (e) => setSupplierForm({ ...supplierForm, [e.target.name]: e.target.value });
  const maintenanceChange = (e) => setMaintenanceForm({ ...maintenanceForm, [e.target.name]: e.target.value });

  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      const endpoint = authMode === "login" ? "login" : "register";
      const res = await axios.post(`${API}/auth/${endpoint}`, authForm);
      localStorage.setItem("ev_user", JSON.stringify(res.data.user));
      setUser(res.data.user);
      setMessage(res.data.message);
    } catch (error) {
      setMessage(error.response?.data?.error || "Authentication failed.");
    }
  };

  const logout = () => {
    localStorage.removeItem("ev_user");
    setUser(null);
    setActivePage("Dashboard");
  };

  const generateId = async () => {
    if (!form.model.trim()) return setMessage("Type Battery Model first, then click Generate ID.");
    const res = await axios.post(`${API}/generate-pack-id`, { model: form.model });
    setForm({ ...form, pack_id: res.data.pack_id });
    setMessage(`Generated ID: ${res.data.pack_id}`);
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await axios.put(`${API}/battery/${editingId}`, form);
        setMessage("Battery tracking status updated successfully.");
      } else {
        const res = await axios.post(`${API}/battery`, form);
        setMessage(`Battery pack added successfully: ${res.data.pack_id}`);
      }
      setForm(initialForm);
      setEditingId(null);
      await loadData();
      setActivePage("Battery Records");
    } catch (error) {
      setMessage(error.response?.data?.error || "Unable to save battery pack.");
    }
  };

  const editPack = (pack) => {
    setEditingId(pack.id);
    setForm({ pack_id: pack.pack_id, model: pack.model, voltage: pack.voltage, temperature: pack.temperature, soc: pack.soc, soh: pack.soh, status: pack.status, defect_status: pack.defect_status, remarks: pack.remarks || "" });
    setActivePage("Add Battery");
  };

  const deletePack = async (id) => {
    if (!confirm("Delete this battery pack?")) return;
    await axios.delete(`${API}/battery/${id}`);
    setMessage("Battery pack deleted.");
    loadData();
  };

  const loadHistory = async (pack) => {
    const res = await axios.get(`${API}/battery/${pack.id}/history`);
    setHistory(res.data);
    setHistoryTitle(pack.pack_id);
    setActivePage("History");
  };

  const addSupplier = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/suppliers`, supplierForm);
      setSupplierForm(initialSupplier);
      setMessage("Supplier added successfully.");
      loadData();
    } catch (error) { setMessage(error.response?.data?.error || "Unable to add supplier."); }
  };

  const addMaintenance = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/maintenance`, maintenanceForm);
      setMaintenanceForm(initialMaintenance);
      setMessage("Maintenance record added successfully.");
      loadData();
    } catch (error) { setMessage(error.response?.data?.error || "Unable to add maintenance record."); }
  };

  const progressPercent = (status) => Math.round(((statuses.indexOf(status) + 1) / statuses.length) * 100);
  const navItems = ["Dashboard", "Add Battery", "Battery Records", "Alerts", "Suppliers", "Maintenance", "History", "Settings"];

  if (loading) return <Loading />;
  if (!user) return <AuthPage mode={authMode} setMode={setAuthMode} form={authForm} change={authChange} submit={handleAuth} message={message} />;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><span>⚡</span><div><strong>EV Track</strong><small>Battery Pack Monitoring</small></div></div>
        <nav>{navItems.map((item) => <button key={item} className={activePage === item ? "active" : ""} onClick={() => setActivePage(item)}>{item}</button>)}</nav>
        <div className="profile"><strong>{user.name}</strong><small>{user.email}</small><button onClick={logout}>Logout</button></div>
      </aside>
      <main className="app">
        <header className="hero">
          <div><p className="eyebrow">Live Battery Intelligence</p><h1>{PROJECT_TITLE}</h1><p>Track pack ID, voltage, temperature, SoC, SoH, defects, suppliers, maintenance and dispatch status.</p></div>
          <div className="hero-badge"><span>LIVE</span><strong>{dashboard.totalPacks || 0}</strong><small>Total Packs</small></div>
        </header>
        {message && <div className="message" onClick={() => setMessage("")}>{message}</div>}
        {activePage === "Dashboard" && <Dashboard dashboard={dashboard} statusChart={statusChart} />}
        {activePage === "Add Battery" && <AddBattery editingId={editingId} form={form} change={change} generateId={generateId} submit={submit} setEditingId={setEditingId} setForm={setForm} />}
        {activePage === "Battery Records" && <BatteryRecords packs={packs} search={search} setSearch={setSearch} progressPercent={progressPercent} editPack={editPack} loadHistory={loadHistory} deletePack={deletePack} />}
        {activePage === "Alerts" && <Alerts alerts={alerts} />}
        {activePage === "Suppliers" && <Suppliers suppliers={suppliers} form={supplierForm} change={supplierChange} submit={addSupplier} />}
        {activePage === "Maintenance" && <Maintenance packs={packs} records={maintenance} form={maintenanceForm} change={maintenanceChange} submit={addMaintenance} />}
        {activePage === "History" && <History history={history} historyTitle={historyTitle} />}
        {activePage === "Settings" && <Settings title={PROJECT_TITLE} company="Battery Pack Monitoring" />}
      </main>
    </div>
  );
}

function Loading() {
  return <div className="loading-page"><div className="phone-card"><div className="logo-ring"><div className="battery-icon"><div></div></div></div><h1>EV Track</h1><p>{PROJECT_TITLE}</p><div className="loading-bar"><span></span></div></div></div>;
}

function AuthPage({ mode, setMode, form, change, submit, message }) {
  return <div className="auth-page"><div className="auth-card"><div className="auth-left"><p className="eyebrow">Live Battery Intelligence</p><h1>{PROJECT_TITLE}</h1><p>Login to manage EV battery packs, health alerts, supplier records and maintenance history.</p><div className="sample-login">Sample Login: <b>admin@evtrack.com</b> / <b>1234</b></div></div><form onSubmit={submit} className="auth-form"><h2>{mode === "login" ? "Login" : "Register"}</h2>{message && <div className="mini-message">{message}</div>}{mode === "register" && <input name="name" value={form.name} onChange={change} placeholder="Full Name" required />}<input name="email" value={form.email} onChange={change} placeholder="Email" required /><input name="password" type="password" value={form.password} onChange={change} placeholder="Password" required /><button type="submit">{mode === "login" ? "Login" : "Create Account"}</button><button type="button" className="ghost" onClick={() => setMode(mode === "login" ? "register" : "login")}>{mode === "login" ? "New user? Register" : "Already registered? Login"}</button></form></div></div>;
}

function Dashboard({ dashboard, statusChart }) {
  return <><section className="cards"><Card label="Total Packs" value={dashboard.totalPacks || 0} /><Card label="Defective" value={dashboard.defectivePacks || 0} type="danger" /><Card label="Ready" value={dashboard.readyPacks || 0} type="success" /><Card label="Dispatched" value={dashboard.dispatchedPacks || 0} /><Card label="Active Alerts" value={dashboard.alertPacks || 0} type="danger" /><Card label="Avg SoH" value={`${dashboard.avgSoh || 0}%`} /></section><section className="grid-two"><div className="panel"><h2>Production Stage Dashboard</h2><ResponsiveContainer width="100%" height={270}><BarChart data={statusChart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" angle={-15} textAnchor="end" height={70} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" /></BarChart></ResponsiveContainer></div><div className="panel"><h2>Battery Health Dashboard</h2><ResponsiveContainer width="100%" height={270}><LineChart data={dashboard.healthRows || []}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="pack_id" /><YAxis /><Tooltip /><Line type="monotone" dataKey="soc" /><Line type="monotone" dataKey="soh" /><Line type="monotone" dataKey="temperature" /></LineChart></ResponsiveContainer></div></section></>;
}
function Card({ label, value, type = "" }) { return <div className={`card ${type}`}><p>{label}</p><h2>{value}</h2></div>; }
function AddBattery({ editingId, form, change, generateId, submit, setEditingId, setForm }) { return <section className="panel"><h2>{editingId ? "Update Battery Tracking Details" : "Add New Battery Pack"}</h2><form onSubmit={submit} className="battery-form"><div className="id-row"><input name="pack_id" value={form.pack_id} onChange={change} placeholder="Battery Pack ID" required /><button type="button" onClick={generateId}>Generate ID</button></div><input name="model" value={form.model} onChange={change} placeholder="Battery Model example: LFP-48V-30Ah" required /><input name="voltage" type="number" step="0.01" value={form.voltage} onChange={change} placeholder="Voltage" required /><input name="temperature" type="number" step="0.01" value={form.temperature} onChange={change} placeholder="Temperature" required /><input name="soc" type="number" min="0" max="100" value={form.soc} onChange={change} placeholder="State of Charge %" required /><input name="soh" type="number" min="0" max="100" value={form.soh} onChange={change} placeholder="State of Health %" required /><select name="status" value={form.status} onChange={change}>{statuses.map((s) => <option key={s}>{s}</option>)}</select><select name="defect_status" value={form.defect_status} onChange={change}><option>Good</option><option>Defective</option></select><input name="remarks" value={form.remarks} onChange={change} placeholder="Remarks example: Passed testing" /><button className="submit" type="submit">{editingId ? "Update Tracking Status" : "Add Battery Pack"}</button>{editingId && <button type="button" className="ghost" onClick={() => { setEditingId(null); setForm(initialForm); }}>Cancel Edit</button>}</form></section>; }
function BatteryRecords({ packs, search, setSearch, progressPercent, editPack, loadHistory, deletePack }) { return <section className="panel"><div className="table-head"><h2>Battery Pack Records</h2><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search pack, model, status..." /></div><div className="table-wrap"><table><thead><tr><th>Pack ID</th><th>Model</th><th>Voltage</th><th>Temp</th><th>SoC</th><th>SoH</th><th>Status Progress</th><th>Defect</th><th>Actions</th></tr></thead><tbody>{packs.map((pack) => <tr key={pack.id}><td>{pack.pack_id}</td><td>{pack.model}</td><td>{pack.voltage}V</td><td>{pack.temperature}°C</td><td>{pack.soc}%</td><td>{pack.soh}%</td><td><div className="progress"><span style={{ width: `${progressPercent(pack.status)}%` }}></span></div><small>{pack.status}</small></td><td className={pack.defect_status === "Defective" ? "bad" : "good"}>{pack.defect_status}</td><td><button onClick={() => editPack(pack)}>Edit</button><button onClick={() => loadHistory(pack)}>History</button><button className="delete" onClick={() => deletePack(pack.id)}>Delete</button></td></tr>)}{!packs.length && <tr><td colSpan="9">No battery packs found. Add your first battery pack.</td></tr>}</tbody></table></div></section>; }
function Alerts({ alerts }) { return <section className="panel"><h2>Alerts & Critical Notifications</h2><div className="alert-grid">{alerts.map((a) => <div className="alert-card" key={a.id}><strong>{a.alert_message}</strong><p>{a.pack_id} | {a.model}</p><small>Temp: {a.temperature}°C | SoC: {a.soc}% | SoH: {a.soh}%</small></div>)}{!alerts.length && <p className="empty">No critical alerts. All packs are normal.</p>}</div></section>; }
function Suppliers({ suppliers, form, change, submit }) { return <section className="grid-two"><div className="panel"><h2>Add Supplier</h2><form onSubmit={submit} className="mini-form"><input name="name" value={form.name} onChange={change} placeholder="Supplier Name" required /><input name="contact" value={form.contact} onChange={change} placeholder="Contact / Email" /><input name="material" value={form.material} onChange={change} placeholder="Material: Cells, BMS, Casing" required /><input name="location" value={form.location} onChange={change} placeholder="Location" /><button type="submit">Add Supplier</button></form></div><div className="panel"><h2>Supplier List</h2>{suppliers.map((s) => <div className="list-card" key={s.id}><strong>{s.name}</strong><p>{s.material}</p><small>{s.contact} | {s.location}</small></div>)}{!suppliers.length && <p className="empty">No suppliers added yet.</p>}</div></section>; }
function Maintenance({ packs, records, form, change, submit }) { return <section className="grid-two"><div className="panel"><h2>Add Maintenance Record</h2><form onSubmit={submit} className="mini-form"><select name="pack_id" value={form.pack_id} onChange={change} required><option value="">Select Pack ID</option>{packs.map((p) => <option key={p.id}>{p.pack_id}</option>)}</select><input name="service_type" value={form.service_type} onChange={change} placeholder="Service Type" required /><input name="engineer" value={form.engineer} onChange={change} placeholder="Engineer Name" /><input name="notes" value={form.notes} onChange={change} placeholder="Notes" /><button type="submit">Save Maintenance</button></form></div><div className="panel"><h2>Maintenance History</h2>{records.map((r) => <div className="list-card" key={r.id}><strong>{r.pack_id}</strong><p>{r.service_type}</p><small>{r.engineer} | {r.notes}</small></div>)}{!records.length && <p className="empty">No maintenance records yet.</p>}</div></section>; }
function History({ history, historyTitle }) { return <section className="panel"><h2>Tracking History {historyTitle && `: ${historyTitle}`}</h2><div className="timeline">{history.map((item) => <div className="timeline-item" key={item.id}><strong>{item.status}</strong><p>Voltage: {item.voltage}V | Temp: {item.temperature}°C | SoC: {item.soc}% | SoH: {item.soh}% | {item.defect_status}</p><small>{new Date(item.created_at).toLocaleString()}</small></div>)}{!history.length && <p className="empty">Click History in Battery Records to view tracking history.</p>}</div></section>; }
function Settings({ title, company }) { return <section className="panel settings"><h2>Project Settings</h2><div className="list-card"><strong>Project Title</strong><p>{title}</p></div><div className="list-card"><strong>Company / Brand Name</strong><p>{company}</p></div><div className="list-card"><strong>Theme</strong><p>Premium black, beige and electric blue EV dashboard design</p></div></section>; }
