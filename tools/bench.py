"""Замер прогрузки чанков: сколько секунд сервер генерирует стартовую область с разными наборами модов.

Запуск: py -I tools/bench.py РАБОЧАЯ_ПАПКА индекс.json вариант=регулярка_имён_для_удаления [вариант=...]
Пример: py -I tools/bench.py C:/tmp/bench tools/out/w2/forge-vanillaplus.json база= без_saturn=saturn с_c2me=@C:/tmp/c2me.jar
Каждый вариант запускается дважды, берётся лучшее время (первый запуск прогревает диск).
Время — между первой строкой «Preparing spawn area» и «Done» в логе сервера.
"""
import hashlib
import json
import re
import sys
import shutil
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, str(Path(__file__).resolve().parent))
import mass_check as mc  # noqa: E402


def secs(stamp: str) -> float:
    h, m, s = (int(x) for x in stamp.split(":"))
    return h * 3600 + m * 60 + s


def gen_time(log: str):
    first = re.search(r"\[(\d\d:\d\d:\d\d)[^\]]*\][^\n]*Preparing (?:spawn area|start region)", log)
    done = re.search(r"\[(\d\d:\d\d:\d\d)[^\]]*\][^\n]*Done \(([\d.,]+)s\)", log)
    if not first or not done:
        return None, None
    return secs(done.group(1)) - secs(first.group(1)), float(done.group(2).replace(",", "."))


def main(work_root, index_path, variants):
    work_root = Path(work_root)
    work_root.mkdir(parents=True, exist_ok=True)
    cache = work_root / "jar-cache"
    cache.mkdir(exist_ok=True)
    index = json.loads(Path(index_path).read_text(encoding="utf-8"))
    deps = index["dependencies"]
    files = [f for f in index["files"] if f["env"]["server"] != "unsupported" and f["path"].startswith("mods/")]

    def get(f):
        p = cache / (f["hashes"]["sha1"] + ".jar")
        if not p.exists():
            data = mc.fetch(f["downloads"][0])
            if hashlib.sha1(data).hexdigest() == f["hashes"]["sha1"]:
                p.write_bytes(data)
        return p

    with ThreadPoolExecutor(6) as pool:
        paths = dict(zip([f["path"] for f in files], pool.map(get, files)))
    home, args = mc.prepare_server(work_root, deps["minecraft"], deps, {})
    work = home or work_root / "bench-server"
    work.mkdir(parents=True, exist_ok=True)
    for name, spec in variants:
        # «регулярка@путь1;путь2»: что убрать и какие jar добавить сверху (проверить мод, которого нет в сборке)
        drop, _, extra = spec.partition("@")
        extra_jars = [Path(x) for x in extra.split(";") if x]
        best = None
        for attempt in range(2):
            mods = work / "mods"
            shutil.rmtree(mods, ignore_errors=True)
            shutil.rmtree(work / "config", ignore_errors=True)
            mods.mkdir(parents=True)
            kept = 0
            for path, src in paths.items():
                if drop and re.search(drop, Path(path).name, re.I):
                    continue
                shutil.copy(src, mods / Path(path).name)
                kept += 1
            for j in extra_jars:
                shutil.copy(j, mods / j.name)
            log = mc.run_server(work, args)
            gen, done = gen_time(log)
            if gen is not None and (best is None or gen < best[0]):
                best = (gen, done, kept)
            if gen is None:
                print(f"  {name}: попытка {attempt + 1} без результата (сервер не дошёл до Done)", flush=True)
        print(f"{name}: генерация области {best[0]:.0f} с, всего до Done {best[1]:.1f} с, модов {best[2]}" if best else f"{name}: нет результата", flush=True)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    pairs = [tuple(a.split("=", 1)) for a in sys.argv[3:]]
    main(sys.argv[1], sys.argv[2], pairs)
