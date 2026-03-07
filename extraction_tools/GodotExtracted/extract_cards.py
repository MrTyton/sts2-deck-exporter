import os
import glob
import re
import pathlib

def unpack_container(data):
    # webp
    start = data.find(bytes.fromhex("52 49 46 46"))
    if start >= 0:
        size = int.from_bytes(data[start + 4:start + 8], byteorder="little")
        return [".webp", data[start:start + 8 + size]]

    # png
    start = data.find(bytes.fromhex("89 50 4E 47 0D 0A 1A 0A"))
    if start >= 0:
        end = data.find(bytes.fromhex("49 45 4E 44 AE 42 60 82")) + 8
        return [".png", data[start:end]]

    # jpg
    start = data.find(bytes.fromhex("FF D8 FF"))
    if start >= 0:
        end = data.find(bytes.fromhex("FF D9")) + 2
        return [".jpg", data[start:end]]
    
    return False

import argparse

parser = argparse.ArgumentParser(description="Extract cards, portraits, and relics from Godot .import files.")
parser.add_argument("--output-dir", type=str, default="../../public/assets", help="Output directory for extracted images")
args = parser.parse_args()

# Resolve to an absolute path based on the script location if it's relative
base_dir = os.path.dirname(os.path.abspath(__file__))
output_dir = os.path.abspath(os.path.join(base_dir, args.output_dir))

os.makedirs(output_dir, exist_ok=True)

import_files = glob.glob('**/*.import', recursive=True)
count = 0

grouped_files = {}

for f in import_files:
    if ('cards' in f.lower() or 'portraits' in f.lower() or 'relics' in f.lower()) and 'png.import' in f.lower():
        is_beta = '\\beta\\' in f.lower() or '/beta/' in f.lower()
        
        orig_name = os.path.basename(f).replace('.import', '')
        base_name = os.path.splitext(orig_name)[0]
        
        if "relics" in f.lower():
            sub_dir = "relics"
        elif "portraits" in f.lower():
            sub_dir = "portraits"
        else:
            sub_dir = "cards"
            
        key = (sub_dir, base_name)
        if key not in grouped_files:
            grouped_files[key] = {'beta': None, 'non_beta': None}
            
        if is_beta:
            grouped_files[key]['beta'] = f
        else:
            grouped_files[key]['non_beta'] = f

for key, files in grouped_files.items():
    f = files['non_beta']
    if f is None:
        f = files['beta']
        
    if f is None:
        continue

    with open(f, 'r') as fp:
        content = fp.read()
    
    path_match = re.search(r'path="res://(.*)"', content)
    if path_match:
        ctex_path = path_match.group(1)
        # handle case sensitivity
        if not os.path.exists(ctex_path):
            print("Missing CTEX:", ctex_path)
            continue
            
        with open(ctex_path, 'rb') as fp:
            ctex_data = fp.read()
        
        unpacked = unpack_container(ctex_data)
        if unpacked:
            ext, data = unpacked
            
            orig_name = os.path.basename(f).replace('.import', '')
            orig_name = os.path.splitext(orig_name)[0] + ext
            sub_dir = key[0]
                
            pathlib.Path(os.path.join(output_dir, sub_dir)).mkdir(parents=True, exist_ok=True)
            out_path = os.path.join(output_dir, sub_dir, orig_name)
            with open(out_path, 'wb') as out_f:
                out_f.write(data)
            count += 1
        else:
            print("Could not unpack:", ctex_path)

print(f"Extracted {count} images to {output_dir}")
