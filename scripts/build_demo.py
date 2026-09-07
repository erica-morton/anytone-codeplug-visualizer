#!/usr/bin/env python3
"""Regenerate the repository's small, synthetic visualizer fixture."""

from __future__ import annotations

import json
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
OUTPUT = PROJECT_ROOT / "data" / "sample-codeplug.json"
NOTICE = "Synthetic fixture — do not program into a radio."


def channel(
    number: int,
    name: str,
    mode: str,
    rx: str,
    tx: str,
    zones: list[str],
    *,
    scan: str = "",
    contact: str = "",
    call_type: str = "Group Call",
    tg: str = "",
    color_code: str = "1",
    slot: str = "1",
) -> dict[str, object]:
    return {
        "number": number,
        "name": name,
        "mode": mode,
        "rx": rx,
        "tx": tx,
        "power": "Low",
        "bandwidth": "12.5K" if mode == "DMR" else "25K",
        "decode": "Off",
        "encode": "Off",
        "squelch": "Carrier",
        "contact": contact,
        "callType": call_type,
        "tg": tg,
        "colorCode": color_code,
        "slot": slot,
        "scan": scan,
        "rxGroup": "",
        "txProhibit": True,
        "autoScan": False,
        "zones": zones,
        "callsign": "DEMO",
        "city": "Example City",
        "state": "XX",
        "notes": NOTICE,
        "network": "Synthetic",
        "status": "demo",
        "kind": "synthetic",
    }


channels = [
    channel(1, "DEMO-VHF", "Analog", "146.94000", "146.34000", ["00 DEMO", "01 LOCAL"], scan="Local Scan"),
    channel(2, "DEMO-UHF", "Analog", "444.50000", "449.50000", ["00 DEMO", "01 LOCAL"], scan="Local Scan"),
    channel(3, "2M-CALL", "Analog", "146.52000", "146.52000", ["00 DEMO", "02 SIMPLEX"], scan="Simplex Scan"),
    channel(4, "70-CALL", "Analog", "446.00000", "446.00000", ["02 SIMPLEX"], scan="Simplex Scan"),
    channel(5, "WX-DEMO", "Analog", "162.55000", "162.55000", ["03 RECEIVE"], scan="Weather Scan"),
    channel(6, "DMR LOCAL", "DMR", "442.00000", "447.00000", ["00 DEMO", "10 DMR DEMO"], contact="Local Demo", tg="9", slot="2"),
    channel(7, "DMR STATE", "DMR", "442.00000", "447.00000", ["10 DMR DEMO"], contact="State Demo", tg="999", slot="1"),
    channel(8, "DMR PARROT", "DMR", "442.00000", "447.00000", ["10 DMR DEMO"], contact="Parrot Demo", call_type="Private Call", tg="9990", slot="2"),
]

zones = [
    {"number": 1, "name": "00 DEMO", "members": ["DEMO-VHF", "DEMO-UHF", "2M-CALL", "DMR LOCAL"], "aChannel": "DEMO-VHF", "bChannel": "DEMO-UHF"},
    {"number": 2, "name": "01 LOCAL", "members": ["DEMO-VHF", "DEMO-UHF"], "aChannel": "DEMO-VHF", "bChannel": "DEMO-UHF"},
    {"number": 3, "name": "02 SIMPLEX", "members": ["2M-CALL", "70-CALL"], "aChannel": "2M-CALL", "bChannel": "70-CALL"},
    {"number": 4, "name": "03 RECEIVE", "members": ["WX-DEMO"], "aChannel": "WX-DEMO", "bChannel": "WX-DEMO"},
    {"number": 5, "name": "10 DMR DEMO", "members": ["DMR LOCAL", "DMR STATE", "DMR PARROT"], "aChannel": "DMR LOCAL", "bChannel": "DMR STATE"},
]

scans = [
    {"number": 1, "name": "Local Scan", "members": ["DEMO-VHF", "DEMO-UHF"], "revert": "Selected", "lookbackA": "2.0", "lookbackB": "3.0", "dropout": "3.1", "dwell": "3.1"},
    {"number": 2, "name": "Simplex Scan", "members": ["2M-CALL", "70-CALL"], "revert": "Selected", "lookbackA": "2.0", "lookbackB": "3.0", "dropout": "3.1", "dwell": "3.1"},
    {"number": 3, "name": "Weather Scan", "members": ["WX-DEMO"], "revert": "Selected", "lookbackA": "2.0", "lookbackB": "3.0", "dropout": "3.1", "dwell": "3.1"},
]

talkgroups = [
    {"number": 1, "name": "Local Demo", "id": "9", "callType": "Group Call"},
    {"number": 2, "name": "State Demo", "id": "999", "callType": "Group Call"},
    {"number": 3, "name": "Parrot Demo", "id": "9990", "callType": "Private Call"},
]

data = {
    "identity": {"callsign": "DEMO", "dmrId": "0000000"},
    "radio": "AnyTone synthetic fixture",
    "cps": "v4.00 demo",
    "controls": {"pf1Short": "Scan", "pf1Long": "Battery voltage"},
    "counts": {
        "channels": len(channels),
        "analog": sum(item["mode"] == "Analog" for item in channels),
        "dmr": sum(item["mode"] == "DMR" for item in channels),
        "zones": len(zones),
        "scans": len(scans),
        "talkgroups": len(talkgroups),
        "gpsRoaming": 1,
    },
    "channels": channels,
    "zones": zones,
    "scans": scans,
    "talkgroups": talkgroups,
    "gpsRoaming": [
        {
            "number": 1,
            "zoneIndex": 1,
            "zoneNumber": 2,
            "zoneName": "01 LOCAL",
            "latitude": 35.0,
            "longitude": -98.0,
            "radiusMeters": 25000,
        }
    ],
}

OUTPUT.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
print(f"Wrote synthetic demo to {OUTPUT}")
