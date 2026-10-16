#!/usr/bin/env python3
"""Fetch French Consumer Price Index (CPI) time series from the INSEE BDM API
and publish them as JSON files to a GitHub Gist (one file per series, named
insee-<idbank>.json).

When the GIST_TOKEN environment variable is set (a PAT with the "gist" scope),
only the files whose content changed are updated."""

import json
import os
import sys
import urllib.request
import xml.etree.ElementTree as ET

IDBANKS = ["011814056", "011814630", "011814080"]
INSEE_URL_TEMPLATE = "https://api.insee.fr/series/BDM/V1/data/SERIES_BDM/{}"
GIST_API_URL = "https://api.github.com/gists/5646b5558f759655717914400cc50a03"
GIST_FILE_PREFIX = "insee-"
GIST_DESCRIPTION = (
    "Indices mensuels des prix à la consommation (INSEE, base 2025)"
)
# This is an XML namespace URI, i.e. a literal identifier that must match the
# document exactly - not a fetched resource. The "use HTTPS" SONAR warning is a false positive.
COMMON_NS = "http://www.sdmx.org/resources/sdmxml/schemas/v2_1/common"


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def fetch_series(idbank: str) -> dict:
    url = INSEE_URL_TEMPLATE.format(idbank)
    request = urllib.request.Request(url, headers={"Accept": "application/xml"})
    with urllib.request.urlopen(request, timeout=30) as response:
        root = ET.fromstring(response.read())

    sender_name = root.findtext(f".//{{{COMMON_NS}}}Name")

    series = next((el for el in root.iter() if local_name(el.tag) == "Series"), None)
    if series is None:
        raise RuntimeError(f"No Series element found in the INSEE response for {idbank}.")

    index = {}
    for obs in series:
        if local_name(obs.tag) != "Obs":
            continue
        period = obs.get("TIME_PERIOD")
        value = obs.get("OBS_VALUE")
        if period and value:
            index[period] = value
    if not index:
        raise RuntimeError(f"No observations found in the INSEE response for {idbank}.")

    return {
        "source": {
            "origin": sender_name
            or "Institut national de la statistique et des études économiques",
            "url": url,
            "id": series.get("IDBANK"),
            "title": series.get("TITLE_FR"),
            "lastUpdate": series.get("LAST_UPDATE"),
        },
        "index": index,
    }


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


def update_gist(contents: dict, token: str) -> dict:
    gist = gist_request(token)
    files = gist.get("files", {})
    # One-off migration: a lone file not matching our naming scheme
    # (e.g. the initial "gistfile1.txt") is renamed to the first target file.
    legacy = (
        next(iter(files))
        if len(files) == 1 and not next(iter(files)).startswith(GIST_FILE_PREFIX)
        else None
    )

    patch, results = {}, {}
    first = next(iter(contents))
    for name, content in contents.items():
        if files.get(name, {}).get("content") == content:
            results[name] = "unchanged"
        elif name == first and legacy:
            patch[legacy] = {"filename": name, "content": content}
            results[name] = "updated"
        else:
            patch[name] = {"content": content}
            results[name] = "updated" if name in files else "created"

    payload = {"files": patch} if patch else {}
    if gist.get("description") != GIST_DESCRIPTION:
        payload["description"] = GIST_DESCRIPTION
        results["(description)"] = "updated"
    if payload:
        gist_request(token, payload)
    return results


def main() -> int:
    try:
        contents = {}
        for idbank in IDBANKS:
            data = fetch_series(idbank)
            contents[f"{GIST_FILE_PREFIX}{idbank}.json"] = (
                json.dumps(data, ensure_ascii=False, indent=2) + "\n"
            )
            print(
                f"{idbank}: {len(data['index'])} observations"
                f" (last update {data['source']['lastUpdate']})"
            )
    except Exception as exc:
        print(f"Failed to fetch INSEE data: {exc}", file=sys.stderr)
        return 1

    token = os.environ.get("GIST_TOKEN")
    if not token:
        if os.environ.get("CI"):
            print("GIST_TOKEN environment variable is not set.", file=sys.stderr)
            return 1
        print("GIST_TOKEN not set: skipping Gist update.", file=sys.stderr)
        for name, content in contents.items():
            print(f"--- {name} ---")
            print(content)
        return 0

    try:
        results = update_gist(contents, token)
    except Exception as exc:
        print(f"Failed to update Gist: {exc}", file=sys.stderr)
        return 1

    for name, result in results.items():
        print(f"{name}: {result}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
