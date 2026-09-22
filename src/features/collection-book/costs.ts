import raw from './cost-rules.json'
import type { BookItem } from './types'
export type Costs = Record<string, number>
type Edge = { to: string; cost: Costs }
type Rule = { tier: number; xp: string; next: Edge[] }
export type CostRules = { rules: Record<string, Rule>; levelCosts: Record<string, number[]> }
export const costRules: CostRules = raw
const reverseCache = new WeakMap<CostRules, Map<string, (Edge & {from:string})[]>>()
function predecessors(rules: CostRules) {
  let map=reverseCache.get(rules)
  if(!map){map=new Map();for(const [from,r] of Object.entries(rules.rules))for(const e of r.next){const entries=map.get(e.to)??[];entries.push({...e,from});map.set(e.to,entries)}reverseCache.set(rules,map)}
  return map
}
function add(target: Costs, amounts: Costs) {
  for (const [id, amount] of Object.entries(amounts)) target[id] = (target[id] ?? 0) + amount
}
function levels(rule: Rule, template: string, from: number, to: number, rules: CostRules): Costs {
  const curve = rules.levelCosts[rule.xp]
  if (!curve || from < 1 || to > 50 || from > to || !Number.isInteger(from)) throw new Error('Missing level costs')
  return { [template.startsWith('schematic:') ? 'accountresource:schematicxp' : 'accountresource:peoplexp']: curve.slice(from-1,to-1).reduce((a,b)=>a+b,0) }
}
export function itemCosts(item: BookItem, path: 'ore'|'crystal', rules: CostRules = costRules) {
  const id = item.templateId.toLowerCase(), current = rules.rules[id]
  if (!current) throw new Error('Unknown item definition')
  const invested: Costs = levels(current,id,1,Math.min(50,item.level),rules)
  let ancestor = id
  let investedKnown = true
  const seen = new Set<string>()
  while (rules.rules[ancestor].tier > 1) {
    if (seen.has(ancestor)) throw new Error('Evolution cycle')
    seen.add(ancestor)
    const parents = (predecessors(rules).get(ancestor)??[]).filter(e=>rules.rules[e.from].tier===rules.rules[ancestor].tier-1)
    if (!parents.length) {investedKnown=false;break}
    const canonical = (c: Costs) => JSON.stringify(Object.entries(c).sort(([a],[b])=>a.localeCompare(b)))
    if (parents.some(p=>canonical(p.cost)!==canonical(parents[0].cost))) {investedKnown=false;break}
    add(invested,parents[0].cost); ancestor=parents[0].from
  }
  const remaining: Costs = {}
  let nextId=id, level=Math.min(item.level,50), choices=false
  seen.clear()
  for (;;) {
    if (seen.has(nextId)) throw new Error('Evolution cycle')
    seen.add(nextId)
    const rule=rules.rules[nextId]
    if(!rule)throw new Error('Missing next evolution definition')
    const cap=Math.min(rule.tier*10,50)
    if(level>cap)throw new Error('Unexpected item level')
    add(remaining,levels(rule,nextId,level,cap,rules));level=cap
    if(!rule.next.length||cap===50)break
    choices ||= rule.next.length>1
    const edge=rule.next.find(e=>e.to.includes('_'+path+'_'))??rule.next[0]
    if(!rules.rules[edge.to]||rules.rules[edge.to].tier!==rule.tier+1)throw new Error('Invalid evolution path')
    add(remaining,edge.cost);nextId=edge.to
  }
  return {invested:investedKnown?invested:null,remaining,maxLevel:level,needsUpgrade:Object.values(remaining).some(n=>n>0),choices}
}
export function bookCosts(items: BookItem[], path: 'ore'|'crystal') {
  const invested: Costs={},remaining: Costs={},unknown: string[]=[]
  const unknownInvested: string[]=[], upgradeIds: string[]=[]
  let upgrades=0,choices=0
  for(const item of items) {
    try {const c=itemCosts(item,path);if(c.invested)add(invested,c.invested);else unknownInvested.push(item.id);add(remaining,c.remaining);if(c.needsUpgrade){upgrades++;upgradeIds.push(item.id)}if(c.choices)choices++}
    catch {unknown.push(item.id)}
  }
  return {invested,remaining,unknown,unknownInvested,upgradeIds,upgrades,choices,count:items.length}
}
