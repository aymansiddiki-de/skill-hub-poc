import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REGISTRY = ROOT / "registry"
OUTPUT = ROOT / "site" / "catalog.json"

FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n?", re.DOTALL)


def parse_frontmatter(text):
    match = FRONTMATTER_RE.match(text)
    if not match:
        return {}

    fields = {}
    for line in match.group(1).splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        key = key.strip()
        value = value.strip()

        if value.startswith("[") and value.endswith("]"):
            items = [item.strip() for item in value[1:-1].split(",") if item.strip()]
            fields[key] = items
        else:
            fields[key] = value

    return fields


def load_skill(path):
    text = path.read_text(encoding="utf-8")
    frontmatter = parse_frontmatter(text)

    return {
        "id": path.stem,
        "title": frontmatter.get("title", path.stem),
        "description": frontmatter.get("description", ""),
        "tags": frontmatter.get("tags", []),
        "path": str(path.relative_to(ROOT)).replace("\\", "/"),
    }


def load_artifact(path):
    data = json.loads(path.read_text(encoding="utf-8"))

    return {
        "id": path.stem,
        "title": data.get("title", path.stem),
        "description": data.get("description", ""),
        "url": data.get("url", ""),
    }


def build():
    people = []

    for person_dir in sorted(REGISTRY.iterdir()):
        if not person_dir.is_dir():
            continue

        profile_path = person_dir / "profile.json"
        if not profile_path.exists():
            continue

        profile = json.loads(profile_path.read_text(encoding="utf-8"))

        skills_dir = person_dir / "skills"
        skills = [load_skill(p) for p in sorted(skills_dir.glob("*.md"))] if skills_dir.exists() else []

        artifacts_dir = person_dir / "artifacts"
        artifacts = [load_artifact(p) for p in sorted(artifacts_dir.glob("*.json"))] if artifacts_dir.exists() else []

        people.append({
            "id": person_dir.name,
            "name": profile.get("name", person_dir.name),
            "role": profile.get("role", ""),
            "focus": profile.get("focus", ""),
            "skills": skills,
            "artifacts": artifacts,
        })

    OUTPUT.write_text(json.dumps(people, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(people)} people to {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    build()
