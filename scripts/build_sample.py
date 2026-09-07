#!/usr/bin/env python3
"""Build a local visualizer JSON file from an AnyTone CPS table export."""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = PROJECT_ROOT / "local-data" / "codeplug.json"
ENRICHMENT_FIELDS = ("callsign", "city", "state", "notes", "network", "status", "kind")


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def split_members(value: str) -> list[str]:
    return [item for item in value.split("|") if item]


def as_number(value: str, fallback: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


def existing_enrichment(output: Path) -> dict[str, dict[str, str]]:
    if not output.exists():
        return {}
    try:
        current = json.loads(output.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return {
        channel["name"]: {
            field: str(channel.get(field, ""))
            for field in ENRICHMENT_FIELDS
        }
        for channel in current.get("channels", [])
        if channel.get("name")
    }


def build_data(bundle: Path, output: Path, args: argparse.Namespace) -> dict[str, Any]:
    required = ("Channel.CSV", "Zone.CSV", "ScanList.CSV", "TalkGroups.CSV")
    missing = [name for name in required if not (bundle / name).is_file()]
    if missing:
        raise SystemExit(f"Missing required CPS files: {', '.join(missing)}")

    channel_rows = read_csv(bundle / "Channel.CSV")
    zone_rows = read_csv(bundle / "Zone.CSV")
    scan_rows = read_csv(bundle / "ScanList.CSV")
    talkgroup_rows = read_csv(bundle / "TalkGroups.CSV")
    radio_id_rows = (
        read_csv(bundle / "RadioIDList.CSV")
        if (bundle / "RadioIDList.CSV").is_file()
        else []
    )

    zones = [
        {
            "number": as_number(row["No."], index),
            "name": row["Zone Name"],
            "members": split_members(row["Zone Channel Member"]),
            "aChannel": row["A Channel"],
            "bChannel": row["B Channel"],
        }
        for index, row in enumerate(zone_rows, 1)
    ]

    memberships: dict[str, list[str]] = {}
    for zone in zones:
        for member in zone["members"]:
            memberships.setdefault(member, []).append(zone["name"])

    enrichment = existing_enrichment(output)
    channels: list[dict[str, Any]] = []
    seen_names: set[str] = set()
    for index, row in enumerate(channel_rows, 1):
        name = row["Channel Name"]
        if name in seen_names:
            raise SystemExit(f"Duplicate channel name: {name}")
        seen_names.add(name)
        meta = enrichment.get(name, {})
        channels.append(
            {
                "number": as_number(row["No."], index),
                "name": name,
                "mode": "DMR" if "Digital" in row["Channel Type"] else "Analog",
                "rx": row["Receive Frequency"],
                "tx": row["Transmit Frequency"],
                "power": row["Transmit Power"],
                "bandwidth": row["Band Width"],
                "decode": row["CTCSS/DCS Decode"],
                "encode": row["CTCSS/DCS Encode"],
                "squelch": row["Squelch Mode"],
                "contact": row["Contact"],
                "callType": row["Contact Call Type"],
                "tg": row["Contact TG/DMR ID"],
                "colorCode": row["RX Color Code"],
                "slot": row["Slot"],
                "scan": "" if row["Scan List"] == "None" else row["Scan List"],
                "rxGroup": ""
                if row["Receive Group List"] == "None"
                else row["Receive Group List"],
                "txProhibit": row["PTT Prohibit"] == "On",
                "autoScan": row["Auto Scan"] == "On",
                "zones": memberships.get(name, []),
                **{field: meta.get(field, "") for field in ENRICHMENT_FIELDS},
            }
        )

    known_channels = {channel["name"] for channel in channels}
    for zone in zones:
        missing_members = sorted(set(zone["members"]) - known_channels)
        if missing_members:
            raise SystemExit(
                f"Zone {zone['name']} references missing channels: {', '.join(missing_members)}"
            )

    scans = []
    for index, row in enumerate(scan_rows, 1):
        members = split_members(row["Scan Channel Member"])
        missing_members = sorted(set(members) - known_channels)
        if missing_members:
            raise SystemExit(
                f"Scan list {row['Scan List Name']} references missing channels: "
                f"{', '.join(missing_members)}"
            )
        scans.append(
            {
                "number": as_number(row["No."], index),
                "name": row["Scan List Name"],
                "members": members,
                "revert": row["Revert Channel"],
                "lookbackA": row["Look Back Time A[s]"],
                "lookbackB": row["Look Back Time B[s]"],
                "dropout": row["Dropout Delay Time[s]"],
                "dwell": row["Dwell Time[s]"],
            }
        )

    talkgroups = [
        {
            "number": as_number(row["No."], index),
            "name": row["Name"],
            "id": row["Radio ID"],
            "callType": row["Call Type"],
        }
        for index, row in enumerate(talkgroup_rows, 1)
    ]

    identity = radio_id_rows[0] if radio_id_rows else {}
    callsign = args.callsign or identity.get("Name") or "Sample codeplug"
    dmr_id = args.dmr_id or identity.get("Radio ID") or "—"
    analog = sum(channel["mode"] == "Analog" for channel in channels)

    return {
        "identity": {"callsign": callsign, "dmrId": dmr_id},
        "radio": args.radio,
        "cps": args.cps,
        "controls": {"pf1Short": args.pf1_short, "pf1Long": args.pf1_long},
        "counts": {
            "channels": len(channels),
            "analog": analog,
            "dmr": len(channels) - analog,
            "zones": len(zones),
            "scans": len(scans),
            "talkgroups": len(talkgroups),
        },
        "channels": channels,
        "zones": zones,
        "scans": scans,
        "talkgroups": talkgroups,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, required=True, help="Directory containing CPS CSV files")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--callsign")
    parser.add_argument("--dmr-id")
    parser.add_argument("--radio", default="AnyTone AT-D878UVII Plus")
    parser.add_argument("--cps", default="v4.00")
    parser.add_argument("--pf1-short", default="Scan")
    parser.add_argument("--pf1-long", default="Battery voltage")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    bundle = args.bundle.expanduser().resolve()
    output = args.output.expanduser().resolve()
    data = build_data(bundle, output, args)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(
        f"Wrote {output}: {data['counts']['channels']} channels, "
        f"{data['counts']['zones']} zones, {data['counts']['scans']} scan lists"
    )


if __name__ == "__main__":
    main()
