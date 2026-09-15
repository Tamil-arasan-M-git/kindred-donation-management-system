"""
train.py

Fine-tunes YOLOv8 nano on the unified 6-class donation-item dataset
produced by prepare_dataset.py.

Usage:
    python train.py
    python train.py --epochs 100 --imgsz 640 --batch 16
"""

import argparse
from ultralytics import YOLO


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default="dataset_unified/data.yaml")
    parser.add_argument("--model", default="yolov8n.pt", help="base checkpoint to fine-tune")
    parser.add_argument("--epochs", type=int, default=80)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=16)
    parser.add_argument("--patience", type=int, default=15, help="early stopping patience")
    parser.add_argument("--project", default="runs/detect")
    parser.add_argument("--name", default="donation_items_yolov8n")
    args = parser.parse_args()

    model = YOLO(args.model)

    model.train(
        data=args.data,
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        patience=args.patience,
        project=args.project,
        name=args.name,
        # Donation photos come from many phone cameras in varied conditions —
        # lean on augmentation rather than assuming clean, consistent inputs.
        hsv_h=0.015, hsv_s=0.6, hsv_v=0.4,
        degrees=5.0, translate=0.1, scale=0.4, shear=2.0,
        fliplr=0.5,
        mosaic=1.0,
    )

    # Validate on the held-out val split and print per-class metrics.
    metrics = model.val(data=args.data)
    print("\nPer-class mAP50-95:")
    for i, name in enumerate(metrics.names.values()):
        try:
            print(f"  {name}: {metrics.box.maps[i]:.3f}")
        except IndexError:
            pass

    # Export a copy convenient for the inference service.
    best_weights = f"{args.project}/{args.name}/weights/best.pt"
    print(f"\nBest weights: {best_weights}")
    print("Copy/point this path into inference_pipeline.py's MODEL_PATH.")


if __name__ == "__main__":
    main()
