import json, pathlib
root = pathlib.Path(__file__).resolve().parents[1]
rules = {}
for name in ['hero-art', 'schematic-definitions', 'worker-definitions', 'defender-definitions']:
    data = json.loads((root / '.preview' / (name + '.json')).read_text(encoding='utf-8'))
    for tid, d in data.items():
        if not d.get('LevelToXPRow') or not d.get('Tier'): continue
        edges = []
        for key in ['TierUpRecipe', 'AlternateTierUpRecipe']:
            recipe = d.get(key) or {}
            if recipe.get('Result'):
                edges.append({'to': recipe['Result'].lower(), 'cost': {k.lower(): v for k, v in recipe.get('Cost', {}).items()}})
        rules[tid.lower()] = {'tier': d['Tier'], 'xp': d['LevelToXPRow'], 'next': edges}
xp = json.loads((root / '.preview/item-levels-xp.json').read_text(encoding='utf-8'))
# Published cumulative sacrifice XP includes a base item value. Differences
# remove that base and give precisely the cost of each ordinary level-up.
costs = {row: [values[i+1] - values[i] for i in range(49)] for row, values in xp.items()}
local = json.loads((root.parent / 'exports/upgrade_data_game/XPAccountItemLevels.json').read_text(encoding='utf-8'))[0]['Rows']
for row, values in costs.items():
    assert values == [round(local[row]['Keys'][0]['Value'] * level) for level in range(1,50)], row
out = {'source': 'PegLeg game definitions and ItemLevelsToXP; XP increments cross-checked with extracted XPAccountItemLevels', 'rules': rules, 'levelCosts': costs}
(root / 'src/features/collection-book/cost-rules.json').write_text(json.dumps(out,separators=(',',':')),encoding='utf-8')
print(f'{len(rules)} item cost rules; {len(costs)} verified level curves')
