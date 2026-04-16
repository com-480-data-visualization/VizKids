import pandas as pd
import os

df = pd.read_csv('data/un-general-debates.csv')

output_dir = 'data/speeches'
if not os.path.exists(output_dir):
    os.makedirs(output_dir)

print("Splitting speeches... this may take a moment.")
for index, row in df.iterrows():
    filename = f"{row['country']}_{row['year']}.txt"
    filepath = os.path.join(output_dir, filename)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(str(row['text']))

print(f"Done! Created {len(df)} files in {output_dir}")