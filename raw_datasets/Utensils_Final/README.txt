# Utensils Final Dataset

A filtered object-detection dataset for the five required utensil classes.

Classes:
0 bottle
1 bowl
2 cup
3 fork
4 spoon

Structure:
train/images, train/labels
valid/images, valid/labels
test/images, test/labels

Source:
Household Computer Vision Dataset, Roboflow, version 1
https://universe.roboflow.com/yolov5-epx0y/household-uhdlf/dataset/1
License: CC BY 4.0

Preprocessing:
- Retained only images containing at least one of the five required classes.
- Removed annotations for unrelated classes.
- Remapped class IDs to 0-4 above.
- The source export contained a mix of YOLO bounding boxes and polygon-style annotations;
  polygon annotations were converted to their enclosing bounding boxes so this package
  uses standard YOLO object-detection labels.
- Re-created an approximately 80/10/10 split because the source test split contained
  only two images.
