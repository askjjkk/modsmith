"""Собирает js/verified.js: какие моды прошли настоящую проверку запуском (сервер создал мир) на каком загрузчике и версии.

Запуск: py -I tools/make_verified.py ПАПКА_С_ЛОГОМ:ПАПКА_СО_СБОРКАМИ [...]
Например: py -I tools/make_verified.py mass_w2.log:w2 mass_w3.log:w3 (пути относительно tools/out).
Сборка засчитывается, если сервер с ней запустился; моды, которые проверка убрала, не засчитываются.
"""
import json
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parent / "out"
TARGET = Path(__file__).resolve().parent.parent / "js" / "verified.js"
LOADER = {"fabric-loader": "fabric", "quilt-loader": "quilt", "forge": "forge", "neoforge": "neoforge"}


def main(pairs):
    verified = {}
    if TARGET.exists():  # дописываем к уже проверенному
        text = TARGET.read_text(encoding="utf-8")
        verified = {k: set(v) for k, v in json.loads(text[text.index("{"):text.rindex("}") + 1]).items()}
    for pair in pairs:
        log, folder = pair.split(":")
        for line in (OUT / log).read_text(encoding="utf-8").splitlines():
            if not line.startswith("{"):
                continue
            res = json.loads(line)
            if not res.get("ok"):
                continue
            index = json.loads((OUT / folder / f"{res['pack']}.json").read_text(encoding="utf-8"))
            deps = index["dependencies"]
            loader = next(LOADER[k] for k in deps if k in LOADER)
            key = f"{loader}@{deps['minecraft']}"
            removed = {r.get("project") for r in res.get("removed", [])}
            for f in index["files"]:
                if not f["path"].startswith("mods/") or f["env"].get("server") == "unsupported":
                    continue  # клиентские моды сервер не запускает — их не засчитываем
                pid = f["downloads"][0].split("/data/")[1].split("/")[0]
                if pid not in removed:
                    verified.setdefault(key, set()).add(pid)
    body = json.dumps({k: sorted(v) for k, v in sorted(verified.items())}, ensure_ascii=False, separators=(",", ":"))
    TARGET.write_text(
        "// Моды, которые прошли проверку запуском (сервер с ними создал мир): «загрузчик@версия» -> id проектов Modrinth.\n"
        "// Файл собирает tools/make_verified.py из результатов tools/mass_check.py — руками не править.\n"
        f"export const VERIFIED = {body}\n", encoding="utf-8")
    print({k: len(v) for k, v in verified.items()})


if __name__ == "__main__":
    main(sys.argv[1:])
