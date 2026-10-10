import React from 'react';
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
      
      {/* Top Telemetry Grid: Water Level Gauge & Real-time Chart */}
      <div className="dashboard-telemetry-grid">
        <WaterLevelGauge 
          reading={latestReading} 
          sensorHeight={device?.sensor_height_cm}
          tidalStatus={tidalData?.currentStatus}
          lastSeen={device?.last_seen}
        />
        <RealtimeChart 
          readings={realtimeReadings} 
        />
      </div>

    </div>
  );
}
