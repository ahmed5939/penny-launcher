import json, pathlib, re
root = pathlib.Path(__file__).resolve().parents[1]
fragment = pathlib.Path(r'C:\Users\James\.codex\visualizations\2026\09\19\01a0b763-1a87-7df0-8f4e-9e569c927f7a\collection-book-grouped.html').read_text(encoding='utf-8')
book = json.loads(re.search(r'id="cb-catalog">(.*?)</script>', fragment)[1])
defs = json.loads((root.parent / 'exports/collection-book-current/raw/CollectionBookSlots.json').read_text(encoding='utf-8'))[0]['Rows']
templates = {}
for file in ['item-art.json', 'hero-art.json', 'worker-art.json']:
    templates.update({k.split(':')[-1].lower(): k for k in json.loads((root / '.preview' / file).read_text(encoding='utf-8'))})
for cat in book:
    for page in cat['pages']:
        for section in page['sections']:
            for slot in section['slots']:
                definition = defs[slot['id'].split('|')[-1]]
                for key in list(slot):
                    if key not in ['id', 'name', 'rarity']: del slot[key]
                slot['allowed'] = [x['AssetPathName'].split('.')[-1].lower() for x in definition['AllowedItems']]
                slot['personalities'] = [x['TagName'].lower() for x in definition.get('AllowedWorkerPersonalities', [])]
                slot['templateId'] = next((templates[t] for t in slot['allowed'] if t in templates), '')
(root / 'src/features/collection-book/catalog.json').write_text(json.dumps(book, separators=(',', ':')), encoding='utf-8')
print('Generated public slot definitions without any account data.')
