"""Массовая проверка запуском: для каждой сборки из tools/out/packs/*.json запускает сервер Fabric,
находит упавшие моды, убирает их и повторяет, пока сервер не стартует. Итог: tools/out/mass_result.json.

Запуск: py tools/mass_check.py РАБОЧАЯ_ПАПКА
EULA не принимается: сервер гасится, как только дошёл до неё (моды к этому моменту уже запущены).
"""
import hashlib
import json
import re
import subprocess
import sys
import urllib.request
import zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent
UA = {"User-Agent": "modsmith-mass-check"}
PLATFORM = {"minecraft", "java", "fabricloader", "fabric_loader", "mixinextras", "fabric", "fabric_api"}
IGNORE_PKG = {"net", "com", "org", "io", "dev", "me", "java", "knot", "minecraft", "fabricmc", "impl", "api", "common",
              "client", "server", "mixin", "core", "util", "github", "spongepowered", "loader", "main", "mod"}


def norm(s: str) -> str:
    return s.lower().replace("-", "_")


def fetch(url: str) -> bytes:
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180) as r:
        return r.read()


def jar_info(path: Path) -> dict:
    try:
        with zipfile.ZipFile(path) as z:
            j = json.loads(z.read("fabric.mod.json").decode("utf-8", "replace"))
        ids = [norm(j["id"])] + [norm(p) for p in j.get("provides", [])]
        return {"ids": ids, "depends": [norm(d) for d in j.get("depends", {})], "name": j.get("name", j["id"])}
    except Exception:  # noqa: BLE001 — не fabric-мод или битый jar
        return {"ids": [norm(path.stem)], "depends": [], "name": path.stem}


# Сервер дошёл до чтения своих настроек: код запуска всех модов к этому моменту уже выполнен.
# Дальше без принятой EULA некоторые моды (owo-lib) падают — это не ошибка сборки.
SUCCESS = ("You need to agree to the EULA", "Done (", "Failed to load properties from file: server.properties")


def started(log: str) -> bool:
    return any(s in log for s in SUCCESS)


def run_server(work: Path, server_jar: Path) -> str:
    # headless: окна-«сторожа» модов (owo-sentinel и т.п.) не откроются и не повесят проверку
    proc = subprocess.Popen(["java", "-Djava.awt.headless=true", "-Xmx6G", "-jar", str(server_jar), "nogui"], cwd=work,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8",
                            errors="replace")
    lines = []
    try:
        for line in proc.stdout:
            lines.append(line.rstrip())
            if any(s in line for s in SUCCESS):
                break
            if "Could not execute entrypoint" in line or "Incompatible mods found" in line or "Crash Report" in line \
                    or "Mixin apply failed" in line or "MixinApplyError" in line:
                for _ in range(120):
                    nxt = proc.stdout.readline()
                    if not nxt:
                        break
                    lines.append(nxt.rstrip())
                break
    finally:
        proc.kill()
    return "\n".join(lines)


def culprits(log: str, by_id: dict) -> dict:
    """{имя файла: причина} — какие jar виноваты"""
    found = {}

    def add(mod_id, why):
        f = by_id.get(norm(mod_id))
        if f and norm(mod_id) not in PLATFORM and f not in found:
            found[f] = why

    for m in re.finditer(r"provided by '([^']+)'", log):
        add(m.group(1), "упал при запуске")
    for m in re.finditer(r"Mod '[^']+' \(([^)]+)\) \S+ requires .*?(\S+), which is missing", log):
        add(m.group(1), f"нет зависимости {m.group(2)}")
    # «from mod X» бывает и в безобидных WARN — виним только строки с настоящей ошибкой встраивания
    for line in log.splitlines():
        if re.search(r"ERROR|Mixin apply failed|MixinApplyError|InvalidInjection|Critical injection", line):
            for m in re.finditer(r"from mod ([a-z0-9_\-]+)", line, re.I):
                add(m.group(1), "ошибка mixin")
    searching = False
    for line in log.splitlines():
        if re.match(r"^\s*(Caused by:|Suppressed:|[\w.$]+(Exception|Error)\b)", line):
            searching = True
            continue
        frame = re.match(r"^\s*at (?:knot//)?([a-zA-Z_][\w.$<>]+)\(", line) if searching else None
        if not frame:
            continue
        for seg in frame.group(1).split(".")[:-1]:
            s = norm(seg)
            if len(s) > 2 and s not in IGNORE_PKG and s in by_id:
                add(s, "его код упал (стек)")
                searching = False
                break
    return found


def check_pack(index_path: Path, work_root: Path, server_jars: dict) -> dict:
    index = json.loads(index_path.read_text(encoding="utf-8"))
    mc, loader = index["dependencies"]["minecraft"], index["dependencies"].get("fabric-loader")
    work = work_root / index_path.stem
    mods = work / "mods"
    mods.mkdir(parents=True, exist_ok=True)
    for old in mods.glob("*.jar"):
        old.unlink()
    key = (mc, loader)
    if key not in server_jars:
        inst = json.loads(fetch("https://meta.fabricmc.net/v2/versions/installer"))[0]["version"]
        path = work_root / f"fabric-server-{mc}-{loader}.jar"
        path.write_bytes(fetch(f"https://meta.fabricmc.net/v2/versions/loader/{mc}/{loader}/{inst}/server/jar"))
        server_jars[key] = path
    server_jar = server_jars[key]

    files = [f for f in index["files"] if f["env"]["server"] != "unsupported"]
    project_of = {}

    def dl(f):
        data = fetch(f["downloads"][0])
        if hashlib.sha1(data).hexdigest() != f["hashes"]["sha1"]:
            return
        name = Path(f["path"]).name
        (mods / name).write_bytes(data)
        project_of[name] = f["downloads"][0].split("/data/")[1].split("/")[0]

    with ThreadPoolExecutor(6) as pool:
        list(pool.map(dl, files))

    removed = []
    for attempt in range(8):
        infos = {p.name: jar_info(p) for p in mods.glob("*.jar")}
        by_id = {i: name for name, info in infos.items() for i in info["ids"]}
        log = run_server(work, server_jar)
        (work / f"try{attempt}.log").write_text(log, encoding="utf-8")
        if started(log):
            return {"pack": index_path.stem, "ok": True, "attempts": attempt + 1, "mods": len(infos), "removed": removed}
        bad = culprits(log, by_id)
        if not bad:
            return {"pack": index_path.stem, "ok": False, "attempts": attempt + 1, "mods": len(infos), "removed": removed,
                    "tail": log.splitlines()[-25:]}
        gone = set()
        for name, why in bad.items():
            removed.append({"file": name, "project": project_of.get(name), "name": infos[name]["name"], "why": why})
            (mods / name).unlink(missing_ok=True)
            gone.update(infos[name]["ids"])
        # кому были нужны убранные моды — тоже убираем (иначе следующий запуск упадёт на зависимостях)
        changed = True
        while changed:
            changed = False
            for name, info in infos.items():
                if (mods / name).exists() and any(d in gone for d in info["depends"]):
                    (mods / name).unlink()
                    gone.update(info["ids"])
                    removed.append({"file": name, "project": project_of.get(name), "name": info["name"],
                                    "why": "нужен убранный мод", "dependent": True})
                    changed = True
    return {"pack": index_path.stem, "ok": False, "attempts": 8, "removed": removed}


def main(work_root: str) -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    work_root = Path(work_root)
    work_root.mkdir(parents=True, exist_ok=True)
    results, server_jars = [], {}
    for index_path in sorted((ROOT / "out" / "packs").glob("*.json")):
        res = check_pack(index_path, work_root, server_jars)
        results.append(res)
        print(json.dumps({k: v for k, v in res.items() if k != "tail"}, ensure_ascii=False), flush=True)
        (ROOT / "out" / "mass_result.json").write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main(sys.argv[1])
