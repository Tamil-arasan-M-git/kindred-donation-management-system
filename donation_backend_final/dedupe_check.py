"""
dedupe_check.py

Checks for near-duplicate images ACROSS splits in your unified dataset —
the most dangerous kind of duplicate, because if the same (or a near-
identical burst-mode) photo ends up in both train and val, your model can
"memorize" it in training and then look artificially good on validation.
That inflates your reported accuracy without the model actually
generalizing better.

Uses perceptual hashing (not exact byte matching) so it also catches
near-duplicates: same photo re-compressed, slightly cropped, or resized.

Usage:
    python dedupe_check.py --dataset dataset_unified
    python dedupe_check.py --dataset dataset_unified --threshold 8
"""

import argparse
from collections import defaultdict
from pathlib import Path

import imagehash
from PIL import Image

IMG_EXTS = (".jpg", ".jpeg", ".png", ".bmp", ".webp")
DEFAULT_THRESHOLD = 5  # lower = stricter match; 0 = only exact-hash matches


def hash_images(images_dir: Path) -> dict:
    """Return {image_path: perceptual_hash} for every image in a folder."""
    hashes = {}
    for img_path in images_dir.iterdir():
        if img_path.suffix.lower() not in IMG_EXTS:
            continue
        try:
            with Image.open(img_path) as im:
                hashes[img_path] = imagehash.phash(im)
        except Exception as e:
            print(f"  WARNING: could not hash {img_path.name}: {e}")
    return hashes


def find_cross_split_duplicates(dataset_root: Path, threshold: int):
    splits = ["train", "val", "test"]
    split_hashes = {}
    for split in splits:
        img_dir = dataset_root / "images" / split
        if img_dir.exists():
            print(f"Hashing {split} ({len(list(img_dir.iterdir()))} files)...")
            split_hashes[split] = hash_images(img_dir)
        else:
            split_hashes[split] = {}

    # Compare every pair of splits (train-val, train-test, val-test).
    leaks = []
    split_names = [s for s in splits if split_hashes[s]]
    for i, split_a in enumerate(split_names):
        for split_b in split_names[i + 1:]:
            for path_a, hash_a in split_hashes[split_a].items():
                for path_b, hash_b in split_hashes[split_b].items():
                    distance = hash_a - hash_b  # Hamming distance between hashes
                    if distance <= threshold:
                        leaks.append((split_a, path_a.name, split_b, path_b.name, distance))
    return leaks


def find_within_split_duplicates(dataset_root: Path, threshold: int):
    """Bonus check: duplicates WITHIN the same split just waste training
    time/skew class balance, less dangerous than cross-split leakage but
    still worth flagging."""
    dupes = []
    for split in ["train", "val", "test"]:
        img_dir = dataset_root / "images" / split
        if not img_dir.exists():
            continue
        hashes = hash_images(img_dir)
        items = list(hashes.items())
        for i in range(len(items)):
            for j in range(i + 1, len(items)):
                path_a, hash_a = items[i]
                path_b, hash_b = items[j]
                if (hash_a - hash_b) <= threshold:
                    dupes.append((split, path_a.name, path_b.name, hash_a - hash_b))
    return dupes


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", default="dataset_unified")
    parser.add_argument("--threshold", type=int, default=DEFAULT_THRESHOLD,
                         help="max hash distance to count as a duplicate (0=exact, higher=looser)")
    parser.add_argument("--skip-within-split", action="store_true",
                         help="only check cross-split leakage, skip the slower within-split check")
    args = parser.parse_args()

    dataset_root = Path(args.dataset)
    print(f"Checking {dataset_root} for near-duplicates (threshold={args.threshold})\n")

    leaks = find_cross_split_duplicates(dataset_root, args.threshold)
    print(f"\n{'='*60}")
    if leaks:
        print(f"CROSS-SPLIT LEAKAGE FOUND: {len(leaks)} pair(s) — FIX THESE FIRST")
        print("(same/near-identical image appears in two different splits)\n")
        for split_a, name_a, split_b, name_b, dist in leaks[:50]:
            print(f"  [{split_a}] {name_a}  <->  [{split_b}] {name_b}  (distance={dist})")
        if len(leaks) > 50:
            print(f"  ... and {len(leaks) - 50} more")
        print("\nFix: remove one copy of each pair (usually keep the train copy, "
              "drop the val/test copy) so no image is evaluated on after being trained on.")
    else:
        print("No cross-split leakage found.")

    if not args.skip_within_split:
        print(f"\n{'='*60}")
        within = find_within_split_duplicates(dataset_root, args.threshold)
        if within:
            print(f"Within-split duplicates found: {len(within)} pair(s) (lower priority)")
            for split, a, b, dist in within[:20]:
                print(f"  [{split}] {a}  <->  {b}  (distance={dist})")
            if len(within) > 20:
                print(f"  ... and {len(within) - 20} more")
        else:
            print("No within-split duplicates found.")


if __name__ == "__main__":
    main()
