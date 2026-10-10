#!/usr/bin/env python3
"""Fetch the French Consumer Price Index (CPI) time series from the INSEE BDM API
and publish it as JSON to a GitHub Gist.

The JSON is printed to stdout. When the GIST_TOKEN environment variable is set
(a PAT with the "gist" scope), the Gist is updated only if its content changed."""

import json
import os
import sys
import urllib.request
import xml.etree.ElementTree as ET

INSEE_URL = "https://api.insee.fr/series/BDM/V1/data/SERIES_BDM/011814056"
GIST_API_URL = "https://api.github.com/gists/5646b5558f759655717914400cc50a03"
GIST_FILENAME = "insee-011814056.json"
# This is an XML namespace URI, i.e. a literal identifier that must match the
# document exactly - not a fetched resource. The "use HTTPS" SONAR warning is a false positive.
COMMON_NS = "http://www.sdmx.org/resources/sdmxml/schemas/v2_1/common"


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def fetch_cpi_json() -> str:
    request = urllib.request.Request(INSEE_URL, headers={"Accept": "application/xml"})
    with urllib.request.urlopen(request, timeout=30) as response:
        root = ET.fromstring(response.read())

    sender_name = root.findtext(f".//{{{COMMON_NS}}}Name")

    series = next((el for el in root.iter() if local_name(el.tag) == "Series"), None)
    if series is None:
        raise RuntimeError("No Series element found in the INSEE response.")

    index = {}
    for obs in series:
        if local_name(obs.tag) != "Obs":
            continue
        period = obs.get("TIME_PERIOD")
        value = obs.get("OBS_VALUE")
        if period and value:
            index[period] = value
    if not index:
        raise RuntimeError("No observations found in the INSEE response.")

    data = {
        "source": {
            "origin": sender_name
            or "Institut national de la statistique et des études économiques",
            "url": INSEE_URL,
            "id": series.get("IDBANK"),
            "title": series.get("TITLE_FR"),
            "lastUpdate": series.get("LAST_UPDATE"),
        },
        "index": index,
    }
    return json.dumps(data, ensure_ascii=False, indent=2) + "\n"


def gist_request(token: str, payload: dict = None) -> dict:
    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    data = None
    if payload is not None:
        data = json.dumps(payload).encode()
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(
        GIST_API_URL, data=data, headers=headers, method="PATCH" if payload else "GET"
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read())


def update_gist(content: str, token: str) -> str:
    gist = gist_request(token)
    files = gist.get("files", {})
    if GIST_FILENAME in files:
        target = GIST_FILENAME
    elif len(files) == 1:
        target = next(iter(files))  # single file with another name: rename it
    else:
        target = GIST_FILENAME  # empty or multi-file gist: create the file
    if files.get(target, {}).get("content") == content:
        return "unchanged"
    gist_request(
        token, {"files": {target: {"filename": GIST_FILENAME, "content": content}}}
    )
    return "updated"


def main() -> int:
    try:
        content = fetch_cpi_json()
    except Exception as exc:
        print(f"Failed to fetch INSEE data: {exc}", file=sys.stderr)
        return 1

    print(content)

    token = os.environ.get("GIST_TOKEN")
    if not token:
        if os.environ.get("CI"):
            print("GIST_TOKEN environment variable is not set.", file=sys.stderr)
            return 1
        print("GIST_TOKEN not set: skipping Gist update.", file=sys.stderr)
        return 0

    try:
        result = update_gist(content, token)
    except Exception as exc:
        print(f"Failed to update Gist: {exc}", file=sys.stderr)
        return 1

    print(f"Gist {result}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
