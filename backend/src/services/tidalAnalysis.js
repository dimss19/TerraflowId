/**
 * Tidal Analysis Engine (Analisis Pasang Surut Air Laut/Muara)
 * PT Tanah Airku Teknologi — TerraFlow
 */

/**
 * Calculate Moving Average on water level time-series
 * @param {Array} data - Array of { timestamp, water_level_cm }
 * @param {number} windowSize - Window size (default 30 points)
 */
function calculateMovingAverage(data, windowSize = 30) {
  if (!data || data.length === 0) return [];
  const result = [];
  const half = Math.floor(windowSize / 2);

  for (let i = 0; i < data.length; i++) {
    let sum = 0;
    let count = 0;
    const start = Math.max(0, i - half);
    const end = Math.min(data.length - 1, i + half);

    for (let j = start; j <= end; j++) {
      if (data[j].water_level_cm != null) {
        sum += Number(data[j].water_level_cm);
        count++;
      }
    }

    const smoothed = count > 0 ? +(sum / count).toFixed(2) : data[i].water_level_cm;
    result.push({
      ...data[i],
      smoothed_level: smoothed,
      raw_level: data[i].water_level_cm,
    });
  }

  return result;
}

/**
 * Detect High Tide (Peaks) and Low Tide (Troughs)
 * @param {Array} smoothedData 
 */
function detectPeaksAndTroughs(smoothedData) {
  const highTides = [];
  const lowTides = [];
  
  if (smoothedData.length < 30) return { highTides, lowTides };

  // Tidal waves have a typical semi-diurnal period of ~12.4h (744 min)
  // We search for local maximum and minimum within a sliding window of 60 points
  const windowHalf = 30;

  for (let i = windowHalf; i < smoothedData.length - windowHalf; i++) {
    const curr = smoothedData[i].smoothed_level;
    if (curr == null) continue;

    let isMax = true;
    let isMin = true;

    for (let j = i - windowHalf; j <= i + windowHalf; j++) {
      if (j === i) continue;
      const other = smoothedData[j].smoothed_level;
      if (other == null) continue;
      if (other > curr) isMax = false;
      if (other < curr) isMin = false;
    }

    if (isMax) {
      const lastPeak = highTides[highTides.length - 1];
      const timeDiffMin = lastPeak 
        ? (new Date(smoothedData[i].timestamp) - new Date(lastPeak.timestamp)) / 60000 
        : 9999;

      if (timeDiffMin > 180) {
        highTides.push({
          timestamp: smoothedData[i].timestamp,
          level: curr,
          type: 'HIGH_TIDE',
          label: 'Puncak Pasang'
        });
      } else if (lastPeak && curr >= lastPeak.level) {
        highTides[highTides.length - 1] = {
          timestamp: smoothedData[i].timestamp,
          level: curr,
          type: 'HIGH_TIDE',
          label: 'Puncak Pasang'
        };
      }
    }

    if (isMin) {
      const lastTrough = lowTides[lowTides.length - 1];
      const timeDiffMin = lastTrough 
        ? (new Date(smoothedData[i].timestamp) - new Date(lastTrough.timestamp)) / 60000 
        : 9999;

      if (timeDiffMin > 180) {
        lowTides.push({
          timestamp: smoothedData[i].timestamp,
          level: curr,
          type: 'LOW_TIDE',
          label: 'Titik Surut'
        });
      } else if (lastTrough && curr <= lastTrough.level) {
        lowTides[lowTides.length - 1] = {
          timestamp: smoothedData[i].timestamp,
          level: curr,
          type: 'LOW_TIDE',
          label: 'Titik Surut'
        };
      }
    }
  }

  return { highTides, lowTides };
}

/**
 * Determine dynamic real-time tidal state (RISING / FALLING / SLACK)
 * @param {Array} smoothedData 
 */
function determineCurrentTidalStatus(smoothedData) {
  if (!smoothedData || smoothedData.length < 6) {
    return { status: 'SLACK', ratePerHour: 0, description: 'Air Tenang (Data terbatas)' };
  }

  const latest = smoothedData[smoothedData.length - 1];
  const comparePoint = smoothedData[Math.max(0, smoothedData.length - 6)]; // 5 min interval
  const deltaMinutes = (new Date(latest.timestamp) - new Date(comparePoint.timestamp)) / 60000 || 5;

  const deltaCm = (latest.smoothed_level != null && comparePoint.smoothed_level != null)
    ? latest.smoothed_level - comparePoint.smoothed_level
    : 0;

  const ratePerHour = +((deltaCm / deltaMinutes) * 60).toFixed(2);

  if (deltaCm > 0.4) {
    return {
      status: 'RISING',
      ratePerHour,
      label: 'Pasang (Air Naik)',
      description: `Ketinggian air naik sebesar +${ratePerHour} cm/jam`
    };
  } else if (deltaCm < -0.4) {
    return {
      status: 'FALLING',
      ratePerHour,
      label: 'Surut (Air Turun)',
      description: `Ketinggian air surut sebesar ${ratePerHour} cm/jam`
    };
  } else {
    return {
      status: 'SLACK',
      ratePerHour,
      label: 'Air Tenang (Slack)',
      description: 'Perubahan permukaan air stabil (<0.4 cm dalam 5 menit)'
    };
  }
}

/**
 * Perform full tidal analysis on a set of readings
 * @param {Array} rawReadings 
 */
function analyzeTidalReadings(rawReadings) {
  if (!rawReadings || rawReadings.length === 0) {
    return {
      series: [],
      highTides: [],
      lowTides: [],
      currentStatus: { status: 'SLACK', label: 'Belum ada data', ratePerHour: 0 },
      stats: { hht: 0, llt: 0, msl: 0, tidalRange: 0, avgPeriodHours: null }
    };
  }

  // 1. Moving average smoothing
  const series = calculateMovingAverage(rawReadings, 30);

  // 2. Extrema detection
  const { highTides, lowTides } = detectPeaksAndTroughs(series);

  // 3. Current dynamic status
  const currentStatus = determineCurrentTidalStatus(series);

  // 4. Calculate key metrics
  const levels = rawReadings.map(r => Number(r.water_level_cm)).filter(v => !isNaN(v) && v != null);
  const hht = levels.length ? Math.max(...levels) : 0;
  const llt = levels.length ? Math.min(...levels) : 0;
  const msl = levels.length ? +(levels.reduce((a, b) => a + b, 0) / levels.length).toFixed(2) : 0;
  const tidalRange = +(hht - llt).toFixed(2);

  // 5. Tidal period calculation
  let avgPeriodHours = null;
  if (highTides.length >= 2) {
    let totalDiff = 0;
    for (let i = 1; i < highTides.length; i++) {
      totalDiff += (new Date(highTides[i].timestamp) - new Date(highTides[i - 1].timestamp)) / (3600 * 1000);
    }
    avgPeriodHours = +(totalDiff / (highTides.length - 1)).toFixed(2);
  }

  return {
    series,
    highTides,
    lowTides,
    currentStatus,
    stats: {
      hht,
      llt,
      msl,
      tidalRange,
      avgPeriodHours,
      totalPoints: rawReadings.length
    }
  };
}

module.exports = {
  calculateMovingAverage,
  detectPeaksAndTroughs,
  determineCurrentTidalStatus,
  analyzeTidalReadings,
};
