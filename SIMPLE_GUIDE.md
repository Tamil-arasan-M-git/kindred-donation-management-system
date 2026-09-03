# Simple Guide — What Each File Does

Think of this whole project as a factory line with 7 stations. Each file is one
station. Nothing here needs deep Python knowledge — this explains *what*
each piece does and *why it exists*, not the syntax.

```
STAGE 1: Get your raw photos ready to train with
STAGE 2: Train the model
STAGE 3: Use the trained model live
```

---

## STAGE 1 — Getting data ready

### `target_classes.py` — "the answer key"
The simplest file. It just lists your 6 final categories in a fixed order:
`clothing, food, books, electronics, furniture, utensils`.

Why it matters: every other file needs to agree on this exact same list, in
the exact same order — otherwise "class number 3" might mean "electronics"
in one file and "furniture" in another. This file exists so there's only
ONE place that list is written down, and everyone else copies from it.

### `dataset_discovery.py` — "the universal file reader"
Different datasets store their labels in different ways (some use `.txt`
files, some use one big `.json` file, some use `.xml` files, some don't
have labels at all — just folders named after each class).

This file's job: look at a folder, figure out *which* of those formats it
is, read it, and hand back a simple, identical-looking list no matter what
the original format was: *"this image has a book at this position, this
confidence"* — always in the same shape.

**Its functions, in plain terms:**
- `detect_format()` — peeks inside a folder and guesses: "this looks like
  a COCO dataset" / "this looks like YOLO" / etc.
- `parse_yolo()`, `parse_coco()`, `parse_voc()`, `parse_folder()` — one
  function per format, each one knows how to read that specific style and
  convert it into the same common shape.
- `discover_source()` — the "front door." You call this one function, it
  figures out the format and calls the right parser for you.

You never need to know which parser ran — you just get a clean, uniform
answer back.

### `prepare_dataset.py` — "the sorting and merging station"
This is where all your different datasets get combined into ONE clean
dataset the training script can actually use.

**What it does, step by step:**
1. Asks `dataset_discovery.py` to read every dataset you point it at.
2. Each dataset probably uses its own words for things — one might say
   "shirt", another says "trouser", another says "t-shirt". This script
   uses a lookup table (`LABEL_MAP`) you fill in, translating all of those
   down to just `"clothing"` (one of your 6 final categories).
3. If a dataset already came with train/val/test folders, it trusts that
   split. If not, it shuffles those images randomly and splits them itself.
4. Copies everything into one tidy final folder (`dataset_unified/`) with
   the images and their translated labels, ready for training.

Think of it like sorting a huge pile of mixed donations into 6 labeled
boxes, no matter what bag or container each item originally arrived in.

### `pseudo_label.py` — "the shortcut labeler"
Manually drawing a box around every item in every photo is slow. This file
is a shortcut for 5 of your 6 categories (not clothing — more on that below).

**What it does:**
1. Loads a version of YOLO that's *already* pretrained by other people on
   millions of general photos — it already knows things like "laptop",
   "chair", "book", "cup", "banana" (but it does NOT know your specific
   categories like "electronics").
2. Runs that pretrained model over your raw, unlabeled photos.
3. Translates its answers: if it says "laptop", this script relabels that
   as "electronics" (your category). If it says "banana", relabels as "food".
4. Saves those as draft labels, plus a spreadsheet (`review_report.csv`)
   flagging anything it wasn't very sure about, so you can double check.

This only works for electronics/furniture/utensils/books/food, because the
pretrained model happens to already recognize things in those categories.
It has never seen "clothing" as a concept, so it can't help there — that's
why your separate clothing dataset has to be labeled a different way (by
you, or whoever labeled it already).

---

## STAGE 2 — Training

### `train.py` — "the actual learning step"
This is where the model *learns*. Everything before this was just getting
clean data ready; this file is what actually teaches the AI.

**What it does:**
1. Starts from that same pretrained model (it already knows general shapes,
   edges, textures — no need to teach it from absolute zero).
2. Shows it your `dataset_unified/` photos, one batch at a time, many times
   over (each full pass through all the photos is called an "epoch").
3. Each time, it checks how wrong its guesses were and nudges itself to be
   less wrong next time.
4. Randomly tweaks each photo slightly during training (a bit brighter, a
   bit rotated, flipped) so the model doesn't get overly picky about exact
   lighting/angle — this is called "augmentation."
5. At the end, saves the trained model as a file called `best.pt`, and
   prints how accurate it got on each of your 6 categories separately.

This is the slowest step (can take hours), and it's the only step that
actually changes what the model knows.

---

## STAGE 3 — Using the trained model live

### `inference_pipeline.py` — "the detective"
Once you have a trained model (`best.pt`), this file is what actually asks
it "what's in this photo?" and cleans up the answer.

**What it does:**
1. Loads your trained model once (so it's ready to answer quickly).
2. Given one photo, asks the model to find every item and draw a box
   around it, with a confidence score for each guess.
3. Groups those boxes by category — e.g. if it found 3 separate "book"
   boxes, it counts that as "3 books" (this is the quantity estimate).
4. Flags any category where its average confidence was low, so the app can
   visually nudge the donor to double-check that item.
5. Hands back a clean, simple list: `[{class: "books", quantity: 3,
   confidence: 0.81}, ...]`.

### `main.py` — "the receptionist"
This is the actual web server — the thing your camera-capture frontend
talks to.

**What it does:**
1. When the server starts up, it loads the trained model once (loading it
   fresh for every single photo would be way too slow).
2. Waits for photos to be uploaded to it (from the browser).
3. For each photo that arrives: checks it's actually a valid image, hands
   it to `inference_pipeline.py` to get the detected items, and sends that
   list back as the response.
4. Has a simple `/health` check endpoint too, just to confirm "yes, I'm
   running and the model is loaded" — handy when you're debugging.

---

## The one-sentence version of everything

> Collect messy datasets → make them all speak the same format
> (`dataset_discovery.py`) → translate their labels down to your 6
> categories and merge them (`prepare_dataset.py`, with a pretrained-model
> shortcut for 5 of the 6 via `pseudo_label.py`) → teach a fresh model on
> that clean data (`train.py`) → use that trained model to answer "what's
> in this photo?" (`inference_pipeline.py`) → expose that as a web
> endpoint your camera app can call (`main.py`).
