"""Build the current load-unpacked test copy and a reproducible ZIP."""

import json
import re
import shutil
import tempfile
from pathlib import Path
from zipfile import ZIP_STORED, ZipFile, ZipInfo


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "extension"
DIST = ROOT / "dist"
VERSION = json.loads((SOURCE / "manifest.json").read_text(encoding="utf-8"))["version"]
if not isinstance(VERSION, str) or not re.fullmatch(r"\d+(?:\.\d+){0,3}", VERSION):
    raise SystemExit("extension/manifest.json has an invalid version")
NAME = f"omarchy-start-{VERSION}"
TARGET = DIST / NAME
ARCHIVE = DIST / f"{NAME}.zip"
ZIP_TIME = (1980, 1, 1, 0, 0, 0)


def write_archive(source: Path, archive: Path):
    # Storing bytes avoids zlib-version differences between build machines.
    with ZipFile(archive, "w", compression=ZIP_STORED) as bundle:
        for path in sorted(p for p in source.rglob("*") if p.is_file()):
            name = path.relative_to(source).as_posix()
            info = ZipInfo(name, date_time=ZIP_TIME)
            info.compress_type = ZIP_STORED
            info.create_system = 3
            info.external_attr = 0o644 << 16
            bundle.writestr(info, path.read_bytes())


def remove_old_builds():
    for path in DIST.glob("omarchy-start-*"):
        if path in (TARGET, ARCHIVE):
            continue
        if path.is_dir():
            shutil.rmtree(path)
        elif path.is_file():
            path.unlink()


def main():
    if (SOURCE / "LICENSE").read_bytes() != (ROOT / "LICENSE").read_bytes():
        raise SystemExit("extension/LICENSE must match the root LICENSE")
    DIST.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="omarchy-start-build-") as temp:
        stage = Path(temp) / NAME
        stage.mkdir()
        for directory in ("assets", "background", "src", "styles"):
            shutil.copytree(SOURCE / directory, stage / directory)
        for filename in ("manifest.json", "newtab.html", "README.md", "LICENSE", "LICENSES.md"):
            shutil.copyfile(SOURCE / filename, stage / filename)
        staged_archive = Path(temp) / ARCHIVE.name
        write_archive(stage, staged_archive)

        if TARGET.exists():
            shutil.rmtree(TARGET)
        if ARCHIVE.exists():
            ARCHIVE.unlink()
        shutil.move(stage, TARGET)
        shutil.move(staged_archive, ARCHIVE)

    remove_old_builds()
    print(TARGET)
    print(ARCHIVE)


if __name__ == "__main__":
    main()
