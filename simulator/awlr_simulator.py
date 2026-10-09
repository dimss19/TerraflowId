#!/usr/bin/env python3
"""
TerraFlow AWLR Python Simulator
PT Tanah Airku Teknologi

Simulates an Automatic Water Level Recorder (AWLR) transmitting real-time telemetry,
heartbeat diagnostics, and receiving calibration commands via MQTT.
"""

import sys
import time
import math
import random
import json
import signal
import argparse

try:
    import paho.mqtt.client as mqtt
except ImportError:
    print("[Error] paho-mqtt tidak terinstal. Jalankan: pip install -r requirements.txt")
    sys.exit(1)


class AWLRSimulator:
    def __init__(self, broker="127.0.0.1", port=1883, device_id="AWLR-001", interval=10):
        self.broker = broker
        self.port = port
        self.device_id = device_id
        self.interval = interval
        self.running = True

        # Sensor & Calibration State
        self.sensor_height_cm = 600.0
        self.offset_cm = 0.0
        self.slope = 1.000000

        # Telemetry & Diagnostics Counters
        self.reading_counter = 100
        self.boot_count = 1
        self.watchdog_count = 0
        self.battery_voltage = 12.55
        self.last_diag_time = 0
        self.diag_interval = 300  # Heartbeat diagnostics every 5 minutes

        # Initialize MQTT client (compatible with paho-mqtt 1.x and 2.x)
        client_id = f"terraflow_sim_{self.device_id}_{int(time.time())}"
        if hasattr(mqtt, "CallbackAPIVersion"):
            self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=client_id)
        else:
            self.client = mqtt.Client(client_id=client_id)

        # Configure Last Will and Testament (LWT)
        lwt_payload = json.dumps({
            "device_id": self.device_id,
            "status": "offline",
            "reason": "connection_lost"
        })
        self.client.will_set(f"terraflow/{self.device_id}/status", lwt_payload, qos=1, retain=False)

        # Setup callbacks
        self.client.on_connect = self.on_connect
        self.client.on_disconnect = self.on_disconnect
        self.client.on_message = self.on_message

    def on_connect(self, client, userdata, flags, rc, *extra_args):
        # Handle paho-mqtt v2 where rc is a ReasonCode object
        code = rc.value if hasattr(rc, "value") else rc
        if code == 0:
            print(f"[Simulator] Terhubung ke broker MQTT di {self.broker}:{self.port}")
            print(f"[Simulator] ID Perangkat Aktif: {self.device_id} | Interval: {self.interval} detik")

            # 1. Send status online
            online_payload = json.dumps({
                "device_id": self.device_id,
                "status": "online",
                "timestamp": int(time.time())
            })
            client.publish(f"terraflow/{self.device_id}/status", online_payload)

            # 2. Subscribe to control topics
            topics = [
                (f"terraflow/{self.device_id}/calibration/set", 1),
                (f"terraflow/{self.device_id}/command/#", 1)
            ]
            client.subscribe(topics)
            print(f"[Simulator] Mendengarkan topik perintah & kalibrasi untuk {self.device_id}")

            # 3. Send initial boot diagnostics
            self.send_diagnostics("POWERON_RESET")
        else:
            print(f"[Simulator] Gagal terhubung ke broker MQTT (Kode: {code})")

    def on_disconnect(self, client, userdata, rc, *extra_args):
        print("[Simulator] Terputus dari broker MQTT.")

    def on_message(self, client, userdata, msg):
        try:
            payload_str = msg.payload.decode("utf-8")
            topic = msg.topic
            data = json.loads(payload_str)
            print(f"[Simulator Perintah Diterima] Topik: {topic}")

            # Handle Calibration Set
            if topic == f"terraflow/{self.device_id}/calibration/set":
                self.handle_calibration(data)

            # Handle Remote Commands
            elif topic == f"terraflow/{self.device_id}/command/restart":
                print("[Simulator] Memproses perintah restart jarak jauh...")
                self.boot_count += 1
                self.send_diagnostics("SW_REMOTE_RESET")

            elif topic == f"terraflow/{self.device_id}/command/sync_request":
                print("[Simulator] Memproses sinkronisasi manual telemetri...")

        except Exception as e:
            print(f"[Simulator Error Parsing Pesan] {e}")

    def handle_calibration(self, data):
        new_height = float(data.get("sensor_height_cm", self.sensor_height_cm))
        new_offset = float(data.get("offset_cm", self.offset_cm))
        new_slope = float(data.get("slope", self.slope))

        self.sensor_height_cm = new_height
        self.offset_cm = new_offset
        self.slope = new_slope
        print(f"[Simulator] Kalibrasi diperbarui: Tinggi={self.sensor_height_cm}cm, Offset={self.offset_cm}cm, Slope={self.slope}")

        # Send response confirmation
        resp = {
            "device_id": self.device_id,
            "status": "applied",
            "active_calibration": {
                "sensor_height_cm": self.sensor_height_cm,
                "offset_cm": self.offset_cm,
                "slope": self.slope
            },
            "timestamp": int(time.time())
        }
        self.client.publish(f"terraflow/{self.device_id}/calibration/response", json.dumps(resp))

    def generate_reading(self):
        """Simulate realistic semi-diurnal tidal curve with lunar M2 & solar S2 components"""
        self.reading_counter += 1
        now_sec = time.time()

        # Semi-diurnal tidal periods in seconds
        m2_period = 12.42 * 3600
        s2_period = 12.0 * 3600

        phase_m2 = (2 * math.pi * now_sec) / m2_period
        phase_s2 = (2 * math.pi * now_sec) / s2_period
        micro_ripple = math.sin(self.reading_counter * 0.25) * 0.6 + (random.uniform(-0.3, 0.3))

        # Base water level calculation
        base_msl = 220.0       # Mean sea level in cm
        m2_amplitude = 110.0   # Main tidal amplitude
        s2_amplitude = 22.0    # Secondary solar tidal amplitude

        raw_water_level = base_msl + (m2_amplitude * math.sin(phase_m2)) + (s2_amplitude * math.sin(phase_s2)) + micro_ripple
        water_level = round(raw_water_level, 2)

        # Raw distance from sensor head to water surface
        calibrated_level = (water_level * self.slope) + self.offset_cm
        raw_distance = round(self.sensor_height_cm - calibrated_level, 2)

        # Diurnal temperature curve (peaking mid-day)
        hour_of_day = (now_sec / 3600.0 + 7) % 24  # UTC+7
        temp_c = round(27.0 + 4.0 * math.sin((hour_of_day - 8) * math.pi / 12) + random.uniform(-0.2, 0.2), 2)

        # Battery voltage: slight discharge with solar charging simulation
        if 9 <= hour_of_day <= 16:
            self.battery_voltage = min(12.75, self.battery_voltage + 0.002)
        else:
            self.battery_voltage = max(11.80, self.battery_voltage - 0.001)
        batt_v = round(self.battery_voltage, 2)
        batt_pct = min(100, max(0, int(((batt_v - 11.5) / 1.25) * 100)))

        rssi = -65 + int(random.uniform(-5, 5))

        return {
            "device_id": self.device_id,
            "timestamp": int(now_sec),
            "raw_distance_cm": raw_distance,
            "water_level_cm": water_level,
            "temperature_c": temp_c,
            "battery_voltage": batt_v,
            "battery_percent": batt_pct,
            "signal_quality": rssi,
            "sd_status": "ok",
            "reading_count": self.reading_counter,
            "source": "live"
        }

    def send_diagnostics(self, boot_reason="NORMAL"):
        now_sec = int(time.time())
        diag = {
            "device_id": self.device_id,
            "timestamp": now_sec,
            "boot_reason": boot_reason,
            "uptime_sec": self.reading_counter * self.interval,
            "boot_count": self.boot_count,
            "watchdog_count": self.watchdog_count,
            "brownout_count": 0,
            "panic_count": 0,
            "free_heap_bytes": 164000 + random.randint(-2000, 2000),
            "wifi_rssi": -65 + random.randint(-4, 4),
            "sd_card_ok": True,
            "sensor_ok": True,
            "battery_voltage": round(self.battery_voltage, 2),
            "esp_temp_c": round(38.0 + random.uniform(-1.0, 1.0), 1),
            "pending_unsent": 0,
            "firmware_version": "v1.2.0"
        }
        self.client.publish(f"terraflow/{self.device_id}/diagnostics", json.dumps(diag))
        self.last_diag_time = now_sec
        print(f"[Simulator Diagnostik] Uptime: {diag['uptime_sec']}s | Boot Reason: {boot_reason} | RSSI: {diag['wifi_rssi']}dBm")

    def run(self):
        print(f"Menghubungkan ke broker MQTT: {self.broker}:{self.port}...")
        try:
            self.client.connect(self.broker, self.port, keepalive=60)
            self.client.loop_start()
        except Exception as e:
            print(f"[Error Koneksi MQTT] Tidak dapat terhubung ke {self.broker}:{self.port}: {e}")
            return

        print("[Simulator Berjalan] Tekan Ctrl+C untuk menghentikan simulasi.")

        try:
            while self.running:
                reading = self.generate_reading()
                topic = f"terraflow/{self.device_id}/data"
                self.client.publish(topic, json.dumps(reading))

                print(f"[Data Terkirim] Level: {reading['water_level_cm']:>6.2f} cm | "
                      f"Jarak: {reading['raw_distance_cm']:>6.2f} cm | "
                      f"Aki: {reading['battery_voltage']:.2f}V ({reading['battery_percent']}%) | "
                      f"Suhu: {reading['temperature_c']}°C")

                # Send diagnostics periodically
                if time.time() - self.last_diag_time > self.diag_interval:
                    self.send_diagnostics("NORMAL")

                time.sleep(self.interval)

        except KeyboardInterrupt:
            print("\n[Simulator] Menghentikan simulasi...")
        finally:
            self.stop()

    def stop(self):
        self.running = False
        try:
            offline_payload = json.dumps({
                "device_id": self.device_id,
                "status": "offline",
                "timestamp": int(time.time())
            })
            self.client.publish(f"terraflow/{self.device_id}/status", offline_payload)
            self.client.loop_stop()
            self.client.disconnect()
            print("[Simulator] Perangkat dimatikan dengan aman.")
        except Exception:
            pass


def main():
    parser = argparse.ArgumentParser(description="TerraFlow AWLR Device Simulator (Python)")
    parser.add_argument("--broker", default="127.0.0.1", help="Alamat broker MQTT (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=1883, help="Port broker MQTT (default: 1883)")
    parser.add_argument("--device-id", default="AWLR-001", help="ID Perangkat AWLR (default: AWLR-001)")
    parser.add_argument("--interval", type=int, default=10, help="Interval pengiriman data dalam detik (default: 10)")

    args = parser.parse_args()

    simulator = AWLRSimulator(
        broker=args.broker,
        port=args.port,
        device_id=args.device_id,
        interval=args.interval
    )

    def sig_handler(sig, frame):
        simulator.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, sig_handler)
    signal.signal(signal.SIGTERM, sig_handler)

    simulator.run()


if __name__ == "__main__":
    main()
