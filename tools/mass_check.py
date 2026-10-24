"""Массовая проверка запуском: для каждой сборки из tools/out/packs/*.json запускает сервер Fabric,
находит упавшие моды, убирает их и повторяет, пока сервер не стартует. Итог: tools/out/mass_result.json.

Запуск: py tools/mass_check.py РАБОЧАЯ_ПАПКА [папка_со_сборками]
Сервер создаёт мир целиком (пользователь разрешил ставить eula=true в тестовых серверах, 24.10):
так ловятся и падения при запуске, и зависания генерации мира на 0%.
"""
import hashlib
import json
import queue
import re
import shutil
import subprocess
import sys
import threading
import time
import urllib.request
import zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent
UA = {"User-Agent": "modsmith-mass-check"}
PLATFORM = {"minecraft", "java", "fabricloader", "fabric_loader", "mixinextras", "fabric", "fabric_api"}
IGNORE_PKG = {"net", "com", "org", "io", "dev", "me", "java", "knot", "minecraft", "fabricmc", "impl", "api", "common",
              "client", "server", "mixin", "core", "util", "github", "spongepowered", "loader", "main", "mod"}


def real_java() -> str:
    """«java» из PATH у Oracle — прослойка, которая запускает настоящую Java отдельным процессом.
    Берём настоящую: тогда номер процесса — сам сервер (его можно погасить и снять снимок потоков)."""
    out = subprocess.run(["java", "-XshowSettings:properties", "-version"], capture_output=True, text=True).stderr
    home = re.search(r"java\.home = (.+)", out)
    exe = Path(home.group(1).strip()) / "bin" / "java.exe" if home else None
    return str(exe) if exe and exe.exists() else "java"


JAVA = real_java()


def norm(s: str) -> str:
    return s.lower().replace("-", "_")


def fetch(url: str) -> bytes:
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180) as r:
        return r.read()


def parse_toml(text: str) -> dict:
    """Минимальный разбор mods.toml: id модов и обязательные зависимости (как в js/jarmeta.js)."""
    ids, deps = [], []
    for block in re.split(r"^\s*\[\[", text, flags=re.M)[1:]:
        head = block[: block.find("]]")].strip()
        get = lambda key: (re.search(rf"^\s*{key}\s*=\s*[\"']?([^\"'\n#]+)", block, re.M) or [None, None])[1]
        if head == "mods" and get("modId"):
            ids.append(norm(get("modId").strip()))
        elif head.startswith("dependencies") and get("modId"):
            kind, mandatory = get("type"), get("mandatory")
            if (kind.strip().lower() == "required") if kind else (mandatory or "true").strip() != "false":
                deps.append(norm(get("modId").strip()))
    return {"ids": ids, "depends": deps}


def jar_info(path: Path) -> dict:
    try:
        with zipfile.ZipFile(path) as z:
            names = set(z.namelist())
            if "fabric.mod.json" in names:
                j = json.loads(z.read("fabric.mod.json").decode("utf-8", "replace"))
                ids = [norm(j["id"])] + [norm(p) for p in j.get("provides", [])]
                return {"ids": ids, "depends": [norm(d) for d in j.get("depends", {})], "name": j.get("name", j["id"])}
            if "quilt.mod.json" in names:
                q = json.loads(z.read("quilt.mod.json").decode("utf-8", "replace")).get("quilt_loader", {})
                deps = [d if isinstance(d, str) else d.get("id") for d in q.get("depends", []) if isinstance(d, str) or not d.get("optional")]
                return {"ids": [norm(q.get("id", path.stem))], "depends": [norm(d) for d in deps if d], "name": q.get("id", path.stem)}
            for toml in ("META-INF/neoforge.mods.toml", "META-INF/mods.toml"):
                if toml in names:
                    info = parse_toml(z.read(toml).decode("utf-8", "replace"))
                    if info["ids"]:
                        return {**info, "name": info["ids"][0]}
    except Exception:  # noqa: BLE001 — битый jar
        pass
    return {"ids": [norm(path.stem)], "depends": [], "name": path.stem}


# Мир создан и сервер готов принимать игроков
SUCCESS = ("Done (", "MODSMITH-SILENT-OK")
# Сколько молчания после «Preparing level» проверять снимком потоков (некоторые сборки не печатают «Done»)
SILENCE = 60
# Сколько ждать создания мира; дольше — считаем, что генерация зависла
WORLD_TIMEOUT = 420


def started(log: str) -> bool:
    return any(s in log for s in SUCCESS)


def prepare_server(work_root: Path, mc: str, deps: dict, cache: dict) -> tuple:
    """Готовит сервер под загрузчик. Возвращает (рабочая папка, команда запуска). Ставится один раз на версию."""
    if "fabric-loader" in deps:
        loader = deps["fabric-loader"]
        key = ("fabric", mc, loader)
        if key not in cache:
            inst = json.loads(fetch("https://meta.fabricmc.net/v2/versions/installer"))[0]["version"]
            jar = work_root / f"fabric-server-{mc}-{loader}.jar"
            jar.write_bytes(fetch(f"https://meta.fabricmc.net/v2/versions/loader/{mc}/{loader}/{inst}/server/jar"))
            cache[key] = jar
        return None, ["-jar", str(cache[key]), "nogui"]
    if "quilt-loader" in deps:
        loader = deps["quilt-loader"]
        home = work_root / f"quilt-{mc}-{loader}"
        key = ("quilt", mc, loader)
        if key not in cache:
            for _ in range(3):
                if (home / "quilt-server-launch.jar").exists():
                    break
                home.mkdir(parents=True, exist_ok=True)
                installer = work_root / "quilt-installer.jar"
                if not installer.exists():
                    installer.write_bytes(fetch("https://quiltmc.org/api/v1/download-latest-installer/java-universal"))
                subprocess.run(["java", "-jar", str(installer), "install", "server", mc, loader, "--download-server",
                                f"--install-dir={home}"], capture_output=True, timeout=900)
            if not (home / "quilt-server-launch.jar").exists():
                raise RuntimeError(f"сервер Quilt {mc} не установился")
            cache[key] = home
        # общая папка сервера: моды и мир каждый раз свои (check_pack чистит mods и config)
        return home, ["-jar", "quilt-server-launch.jar", "nogui"]
    if "neoforge" in deps or "forge" in deps:
        neo = "neoforge" in deps
        ver = deps["neoforge"] if neo else f"{mc}-{deps['forge']}"
        key = ("neo" if neo else "forge", ver)
        home = work_root / f"{'neoforge' if neo else 'forge'}-{ver}"
        lib = f"libraries/net/neoforged/neoforge/{ver}" if neo else f"libraries/net/minecraftforge/forge/{ver}"
        if key not in cache:
            # установка иногда срывается на скачивании — повторяем, пока не появится файл запуска
            for _ in range(3):
                if (home / lib / "win_args.txt").exists():
                    break
                home.mkdir(parents=True, exist_ok=True)
                url = (f"https://maven.neoforged.net/releases/net/neoforged/neoforge/{ver}/neoforge-{ver}-installer.jar" if neo
                       else f"https://maven.minecraftforge.net/net/minecraftforge/forge/{ver}/forge-{ver}-installer.jar")
                installer = home / "installer.jar"
                if not installer.exists():
                    installer.write_bytes(fetch(url))
                subprocess.run(["java", "-jar", str(installer), "--installServer", str(home)], cwd=home,
                               capture_output=True, timeout=900)
            if not (home / lib / "win_args.txt").exists():
                raise RuntimeError(f"сервер {ver} не установился")
            cache[key] = home
        return home, [f"@{lib}/win_args.txt", "nogui"]
    raise ValueError("неизвестный загрузчик")


def thread_dump(pid: int) -> str:
    # у сильно нагруженного сервера jcmd бывает не отвечает: тогда просто нет снимка, проверка не падает
    try:
        return subprocess.run([str(Path(JAVA).with_name("jcmd.exe")), str(pid), "Thread.print"], capture_output=True, text=True,
                              encoding="utf-8", errors="replace", timeout=60).stdout
    except subprocess.TimeoutExpired:
        return ""


def server_idle(dump: str) -> bool:
    """Главный поток сервера спокойно ждёт следующего такта — значит, мир создан и сервер работает."""
    m = re.search(r'"Server thread".*?\n\n', dump, re.S)
    block = m.group(0) if m else ""
    busy = ("ChunkMap", "ServerChunkCache", "prepareLevels", "createLevels", "class_3215", "class_3898", "WorldGen", "Feature")
    return "parkNanos" in block and "MinecraftServer" in block and not any(k in block for k in busy)


def run_server(work: Path, args: list) -> str:
    # свежий мир на каждую попытку, EULA принята (разрешение пользователя), сторожевой таймер сервера выключен:
    # медленную генерацию с модами он иначе принимает за зависание
    shutil.rmtree(work / "world", ignore_errors=True)
    (work / "eula.txt").write_text("eula=true\n", encoding="utf-8")
    # свой порт на каждый запуск: прошлый сервер мог ещё не отпустить свой
    port = 30000 + int(time.time() * 1000) % 20000
    (work / "server.properties").write_text(f"level-seed=modsmith\nmax-tick-time=-1\nonline-mode=false\nserver-port={port}\n",
                                            encoding="utf-8")
    # headless: окна-«сторожа» модов (owo-sentinel и т.п.) не откроются и не повесят проверку
    proc = subprocess.Popen([JAVA, "-Djava.awt.headless=true", "-Xmx6G", *args], cwd=work,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, stdin=subprocess.PIPE, text=True,
                            encoding="utf-8", errors="replace")
    lines_q: queue.Queue = queue.Queue()
    threading.Thread(target=lambda: [lines_q.put(l) for l in proc.stdout] + [lines_q.put(None)], daemon=True).start()
    lines = []
    deadline = time.time() + WORLD_TIMEOUT
    level_started = False
    try:
        while True:
            try:
                line = lines_q.get(timeout=max(0.1, min(SILENCE, deadline - time.time())) if level_started else max(0.1, deadline - time.time()))
                if line is None and proc.poll() is None:
                    # вывод закрылся, а сервер жив (бывает на Quilt): дальше смотрим только по снимку потоков
                    time.sleep(SILENCE)
                    raise queue.Empty
            except queue.Empty:
                if level_started and time.time() < deadline and proc.poll() is None:
                    dump = thread_dump(proc.pid)
                    if server_idle(dump):
                        lines.append("MODSMITH-SILENT-OK: «Done» не напечатан, но сервер создал мир и работает (снимок потоков)")
                        break
                    if time.time() < deadline:
                        continue
                # мир не создался за отведённое время: снимок потоков покажет, на каком моде всё встало
                lines.append(f"MODSMITH-HANG: мир не создался за {WORLD_TIMEOUT} с")
                dump = thread_dump(proc.pid)
                (work / "hang-threads.txt").write_text(dump, encoding="utf-8")
                lines.append(dump)
                break
            if line is None:
                break
            lines.append(line.rstrip())
            if "Preparing level" in line or "Preparing start region" in line:
                level_started = True
            if any(s in line for s in SUCCESS):
                break
            saved = re.search(r"crash report has been saved to: (.+\.txt)", line)
            if saved:
                # сервер упал при создании мира: причина — в файле отчёта
                try:
                    lines.append(Path(saved.group(1).strip()).read_text(encoding="utf-8", errors="replace"))
                except OSError:
                    pass
                break
            # только настоящий заголовок отчёта: в списке модов Quilt есть «Quilted Fabric Crash Report Info»
            if "dtt_agent" in line or "NativeBootstrap" in line:
                lines.append("MODSMITH-NATIVE: мод загружает нативный агент (DLL) — такие моды в проверке не запускаем")
                break
            if "Could not execute entrypoint" in line or "Incompatible mods found" in line or "---- Minecraft Crash Report" in line \
                    or "Mixin apply failed" in line or "MixinApplyError" in line or "Critical injection failure" in line                     or "can't proceed with server load" in line or "Mixin transformation of" in line or "MixinTransformerError" in line or "FormattedException" in line:
                end = time.time() + 15
                while time.time() < end:
                    try:
                        nxt = lines_q.get(timeout=1)
                    except queue.Empty:
                        continue
                    if nxt is None:
                        break
                    lines.append(nxt.rstrip())
                break
    finally:
        # на всякий случай гасим всё дерево процессов: иначе сервер остаётся висеть и держит порт
        subprocess.run(["taskkill", "/T", "/F", "/PID", str(proc.pid)], capture_output=True)
        proc.wait(timeout=30)
    return "\n".join(lines)


def hung(log: str) -> bool:
    return "MODSMITH-HANG" in log


def culprits(log: str, by_id: dict, files_by_name: dict = None) -> dict:
    """{имя файла: причина} — какие jar виноваты"""
    found = {}
    files_by_name = files_by_name or {}

    def add(mod_id, why):
        f = by_id.get(norm(mod_id))
        if not f and len(mod_id) >= 5:
            # мод вложен в сборник (jarjar) и его id нет среди id jar: ищем jar по имени файла
            low = mod_id.lower().replace("_", "-")
            f = next((name for name in files_by_name if low in name.lower().replace("_", "-")), None)
        if f and norm(mod_id) not in PLATFORM and f not in found:
            found[f] = why

    for m in re.finditer(r"Exception while [^(\n]+\(([a-z0-9_\-]+)\)", log):
        add(m.group(1), "упал при запуске")
    for m in re.finditer(r"provided by '([^']+)'", log):
        add(m.group(1), "упал при запуске")
    # «- Fog (fog) has failed to load correctly … for invalid dist DEDICATED_SERVER» — мод только для игры, не для сервера
    for m in re.finditer(r"^\s*- .+? \(([a-z0-9_\-]+)\) has failed to load correctly\s*\n\s*(.+)", log, re.M):
        add(m.group(1), "КЛИЕНТСКИЙ: на сервере не работает (в игре он нужен)" if "invalid dist" in m.group(2) else "упал при запуске")
    # NeoForge/Forge: мод не смог создаться или подписаться на события (часто — не та версия основного мода)
    for m in re.finditer(r"(?:Failed to create mod instance|Failed to register automatic subscribers)\. ModID: ([a-z0-9_\-]+)", log):
        add(m.group(1), "упал при запуске (не та версия основного мода или нет библиотеки)")
    # «Mixin [valkyrienskies-common.mixins.json:…] … FAILED during APPLY» — мод видно по имени файла встраивания
    for m in re.finditer(r"Mixin \[([\w.-]+?)\.mixins\.json:[^\]]*\][^\n]*?FAILED", log):
        cfg = m.group(1)
        add(re.split(r"[-.]", cfg)[0], "не смог встроиться в игру: эту часть уже меняет другой мод")
    # «Failed to parse minecraft:worldgen/…json from pack mr_caves__canyons» — датапак внутри мода сломал мир
    for m in re.finditer(r"Failed to (?:parse|load) [^\n]*? from pack (?:\w+/)?(?:mr_|file/)?([A-Za-z0-9_\-.]+)", log):
        add(m.group(1), "его данные мира не подходят этой версии игры")
    # Forge: два мода несут одну и ту же библиотеку внутри себя
    for m in re.finditer(r"Modules (\S+) and (\S+) export package", log):
        for mod in (m.group(1), m.group(2)):
            if norm(mod) != "mixinextras":
                add(mod, "везёт внутри копию библиотеки, которая уже есть (дубль пакетов)")
    # Forge/NeoForge: «Mod ID: 'x', Requested by: 'y'» и «Mod y requires x»
    for m in re.finditer(r"Requested by: '([^']+)'", log):
        add(m.group(1), "нет обязательной зависимости")
    for m in re.finditer(r"Mod (\S+) (?:only supports|requires) ", log):
        add(m.group(1).strip("'"), "несовместим по версии")
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
            # «файл не найден» — мод просто создаёт свои настройки, это не падение
            searching = not re.search(r"FileNotFoundException|NoSuchFileException", line)
            continue
        frame = re.match(r"^\s*at (?:[^\s/()]*/)*([a-zA-Z_][\w.$<>]+)\(", line) if searching else None
        if not frame:
            continue
        # в latest.log у строки стека есть имя файла мода: «~[destroying-minecraft-1.0.0.jar:?]»
        jar = re.search(r"\[([^\[\]]+\.jar)", line)
        if jar and jar.group(1) in files_by_name:
            name = jar.group(1)
            if name not in found and not any(i in PLATFORM for i in files_by_name[name]):
                found[name] = "его код упал (стек)"
            searching = False
            continue
        for seg in frame.group(1).split(".")[:-1]:
            s = norm(seg)
            if len(s) > 2 and s not in IGNORE_PKG and s in by_id:
                add(s, "его код упал (стек)")
                searching = False
                break
    return found


def hang_suspects(log: str, by_id: dict) -> list:
    """Какие моды встречаются в стеках потоков сервера и генерации мира во время зависания."""
    seen = {}
    block_ok = False
    for line in log.splitlines():
        if line.startswith('"'):
            block_ok = any(k in line for k in ("Server thread", "Worker-Main", "c2me", "Chunk", "worldgen", "Light"))
            continue
        m = re.match(r"^\s*at (?:[\w.]+/)*([a-zA-Z_][\w.$]+)\(", line) if block_ok else None
        if not m:
            continue
        for seg in m.group(1).split(".")[:-1]:
            n = norm(seg)
            if len(n) > 2 and n not in IGNORE_PKG and n in by_id:
                seen[by_id[n]] = seen.get(by_id[n], 0) + 1
    return sorted(seen, key=seen.get, reverse=True)[:8]


def check_pack(index_path: Path, work_root: Path, server_jars: dict) -> dict:
    index = json.loads(index_path.read_text(encoding="utf-8"))
    deps = index["dependencies"]
    home, args = prepare_server(work_root, deps["minecraft"], deps, server_jars)
    work = home or work_root / index_path.stem  # Forge/NeoForge — общая папка сервера, Fabric — своя на сборку
    mods = work / "mods"
    mods.mkdir(parents=True, exist_ok=True)
    for old in mods.glob("*.jar"):
        old.unlink()
    for old in (work / "config",):  # конфиги прошлой сборки не должны влиять на следующую
        if old.exists() and home:
            for f in old.rglob("*"):
                if f.is_file():
                    f.unlink()

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
        log = run_server(work, args)
        (work_root / f"{index_path.stem}-try{attempt}.log").write_text(log, encoding="utf-8")
        if started(log):
            return {"pack": index_path.stem, "ok": True, "attempts": attempt + 1, "mods": len(infos), "removed": removed}
        if hung(log):
            return {"pack": index_path.stem, "ok": False, "hang": True, "attempts": attempt + 1, "mods": len(infos),
                    "removed": removed, "suspects": hang_suspects(log, by_id)}
        bad = culprits(log, by_id, {name: info['ids'] for name, info in infos.items()})
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
    for index_path in sorted((ROOT / "out" / (sys.argv[2] if len(sys.argv) > 2 else "packs")).glob("*.json")):
        res = check_pack(index_path, work_root, server_jars)
        results.append(res)
        print(json.dumps({k: v for k, v in res.items() if k != "tail"}, ensure_ascii=False), flush=True)
        (ROOT / "out" / "mass_result.json").write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main(sys.argv[1])
