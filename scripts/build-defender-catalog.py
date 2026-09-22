"""Build public game metadata only. Usage: python scripts/build-defender-catalog.py <extraction-dir>"""
import json, sys
from pathlib import Path
base=Path(sys.argv[1])
def load(p): return json.loads(p.read_text(encoding='utf-8-sig'))
perks={}
for p in load(base/'defender-perks.json')['perks']:
    short=p['id'].lower().removeprefix('aid_att_def_')
    kind='redundant' if short in ['ammosave','durability'] else 'survival' if short in ['maxhealth','maxshield','shieldregen'] else 'utility' if short=='movespeed' else 'weapon'
    v={'description':p['description'],'kind':kind}
    if short.startswith('weapondamage_') and short.split('_')[-1] in ['axe','club','hammer','sword','spears','scythe']:
        v['subtype']=short.split('_')[-1].replace('spears','spear')
    perks['alteration:'+p['id'].lower()]=v
weapon_perks={}
for f in (base/'weapon-perks').glob('*.json'):
    for o in load(f):
        if o.get('Type')=='FortAlterationItemDefinition':
            weapon_perks['alteration:'+o['Name'].lower()]=o.get('Properties',{}).get('ItemDescription',{}).get('SourceString','')
weapons={}
for f in (base/'all-weapons').glob('WID*.json'):
    o=load(f)[0]; p=o.get('Properties',{})
    name=p.get('ItemName',{}).get('SourceString','').strip()
    if not name or 'bow' in name.lower() or 'storm king' in name.lower():continue
    tags=[t.lower() for d in p.get('DataList',[]) for t in d.get('Tags',[])]
    classes=[]
    for tag,cls in [('assault','Assault'),('pistol','Pistol'),('sniper','Sniper'),('shotgun','Shotgun')]:
        if any(t.startswith('weapon.ranged.'+tag) for t in tags):classes.append(cls)
    if any(t.startswith('weapon.ranged.smg') for t in tags):classes+=['Assault','Pistol']
    subtype=None
    if any(t.startswith('weapon.melee') for t in tags):
        classes=['Melee']
        subtype=next((s for s in ['sword','axe','hammer','spear','scythe'] if any(t.endswith('.'+s) for t in tags)),None)
        if any(t.startswith('weapon.melee.blunt.improvised') for t in tags):subtype='club'
    if not classes:continue
    weapons[o['Name'].lower()]={'name':name,'classes':sorted(set(classes)),'subtype':subtype,'innateAffliction':name=="Dragon's Roar",'source':o['Package']}
recipes=load(base/'all-schematics/CraftingRecipes_New.json')[0]['Rows']
schematics={}
for f in (base/'all-schematics').glob('SID*.json'):
    o=load(f)[0];row=o.get('Properties',{}).get('CraftingRecipe',{}).get('RowName')
    for result in recipes.get(row,{}).get('RecipeResults',[]):
        ident=result.get('ItemPrimaryAssetId',{})
        if ident.get('PrimaryAssetType',{}).get('Name')=='Weapon' and ident.get('PrimaryAssetName','').lower() in weapons:
            schematics['schematic:'+o['Name'].lower()]=weapons[ident['PrimaryAssetName'].lower()]
assert len(perks)==24 and len(schematics)>2000 and len(weapon_perks)>300
out=Path(__file__).resolve().parents[1]/'src/features/defenders/catalog.json'
out.write_text(json.dumps({'build':'42.20-CL-58011042','defenderPerks':perks,'weaponPerks':weapon_perks,'schematics':schematics},separators=(',',':')),encoding='utf-8')
print(f'{len(perks)} defender perks, {len(weapon_perks)} weapon perks, {len(schematics)} schematic definitions; {out.stat().st_size} bytes')
