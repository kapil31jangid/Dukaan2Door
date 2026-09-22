import subprocess
import sys

from dataset_sources import DATASETS


def main() -> None:
    for dataset in DATASETS.values():
        dataset["raw_dir"].mkdir(parents=True, exist_ok=True)
        cmd = [
            sys.executable,
            "-m",
            "kaggle",
            "datasets",
            "download",
            dataset["handle"],
            "-p",
            str(dataset["raw_dir"]),
            "--unzip",
        ]
        print(f"Downloading {dataset['handle']} -> {dataset['raw_dir']}")
        subprocess.run(cmd, check=True)


if __name__ == "__main__":
    main()
