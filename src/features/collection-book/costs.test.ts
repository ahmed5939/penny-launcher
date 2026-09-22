import { describe, expect, it } from 'vitest'
import { itemCosts } from './costs'
import type { CostRules } from './costs'
import type { BookItem } from './types'
const xp='accountresource:schematicxp', rain='accountresource:reagent_c_t01'
const base: BookItem={id:'item',templateId:'schematic:one',level:5,portrait:null,personality:null,teamBonus:null,alterations:[]}
const rules:CostRules={levelCosts:{row:Array.from({length:49},(_,i)=>(i+1)*100)},rules:{
  'schematic:one':{tier:1,xp:'row',next:[{to:'schematic:two',cost:{[rain]:10,[xp]:500}}]},
  'schematic:two':{tier:2,xp:'row',next:[]},
}}
describe('collection book resource costs',()=>{
  it('adds remaining levels and evolution costs without counting base item value',()=>{
    const c=itemCosts(base,'ore',rules)
    expect(c.invested?.[xp]).toBe(1000)
    expect(c.remaining[xp]).toBe(18500)
    expect(c.remaining[rain]).toBe(10)
    expect(c.maxLevel).toBe(20)
  })
  it('includes previous evolutions in invested, not remaining',()=>{
    const c=itemCosts({...base,templateId:'schematic:two',level:20},'ore',rules)
    expect(c.invested).toEqual({[xp]:19500,[rain]:10})
    expect(c.needsUpgrade).toBe(false)
  })
  it('keeps known remaining costs when a previous evolution is missing',()=>{
    const c=itemCosts({...base,templateId:'schematic:two',level:19},'ore',{...rules,rules:{'schematic:two':rules.rules['schematic:two']}})
    expect(c.invested).toBeNull()
    expect(c.remaining[xp]).toBe(1900)
  })
  it('stops at fifty even if the item has been supercharged',()=>{
    const c=itemCosts({...base,templateId:'schematic:five',level:60},'crystal',{...rules,rules:{'schematic:five':{tier:5,xp:'row',next:[]}}})
    expect(c.maxLevel).toBe(50)
    expect(c.needsUpgrade).toBe(false)
  })
  it('chooses crystal only at an unresolved branch, preserving evolved paths',()=>{
    const branches:CostRules={...rules,rules:{
      'schematic:three':{tier:3,xp:'row',next:[{to:'schematic:a_ore_t04',cost:{[rain]:30}},{to:'schematic:a_crystal_t04',cost:{[rain]:40}}]},
      'schematic:a_ore_t04':{tier:4,xp:'row',next:[]},
      'schematic:a_crystal_t04':{tier:4,xp:'row',next:[]},
    }}
    expect(itemCosts({...base,templateId:'schematic:three',level:30},'crystal',branches).remaining[rain]).toBe(40)
    expect(itemCosts({...base,templateId:'schematic:a_ore_t04',level:40},'crystal',branches).needsUpgrade).toBe(false)
  })
})
