import React, { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { 
  AlertTriangle 
} from 'lucide-react';
import { 
  BrowserRouter, 
  Routes, 
  Route, 
  Navigate, 
  useNavigate, 
  useParams,
  useLocation 
} from 'react-router-dom';

import Header from './components/Header';
import LandingPageView from './components/LandingPageView';
import LoginView from './components/LoginView';
import DeviceOverview from './components/DeviceOverview';
import DeviceDetailView from './components/DeviceDetailView';
import DeviceManagementView from './components/DeviceManagementView';
import UserManagementView from './components/UserManagementView';

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}

function AppInner() {
  const navigate = useNavigate();
  const location = useLocation();

  // Authentication State
  const [authToken, setAuthToken] = useState(() => {
    return sessionStorage.getItem('terraflow_token') || null;
  });

  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = sessionStorage.getItem('terraflow_user');
    try {
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  // Global Device List & Status
  const [devices, setDevices] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  const showActionToast = useCallback((msg) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 4000);
  }, []);

  // Auth Handlers
  const handleLoginSuccess = (token, user) => {
    setAuthToken(token);
    setCurrentUser(user);
    sessionStorage.setItem('terraflow_token', token);
    sessionStorage.setItem('terraflow_user', JSON.stringify(user));
    navigate('/dashboard');
    showActionToast(`Selamat datang, ${user.fullName || user.username}! Anda telah berhasil masuk.`);
  };

  const handleLogout = useCallback(() => {
    setAuthToken(null);
    setCurrentUser(null);
    sessionStorage.removeItem('terraflow_token');
    sessionStorage.removeItem('terraflow_user');
    navigate('/');
  }, [navigate]);

  // Fetch all devices with user token for role-based filtering
  const fetchAllDevices = useCallback(async () => {
    if (!authToken) return;
    setLoadingDevices(true);
    try {
      const res = await fetch('/api/devices', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      const json = await res.json();
      if (json.success) {
        setDevices(json.data);
      }
    } catch (err) {
      console.error('[Fetch Devices Error]', err.message);
    } finally {
      setLoadingDevices(false);
    }
  }, [authToken]);

  useEffect(() => {
    if (authToken) {
      fetchAllDevices();
    }
  }, [authToken, fetchAllDevices]);

  // Setup Socket.IO for real-time telemetry streaming
  useEffect(() => {
    const socket = io('/', {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
    });

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Update device freshness dynamically in global state
    const updateDeviceLastSeen = (devId, ts) => {
      if (!devId) return;
      const seenIso = ts 
        ? (typeof ts === 'number' && ts < 1e11 ? new Date(ts * 1000).toISOString() : new Date(ts).toISOString()) 
        : new Date().toISOString();
      setDevices((prev) => prev.map((d) => {
        if (d.device_id === devId) {
          return { ...d, last_seen: seenIso, is_active: true };
        }
        return d;
      }));
    };

    socket.on('sensor:data', (data) => {
      if (data?.device_id) {
        updateDeviceLastSeen(data.device_id, data.timestamp);
      }
    });

    socket.on('telemetry', (payload) => {
      const dId = payload?.device_id || payload?.data?.device_id;
      const ts = payload?.data?.timestamp || payload?.timestamp;
      if (dId) {
        updateDeviceLastSeen(dId, ts);
      }
    });

    socket.on('device:status', (payload) => {
      if (payload?.device_id) {
        setDevices((prev) => prev.map((d) => {
          if (d.device_id === payload.device_id) {
            const isOnline = payload.status === 'online';
            return {
              ...d,
              is_active: payload.is_active !== undefined ? payload.is_active : isOnline,
              last_seen: payload.last_seen || (isOnline ? new Date().toISOString() : new Date(Date.now() - 3600000).toISOString())
            };
          }
          return d;
        }));
      }
    });

    // Alert notification event
    socket.on('device:alert', (payload) => {
      const alert = payload?.data || payload;
      if (alert) {
        showActionToast(`Peringatan [${alert.alert_code}]: ${alert.message}`);
        // Refresh device list to update alert badges
        fetchAllDevices();
      }
    });

    socket.on('alert:new', (alert) => {
      if (alert) {
        showActionToast(`Peringatan [${alert.alert_code}]: ${alert.message}`);
        fetchAllDevices();
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [fetchAllDevices]);

  // Stable helper to render LayoutShell inside AppInner
  const renderShell = (children, currentDevice = null, showHero = false) => (
    <LayoutShell
      currentDevice={currentDevice}
      devices={devices}
      isConnected={isConnected}
      activeAlertsCount={currentDevice ? Number(currentDevice.active_alerts_count) || 0 : 0}
      onRefresh={fetchAllDevices}
      currentUser={currentUser}
      onLogout={handleLogout}
      onGoToLanding={() => navigate(authToken ? '/dashboard' : '/')}
      onNavigate={(path) => navigate(path)}
      showHero={showHero}
      actionMessage={actionMessage}
    >
      {children}
    </LayoutShell>
  );

  return (
    <Routes>
      {/* Public Pages */}
      <Route 
        path="/" 
        element={
          authToken 
            ? <Navigate to="/dashboard" replace /> 
            : <LandingPageView onGoToLogin={() => navigate('/login')} />
        } 
      />
      <Route 
        path="/login" 
        element={
          authToken 
            ? <Navigate to="/dashboard" replace /> 
            : <LoginView onLoginSuccess={handleLoginSuccess} onBackToLanding={() => navigate('/')} />
        } 
      />

      {/* Authenticated Dashboard: Device Overview */}
      <Route 
        path="/dashboard" 
        element={
          authToken ? (
            renderShell(
              <DeviceOverview 
                devices={devices}
                loading={loadingDevices}
                onSelectDevice={(id) => navigate(`/dashboard/${id}`)}
                onRefresh={fetchAllDevices}
                currentUser={currentUser}
                onGoToManageDevices={() => navigate('/admin/devices')}
              />,
              null,
              false
            )
          ) : (
            <Navigate to="/login" replace />
          )
        } 
      />

      {/* Authenticated Dashboard: Specific Device Detail View */}
      <Route 
        path="/dashboard/:deviceId" 
        element={
          authToken ? (
            <DeviceDetailRouteWrapper 
              devices={devices}
              isConnected={isConnected}
              actionMessage={actionMessage}
              authToken={authToken}
              currentUser={currentUser}
              onLogout={handleLogout}
              onGoToLanding={() => navigate(authToken ? '/dashboard' : '/')}
              onNavigate={(path) => navigate(path)}
              showActionToast={showActionToast}
            />
          ) : (
            <Navigate to="/login" replace />
          )
        } 
      />

      {/* Admin: User Management */}
      <Route 
        path="/admin/users" 
        element={
          authToken ? (
            currentUser?.role === 'admin' ? (
              renderShell(
                <UserManagementView 
                  authToken={authToken}
                  currentUser={currentUser}
                  onActionToast={showActionToast}
                  onBackToDashboard={() => navigate('/dashboard')}
                />
              )
            ) : (
              <Navigate to="/dashboard" replace />
            )
          ) : (
            <Navigate to="/login" replace />
          )
        } 
      />

      {/* Admin: Device Management */}
      <Route 
        path="/admin/devices" 
        element={
          authToken ? (
            currentUser?.role === 'admin' ? (
              renderShell(
                <DeviceManagementView 
                  authToken={authToken}
                  onBackToDashboard={() => navigate('/dashboard')}
                  onActionToast={showActionToast}
                />
              )
            ) : (
              <Navigate to="/dashboard" replace />
            )
          ) : (
            <Navigate to="/login" replace />
          )
        } 
      />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to={authToken ? "/dashboard" : "/"} replace />} />
    </Routes>
  );
}

// --------------------------------------------------------------------------
// Top-level, statically defined Layout Shell to preserve React component identity
// --------------------------------------------------------------------------
function LayoutShell({ 
  children, 
  currentDevice = null, 
  showHero = false,
  devices = [],
  isConnected = false,
  activeAlertsCount = 0,
  actionMessage = null,
  currentUser = null,
  onRefresh,
  onLogout,
  onGoToLanding,
  onNavigate
}) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
      
      {/* 1. Corporate Header */}
      <Header 
        device={currentDevice}
        devices={devices}
        isConnected={isConnected}
        activeAlertsCount={activeAlertsCount}
        onRefresh={onRefresh}
        currentUser={currentUser}
        onLogout={onLogout}
        onGoToLanding={onGoToLanding}
        onNavigate={onNavigate}
        showHero={showHero}
      />

      {/* Main Container */}
      <main className="app-main-container">
        
        {/* Action Toast Alert Banner */}
        {actionMessage && (
          <div style={{
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            color: '#003882',
            padding: '12px 20px',
            borderRadius: '10px',
            marginBottom: '24px',
            fontSize: '0.88rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 4px 12px rgba(0, 56, 130, 0.05)'
          }}>
            <AlertTriangle size={18} color="#003882" />
            {actionMessage}
          </div>
        )}

        {children}

      </main>

      {/* 3. Minimal Clean Footer */}
      <footer style={{
        background: '#ffffff',
        borderTop: '1px solid #e2e8f0',
        padding: '24px 40px',
        marginTop: 'auto'
      }}>
        <div style={{
          maxWidth: '1440px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          fontSize: '0.82rem',
          color: '#64748b'
        }}>
          <div>
            &copy; {new Date().getFullYear()} <strong>PT Tanah Airku Teknologi</strong> &bull; TerraFlow Industrial AWLR System
          </div>
          <div style={{ display: 'flex', gap: '20px', fontWeight: 600 }}>
            <span>Precision in Every Pixel</span>
            <span>Standar Industri Hidrometri</span>
          </div>
        </div>
      </footer>

    </div>
  );
}

// --------------------------------------------------------------------------
// Wrapper for Single Device Detail with stable telemetry & lifecycle
// --------------------------------------------------------------------------
function DeviceDetailRouteWrapper({ 
  devices,
  isConnected,
  actionMessage,
  authToken, 
  currentUser,
  onLogout,
  onGoToLanding,
  onNavigate,
  showActionToast 
}) {
  const { deviceId } = useParams();
  const navigate = useNavigate();
  const [device, setDevice] = useState(null);
  const [latestReading, setLatestReading] = useState(null);
  const [realtimeReadings, setRealtimeReadings] = useState([]);
  const [tidalData, setTidalData] = useState(null);
  const [activeAlertsCount, setActiveAlertsCount] = useState(0);

  const fetchDeviceData = useCallback(async () => {
    if (!deviceId) return;

    try {
      // 1. Fetch device details with auth token for RBAC check
      const devRes = await fetch(`/api/devices/${deviceId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      const devJson = await devRes.json();
      if (devJson.success) {
        setDevice(devJson.data);
        setActiveAlertsCount(Number(devJson.data.active_alerts_count) || 0);
      } else {
        if (devRes.status === 403) {
          if (showActionToast) {
            showActionToast(devJson.error || 'Akses ditolak: Stasiun ini tidak ditugaskan kepada Anda');
          }
          navigate('/dashboard');
          return;
        }
      }

      // 2. Fetch latest reading, past 60 readings, and tidal data in parallel
      const [latestRes, histRes, tidalRes] = await Promise.all([
        fetch(`/api/readings/${deviceId}/latest`),
        fetch(`/api/readings/${deviceId}?limit=60`),
        fetch(`/api/readings/${deviceId}/tidal?hours=24`)
      ]);
      const [latestJson, histJson, tidalJson] = await Promise.all([
        latestRes.json(),
        histRes.json(),
        tidalRes.json()
      ]);

      if (latestJson.success) setLatestReading(latestJson.data);
      if (histJson.success) setRealtimeReadings(histJson.data);
      if (tidalJson.success) setTidalData(tidalJson);
    } catch (err) {
      console.error('[Fetch Device Detail Error]', err.message);
    }
  }, [deviceId, authToken, navigate, showActionToast]);

  // Initial load only when deviceId changes
  useEffect(() => {
    fetchDeviceData();
  }, [fetchDeviceData]);

  // Setup Socket.IO listener for this specific device
  useEffect(() => {
    if (!deviceId) return;

    const socket = io('/', {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
    });

    const handleNewData = (data) => {
      if (data && (data.device_id === deviceId || !data.device_id)) {
        setLatestReading(data);
        setRealtimeReadings((prev) => {
          const updated = [...prev, data];
          return updated.slice(-60);
        });

        // Keep device last_seen updated in real-time so it stays ONLINE while streaming
        const seenIso = data.timestamp 
          ? (typeof data.timestamp === 'number' && data.timestamp < 1e11 ? new Date(data.timestamp * 1000).toISOString() : new Date(data.timestamp).toISOString()) 
          : new Date().toISOString();
        setDevice((prev) => prev ? { ...prev, last_seen: seenIso, is_active: true } : prev);
      }
    };

    socket.on('telemetry', (payload) => {
      if (payload?.device_id === deviceId) {
        handleNewData(payload.data || payload);
      }
    });

    socket.on('sensor:data', (data) => {
      if (data?.device_id === deviceId) {
        handleNewData(data);
      }
    });

    socket.on('device:status', (payload) => {
      if (payload?.device_id === deviceId) {
        const isOnline = payload.status === 'online';
        setDevice((prev) => prev ? {
          ...prev,
          is_active: payload.is_active !== undefined ? payload.is_active : isOnline,
          last_seen: payload.last_seen || (isOnline ? new Date().toISOString() : new Date(Date.now() - 3600000).toISOString())
        } : prev);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [deviceId]);

  // Fallback device from list if detailed device is loading
  const currentDev = device || devices.find(d => d.device_id === deviceId) || { device_id: deviceId, name: deviceId };

  return (
    <LayoutShell 
      currentDevice={currentDev}
      showHero={false}
      devices={devices}
      isConnected={isConnected}
      activeAlertsCount={activeAlertsCount}
      actionMessage={actionMessage}
      currentUser={currentUser}
      onRefresh={fetchDeviceData}
      onLogout={onLogout}
      onGoToLanding={onGoToLanding}
      onNavigate={onNavigate}
    >
      <DeviceDetailView 
        device={currentDev}
        currentUser={currentUser}
        latestReading={latestReading}
        realtimeReadings={realtimeReadings}
        tidalData={tidalData}
        activeAlertsCount={activeAlertsCount}
        onRefresh={fetchDeviceData}
        onBackToOverview={() => navigate('/dashboard')}
        authToken={authToken}
      />
    </LayoutShell>
  );
}
