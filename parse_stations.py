
import json
import re

def parse_stations(filename):
    with open(filename, 'r') as f:
        lines = [l.strip() for l in f.readlines() if l.strip()]

    stations = []
    i = 0
    while i < len(lines):
        name = lines[i]
        sector = lines[i+1]
        i += 2
        
        product_or_type = lines[i]
        i += 1
        
        inventory = {}
        
        if i < len(lines) and lines[i] == 'empty':
             i += 1
        else:
            while i < len(lines):
                item_name = lines[i]
                
                if i + 1 >= len(lines):
                    break
                    
                val_line = lines[i+1]
                
                if val_line.isdigit():
                    amount = int(val_line)
                    inventory[item_name] = amount
                    i += 2
                else:
                    break
        
        stations.append({
            "name": name,
            "sectorId": sector,
            "product": product_or_type, 
            "inventory": inventory
        })
        
    return stations

def to_ts_object(stations):
    def slug(name, idx):
        s = name.lower()
        s = re.sub(r'[^a-z0-9]+', '_', s)
        s = s.strip('_')
        return s or str(idx)

    def pick_recipe_id(name):
        n = name.lower()
        if 'solar power' in n or 'spp' in n: return 'spp_teladi'
        if 'flower' in n: return 'flower_farm'
        if 'dream' in n: return 'dream_farm'
        if 'bliss' in n: return 'bliss_place'
        if 'sun oil' in n or 'oil refinery' in n: return 'sun_oil_refinery'
        if 'teladianium' in n: return 'teladianium_foundry'
        if 'ore mine' in n: return 'ore_mine'
        if 'silicon' in n: return 'silicon_mine'
        if 'crystal' in n: return 'crystal_fab'
        if 'equipment dock' in n or 'trading station' in n: return 'logistics_hub'
        if 'shipyard' in n: return 'shipyard'
        if 'cattle ranch' in n or 'wheat' in n: return 'argon_farm'
        if 'cahoona' in n: return 'cahoona_bakery'
        if 'plankton' in n: return 'plankton_farm'
        if 'bogas' in n: return 'bogas_plant'
        if 'bofu' in n: return 'bofu_lab'
        if 'stott' in n: return 'stott_mixery'
        if 'scruffin' in n: return 'scruffin_farm'
        if 'curffs' in n: return 'scruffin_farm' # Typo handling if needed
        if 'massom' in n: return 'massom_mill'
        if 'rastar' in n: return 'rastar_refinery'
        if 'chelt' in n: return 'chelt_aquarium'
        if 'soyfarm' in n: return 'soyfarm'
        if 'soyery' in n: return 'soyery'
        if 'snail' in n: return 'snail_ranch'
        if 'majaglit' in n: return 'majaglit_factory'
        if 'shield' in n and '5mw' in n.lower(): return 'ire_forge' 
        if 'shield' in n and '25mw' in n.lower(): return 'hept_forge' 
        if 'shield' in n: return 'shield_plant' # Generic fallback?
        if 'quantum' in n: return 'quantum_tube_fab'
        if 'chip' in n: return 'chip_plant'
        if 'computer' in n: return 'computer_plant'
        if 'hept' in n: return 'hept_forge' 
        if 'ire' in n or 'laser' in n: return 'ire_forge'
        return 'logistics_hub'

    def map_ware_name(name):
        name_map = {
            'Energy Cells': 'energy_cells',
            'Crystals': 'crystals',
            'Sunrise Flowers Oil': 'sun_oil',
            'Sunrise Flowers': 'sunrise_flowers',
            'Teladianium': 'teladianium',
            'Ore': 'ore',
            'Space Weed': 'space_weed',
            'Space Fuel': 'space_fuel',
            'Silicon Wafers': 'silicon_wafers',
            'IRE Laser': 'ire_laser',
            'Plankton': 'plankton',
            'BoGas': 'bogas',
            'BoFu': 'bofu',
            'Wheat': 'wheat',
            'Meatsteak Cahoonas': 'cahoonas',
            'Scruffin Fruit': 'scruffin_fruit',
            'Rastar Oil': 'rastar_oil',
            'Quantum Tubes': 'quantum_tubes',
            'Microchips': 'microchips',
            'Computer Components': 'computer_components',
            'HEPT Laser': 'hept_laser',
            'PAC Laser': 'pac_laser',
            'Ship Parts': 'ship_parts',
            'Trade Goods': 'trade_goods',
            'Stott Spices': 'stott_spices',
            'Soya Beans': 'soya_beans',
            'Soya Husk': 'soya_husk',
            'Maja Snails': 'maja_snails',
            'Majaglit': 'majaglit',
            'Massom Powder': 'massom_powder',
            'Chelt Meat': 'chelt_meat',
        }
        return name_map.get(name, name.lower().replace(' ', '_'))

    ts_output = "export const CUSTOM_STATIONS = [\n"
    
    seen_ids = {}
    
    for st in stations:
        base_slug = slug(st['name'], 0)
        s_id = f"{st['sectorId']}_{base_slug}"
        
        if s_id in seen_ids:
            seen_ids[s_id] += 1
            s_id = f"{s_id}_{seen_ids[s_id]}"
        else:
            seen_ids[s_id] = 1
            
        inv_str = ", ".join([f"{map_ware_name(k)}: {v}" for k,v in st['inventory'].items()])
        rid = pick_recipe_id(st['name'])
        
        ts_output += "  {\n"
        ts_output += f"    id: '{s_id}',\n"
        ts_output += f"    name: '{st['name']}',\n"
        ts_output += f"    recipeId: '{rid}',\n"
        ts_output += f"    sectorId: '{st['sectorId']}',\n"
        ts_output += f"    inventory: {{ {inv_str} }},\n"
        ts_output += "    reorderLevel: {},\n"
        ts_output += "    reserveLevel: {}\n"
        ts_output += "  },\n"

    ts_output += "];\n"
    return ts_output

data = parse_stations('d:/xbtf-rtx/station_data.txt')
content = to_ts_object(data)
with open('d:/xbtf-rtx/src/config/stations_custom.ts', 'w') as f:
    f.write(content)
print("Wrote to d:/xbtf-rtx/src/config/stations_custom.ts")
