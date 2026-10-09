import React from 'react';
import { 
  Radio, 
  Thermometer, 
  Battery, 
  HardDrive 
} from 'lucide-react';

import WaterLevelGauge from './WaterLevelGauge';
import RealtimeChart from './RealtimeChart';

export default function MonitoringTab({ 
  device, 
  latestReading, 
  realtimeReadings = [], 
  tidalData 
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      
      {/* 1. Top Telemetry Grid: Water Level Gauge & Real-time Chart */}
      <div className="dashboard-telemetry-grid">
        <WaterLevelGauge 
          reading={latestReading} 
          sensorHeight={device?.sensor_height_cm}
          tidalStatus={tidalData?.currentStatus}
        />
        <RealtimeChart 
          readings={realtimeReadings} 
        />
      </div>

      {/* 2. Quick System Telemetry Metric Cards */}
      <div className="metrics-summary-grid">
        
        {/* Metric 1: Jarak Sensor (Raw) */}
        <div className="corporate-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: '#edf2fc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#003882'
            }}>
              <Radio size={16} />
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
              JARAK SENSOR (RAW)
            </span>
          </div>
          <div className="mono-text" style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', marginTop: '10px' }}>
            {latestReading?.raw_distance_cm != null ? (
              <>
                {(Number(latestReading.raw_distance_cm) / 100).toFixed(2)}{' '}
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#003882' }}>m</span>
                <span style={{ fontSize: '0.76rem', color: '#94a3b8', fontWeight: 500, marginLeft: '6px' }}>
                  ({Number(latestReading.raw_distance_cm).toFixed(1)} cm)
                </span>
              </>
            ) : (
              <span style={{ color: '#94a3b8', fontSize: '1rem' }}>Menunggu data...</span>
            )}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600, marginTop: '2px' }}>
            Sensor Elevasi Permukaan Presisi
          </div>
        </div>

        {/* Metric 2: Temperatur Udara */}
        <div className="corporate-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: '#edf2fc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#003882'
            }}>
              <Thermometer size={16} />
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
              TEMPERATUR AMBIEN
            </span>
          </div>
          <div className="mono-text" style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', marginTop: '10px' }}>
            {latestReading?.temperature_c != null ? (
              <>
                {Number(latestReading.temperature_c).toFixed(1)}{' '}
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>&deg;C</span>
              </>
            ) : (
              <span style={{ color: '#94a3b8', fontSize: '1rem' }}>Menunggu data...</span>
            )}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#003882', fontWeight: 600, marginTop: '2px' }}>
            Kompensasi Kecepatan Suara Aktif
          </div>
        </div>

        {/* Metric 3: Tegangan Aki */}
        <div className="corporate-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: '#edf2fc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#003882'
            }}>
              <Battery size={16} />
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
              TEGANGAN AKI
            </span>
          </div>
          <div className="mono-text" style={{ fontSize: '1.3rem', fontWeight: 800, color: '#059669', marginTop: '10px' }}>
            {latestReading?.battery_voltage != null ? (
              <>
                {Number(latestReading.battery_voltage).toFixed(2)}{' '}
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>V</span>
                {latestReading?.battery_percent != null && (
                  <span style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 500, marginLeft: '6px' }}>
                    ({latestReading.battery_percent}%)
                  </span>
                )}
              </>
            ) : (
              <span style={{ color: '#94a3b8', fontSize: '1rem' }}>Menunggu data...</span>
            )}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600, marginTop: '2px' }}>
            Daya Mandiri Solar Panel Normal
          </div>
        </div>

        {/* Metric 4: Status Penyimpanan Lokal */}
        <div className="corporate-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: '#edf2fc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#003882'
            }}>
              <HardDrive size={16} />
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
              STATUS PENYIMPANAN LOKAL
            </span>
          </div>
          <div className="mono-text" style={{ fontSize: '1.3rem', fontWeight: 800, color: '#003882', marginTop: '10px' }}>
            {latestReading?.sd_status ? latestReading.sd_status.toUpperCase() : 'READY'}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>
            Pencatatan Mandiri Offline Aktif
          </div>
        </div>

      </div>

    </div>
  );
}
