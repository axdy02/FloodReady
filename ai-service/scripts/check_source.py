from pathlib import Path


def main() -> None:
    paths = (
        list(Path("app").rglob("*.py"))
        + list(Path("scripts").rglob("*.py"))
        + [Path("Dockerfile"), Path(".dockerignore")]
    )
    for path in paths:
        text = path.read_text(encoding="utf-8")
        if "".join(("pri", "nt(")) in text or "".join(("TO", "DO")) in text or "from typing import " + "Any" in text:
            raise SystemExit(f"source policy violation: {path}")
    readme = Path("README.md").read_text(encoding="utf-8")
    for block in readme.split("```")[1::2]:
        if "".join(("pri", "nt(")) in block or "".join(("TO", "DO")) in block or "from typing import " + "Any" in block:
            raise SystemExit("source policy violation: README.md")


if __name__ == "__main__":
    main()
