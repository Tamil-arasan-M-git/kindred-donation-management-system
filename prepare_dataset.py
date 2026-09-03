"""
prepare_dataset.py

Consolidates multiple messy, differently-formatted, differently-laid-out
source datasets into one clean YOLO-format dataset using ONLY the 6 parent
donation categories: clothing, food, books, electronics, furniture, utensils.

Each source's format (YOLO/COCO/VOC/classification-folders) and layout is
auto-detected by dataset_discovery.py, so you only need to point at each
source's root folder — no manual path wiring per source.

Why collapse to parent classes:
Different source datasets label subclasses inconsistently (e.g. one dataset
splits "shirt"/"jacket"/"trouser", another just has "clothing", a third has
broken/missing subclass boxes). Collapsing everything to the 6 parent
classes lets every source contribute usable data even with messy or
partial subclass labels — as long as the PARENT category is right, which
is far easier to verify.

Split handling:
A source that already has a train/val/test split (detected from its folder
names) keeps that split as-is. A source with no split gets pooled with
other unsplit sources and split by this script (VAL_SPLIT/TEST_SPLIT).

Usage:
    1. Fill in LABEL_MAP: every original class name (from every source,
       whatever format it's in) -> one of the 6 parent classes. Run once
       with DRY_RUN=True first to print every class name discovered, so
       you know exactly what to add to LABEL_MAP.
    2. List your source folders in SOURCE_ROOTS.
    3. Run: python prepare_dataset.py
    4. Output lands in ./dataset_unified/{images,labels}/{train,val,test}
       plus data.yaml, ready to hand to train.py.
"""

import random
import shutil
from pathlib import Path

from dataset_discovery import discover_source, DiscoveredRecord
from target_classes import TARGET_CLASSES, CLASS_TO_ID

# ---------------------------------------------------------------------------
# 1. TARGET CLASSES now live in target_classes.py (shared with pseudo_label.py)
#    so class ids stay consistent across every script that writes labels.
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# 2. LABEL MAP — original class name (as discovered, case-sensitive) ->
#    parent class name. Set DRY_RUN=True and run once to see every class
#    name actually present across your sources before filling this in.
# ---------------------------------------------------------------------------
LABEL_MAP = {
    # --- footwear dataset (raw_datasets/Footwear) — includes both cases
    # since the actual folder names came back capitalized (Shoe, Sandal) ---
    "shoe": "clothing", "Shoe": "clothing",
    "sandal": "clothing", "Sandal": "clothing",
    "Boot": "clothing", "boot": "clothing",
    # --- furniture_raw dataset ---
    "table": "furniture", "cupboard": "furniture", "chair": "furniture", "bed": "furniture",
    # --- clothing-dataset-small-master ---
    "t-shirt": "clothing", "shoes": "clothing", "shorts": "clothing", "skirt": "clothing",
    "outwear": "clothing", "pants": "clothing", "shirt": "clothing", "dress": "clothing",
    "hat": "clothing", "longsleeve": "clothing",
    # --- Utensils_Final (confirmed via dry run output) ---
    "fork": "utensils", "spoon": "utensils", "bowl": "utensils", "cup": "utensils",
    "bottle": "utensils",
    # --- identity mappings for pseudo_label.py output (electronics/food/books,
    # once you add them) — these already use parent names directly ---
    "electronics": "electronics", "food": "food", "books": "books",
    "furniture": "furniture", "utensils": "utensils", "clothing": "clothing",
    # --- fill in as you add more datasets ---
}

# ---------------------------------------------------------------------------
# 3. SOURCE ROOTS — just point at each dataset's top-level folder. Format
#    and internal layout are auto-detected. Override "fmt" only if
#    detection guesses wrong for a particular source.
#
#    Typical setup for this project:
#      - "pseudo_labeled": output of pseudo_label.py, covers electronics/
#        furniture/utensils/books/food. Already valid YOLO format with a
#        classes.txt matching TARGET_CLASSES — dataset_discovery reads
#        parent class names directly, so LABEL_MAP's identity entries
#        ("electronics": "electronics", etc.) already cover it, nothing
#        extra to configure.
#      - "clothing_dataset": your separately-collected clothing dataset.
#        Point it at the root and let format auto-detect; whatever
#        original class names it uses (e.g. "shirt", "dress") still need
#        entries in LABEL_MAP mapping them to "clothing".
# ---------------------------------------------------------------------------
SOURCE_ROOTS = [
    {"name": "footwear", "root": "raw_datasets/Footwear", "fmt": "folder"},
    {"name": "furniture_raw", "root": "raw_datasets/furniture_raw", "fmt": "folder"},
    {"name": "clothing_small", "root": "raw_datasets/clothing-dataset-small-master", "fmt": "folder"},
    {"name": "utensils_final", "root": "raw_datasets/Utensils_Final", "fmt": "yolo"},
    # Add pseudo_labeled/ here once you've run pseudo_label.py for
    # electronics/books/food (folders you don't have images for yet):
    # {"name": "pseudo_labeled", "root": "pseudo_labeled", "fmt": "yolo"},
]

OUTPUT_DIR = Path("dataset_unified")
VAL_SPLIT = 0.15
TEST_SPLIT = 0.10
RANDOM_SEED = 42
DRY_RUN = False  # set True to print discovered class names without writing files


def remap_boxes(record: DiscoveredRecord, unmapped_seen: set) -> list[str]:
    """Convert a DiscoveredRecord's (class_name, cx, cy, w, h) boxes into
    YOLO label lines using TARGET_CLASSES ids. Unmapped class names are
    dropped and collected for reporting rather than guessed."""
    lines = []
    for name, cx, cy, w, h in record.boxes:
        target = LABEL_MAP.get(name)
        if target is None:
            unmapped_seen.add(name)
            continue
        cls_id = CLASS_TO_ID[target]
        lines.append(f"{cls_id} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}")
    return lines


def collect_pairs():
    """Discover every source, remap labels, and separate into presplit
    (source already had a split) vs unsplit (needs splitting by us)."""
    presplit: dict[str, list] = {"train": [], "val": [], "test": []}
    unsplit: list = []
    unmapped_seen: set = set()

    for src in SOURCE_ROOTS:
        records = discover_source(src["root"], fmt=src.get("fmt"))
        print(f"{src['name']}: {len(records)} images discovered")

        if DRY_RUN:
            for r in records:
                for name, *_ in r.boxes:
                    if name not in LABEL_MAP:
                        unmapped_seen.add(name)
            continue

        for rec in records:
            lines = remap_boxes(rec, unmapped_seen)
            if not lines:
                continue
            pair = (rec.image_path, lines)
            if rec.split and rec.split in presplit:
                presplit[rec.split].append(pair)
            else:
                unsplit.append(pair)

    if unmapped_seen:
        print(f"\n{'DISCOVERED (dry run)' if DRY_RUN else 'WARNING: dropped'} "
              f"class names not in LABEL_MAP ({len(unmapped_seen)}):")
        for name in sorted(unmapped_seen):
            print(f"  {name!r}")

    return presplit, unsplit


def write_split(pairs, split_name: str):
    img_out = OUTPUT_DIR / "images" / split_name
    lbl_out = OUTPUT_DIR / "labels" / split_name
    img_out.mkdir(parents=True, exist_ok=True)
    lbl_out.mkdir(parents=True, exist_ok=True)
    for img_path, lines in pairs:
        shutil.copy2(img_path, img_out / img_path.name)
        (lbl_out / (img_path.stem + ".txt")).write_text("\n".join(lines) + "\n")
    print(f"  {split_name}: {len(pairs)} images written")


def write_data_yaml():
    content = (
        f"path: {OUTPUT_DIR.resolve()}\n"
        f"train: images/train\n"
        f"val: images/val\n"
        f"test: images/test\n"
        f"nc: {len(TARGET_CLASSES)}\n"
        f"names: {TARGET_CLASSES}\n"
    )
    (OUTPUT_DIR / "data.yaml").write_text(content)
    print(f"Wrote {OUTPUT_DIR / 'data.yaml'}")


def report_class_balance(final: dict):
    """Count how many boxes of each class exist per split, and flag any
    class that's badly underrepresented — imbalance doesn't crash training,
    but a class with 10x fewer examples than another will train noticeably
    worse, and it's much cheaper to notice this NOW than after training."""
    counts = {split: {name: 0 for name in TARGET_CLASSES} for split in final}
    for split, pairs in final.items():
        for _, lines in pairs:
            for line in lines:
                cls_id = int(line.split()[0])
                counts[split][TARGET_CLASSES[cls_id]] += 1

    print(f"\n{'='*60}")
    print("Class balance (box counts per split):")
    header = f"{'class':<14}" + "".join(f"{s:>10}" for s in final) + f"{'total':>10}"
    print(header)
    totals = {name: 0 for name in TARGET_CLASSES}
    for name in TARGET_CLASSES:
        row_total = sum(counts[split][name] for split in final)
        totals[name] = row_total
        print(f"{name:<14}" + "".join(f"{counts[s][name]:>10}" for s in final) + f"{row_total:>10}")

    max_count = max(totals.values()) if totals.values() else 0
    if max_count > 0:
        underrepresented = [n for n, c in totals.items() if c < 0.3 * max_count]
        if underrepresented:
            print(f"\nWARNING: these classes have under 30% of the count of your "
                  f"largest class and will likely train worse: {underrepresented}")
            print("Consider collecting more images for them, or check per-class "
                  "mAP after training to confirm whether this actually hurt.")


def main():
    random.seed(RANDOM_SEED)
    presplit, unsplit = collect_pairs()

    if DRY_RUN:
        print("\nDry run complete — fill in LABEL_MAP with the class names "
              "above, set DRY_RUN=False, then run again.")
        return

    if not any(presplit.values()) and not unsplit:
        print("No usable image/label pairs found — check SOURCE_ROOTS paths.")
        return

    random.shuffle(unsplit)
    n_val = int(len(unsplit) * VAL_SPLIT)
    n_test = int(len(unsplit) * TEST_SPLIT)
    final = {
        "train": presplit["train"] + unsplit[n_val + n_test:],
        "val": presplit["val"] + unsplit[:n_val],
        "test": presplit["test"] + unsplit[n_val:n_val + n_test],
    }

    print(f"\nPre-split (kept as-is): train={len(presplit['train'])} "
          f"val={len(presplit['val'])} test={len(presplit['test'])}")
    print(f"Unsplit (re-split by this script): "
          f"train={len(unsplit[n_val + n_test:])} val={n_val} test={n_test}")

    for split_name, pairs in final.items():
        write_split(pairs, split_name)
    write_data_yaml()
    report_class_balance(final)
    print("\nDone. Unified dataset at:", OUTPUT_DIR.resolve())
    print("Next: run dedupe_check.py to check for cross-split image leakage "
          "before training.")


if __name__ == "__main__":
    main()
