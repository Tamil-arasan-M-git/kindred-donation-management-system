"""
target_classes.py

Single source of truth for the 6 parent donation classes and their order.
Both prepare_dataset.py and pseudo_label.py import from here, so a class's
numeric id is guaranteed to mean the same thing everywhere in the pipeline.
Do not change the order once you've started labeling/training — the id
numbers are baked into every .txt label file already written.
"""

TARGET_CLASSES = ["clothing", "food", "books", "electronics", "furniture", "utensils"]
CLASS_TO_ID = {name: i for i, name in enumerate(TARGET_CLASSES)}
