"""Настоящая проверка сборки: запускает сервер Fabric с модами из индекса .mrpack и смотрит, загрузятся ли они.

Запуск: py tools/server_check.py tools/out/pack.json РАБОЧАЯ_ПАПКА
EULA не принимается: сервер останавливается на ней, но к этому моменту моды уже загружены и их код запуска выполнен.
"""
import hashlib
import json
import subprocess
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

UA = {"User-Agent": "modsmith-server-check"}


def fetch(url: str) -> bytes:
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
        return r.read()


def main(index_path: str, work: str) -> int:
    index = json.loads(Path(index_path).read_text(encoding="utf-8"))
    deps = index["dependencies"]
    mc, loader = deps["minecraft"], deps.get("fabric-loader")
    if not loader:
        print("пока проверяю только Fabric")
        return 2
    work = Path(work)
    mods = work / "mods"
    mods.mkdir(parents=True, exist_ok=True)
    for old in mods.glob("*.jar"):
        old.unlink()

    installer = json.loads(fetch("https://meta.fabricmc.net/v2/versions/installer"))[0]["version"]
    server_jar = work / "fabric-server.jar"
    server_jar.write_bytes(fetch(f"https://meta.fabricmc.net/v2/versions/loader/{mc}/{loader}/{installer}/server/jar"))

    files = [f for f in index["files"] if f["env"]["server"] != "unsupported"]

    def download(f):
        data = fetch(f["downloads"][0])
        if hashlib.sha1(data).hexdigest() != f["hashes"]["sha1"]:
            return f"sha1 mismatch {f['path']}"
        (work / f["path"]).write_bytes(data)
        return None

    with ThreadPoolExecutor(6) as pool:
        errors = [e for e in pool.map(download, files) if e]
    print(f"модов для сервера: {len(files)} из {len(index['files'])}, ошибок скачивания: {len(errors)}", *errors, sep="\n")

    # Сервер останавливаем сами: после EULA некоторые моды держат фоновые потоки и Java не завершается
    proc = subprocess.Popen(["java", "-Djava.awt.headless=true", "-Xmx6G", "-jar", str(server_jar), "nogui"], cwd=work, stdout=subprocess.PIPE,
                            stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace")
    lines = []
    for line in proc.stdout:
        lines.append(line.rstrip())
        if "You need to agree to the EULA" in line or "Failed to load properties from file" in line \
                or "Could not execute entrypoint" in line \
                or "Incompatible mods found" in line or "---- Minecraft Crash Report ----" in line:
            break
    if "Could not execute entrypoint" in lines[-1] or "Crash Report" in lines[-1]:
        for _ in range(80):  # дочитываем причину
            nxt = proc.stdout.readline()
            if not nxt:
                break
            lines.append(nxt.rstrip())
    proc.kill()
    log = "\n".join(lines)
    (work / "check.log").write_text(log, encoding="utf-8")
    # дошёл до настроек сервера = код всех модов уже выполнен (дальше без EULA падает owo-lib, это не ошибка)
    eula_reached = "You need to agree to the EULA" in log or "Failed to load properties from file" in log
    crashed = "Could not execute entrypoint" in log or "Incompatible mods found" in log or "Crash Report" in log
    loaded = [l for l in log.splitlines() if "Loading" in l and "mods:" in l]
    print(*loaded[:1], sep="\n")
    print("ДОШЁЛ ДО EULA (моды загрузились и запустились)" if eula_reached and not crashed else "ОШИБКА ЗАПУСКА")
    if not eula_reached or crashed:
        print("\n".join(log.splitlines()[-60:]))
    return 0 if eula_reached and not crashed else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], sys.argv[2]))
