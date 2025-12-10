
import json

def parse_stations(filename):
    with open(filename, 'r') as f:
        lines = [l.strip() for l in f.readlines() if l.strip()]

    stations = []
    i = 0
    while i < len(lines):
        name = lines[i]
        sector = lines[i+1]
        i += 2
        
        # Product line (sometimes it might be missing or implict? No, based on the pattern it's there)
        # But wait, looking at data:
        # Solar Power Plant (b)
        # seizewell
        # Energy Cells <-- This is likely the product? Or just first inventory item?
        # Energy Cells
        # 500
        
        # Boron Shipyard
        # kingdom_end
        # Ship Parts <-- Product?
        # empty
        
        # Solar Power Plant (M)
        # kingdom_end
        # Energy Cells
        # empty
        
        # It seems line 3 is ALWAYS the product (or main type).
        product_or_type = lines[i]
        i += 1
        
        inventory = {}
        
        # Next lines are inventory key-val pairs until we hit a station name or EOF
        # How to distinguish a station name from an inventory item?
        # Station names usually have (M), (L), (alpha) etc or are capitalized.
        # Inventory items are also strings.
        # Inventory amounts are numbers.
        
        # Let's peek ahead.
        # If the line is "empty", then inventory is empty.
        
        if i < len(lines) and lines[i] == 'empty':
             i += 1
             # Done with this station
        else:
            # Parse inventory
            while i < len(lines):
                item_name = lines[i]
                
                # Check if this line is actually the start of a new station.
                # Heuristic: verify if the NEXT line is a valid sector ID?
                # or if the line AFTER that is a product?
                # Actually, inventory items are followed by a number.
                # If 'item_name' is followed by a number, it's an inventory item.
                # If 'item_name' is followed by a string, it COULD be a station name (start of new block).
                
                if i + 1 >= len(lines):
                    break # Should not happen if well formed
                    
                val_line = lines[i+1]
                
                if val_line.isdigit():
                    amount = int(val_line)
                    inventory[item_name] = amount
                    i += 2
                else:
                    # It's not a number, so the previous 'item_name' was likely the name of the NEXT station
                    # We need to backtrack or just break
                    break
        
        stations.append({
            "name": name,
            "sectorId": sector,
            "product": product_or_type, # We might not need this for the config if we lookup by name, but good to have
            "inventory": inventory
        })
        
    return stations

def to_ts_object(stations):
    # We want to format this as a TS object.
    # actually, we want to generate the specific array entries for vite.config.ts
    
    # We need to slugify name + sector to create ID, similar to existing code.
    # const slug = (name: string, fallback: string) => {
    #   const s = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    #   return s || fallback
    # }
    
    import re
    def slug(name, idx):
        s = name.lower()
        s = re.sub(r'[^a-z0-9]+', '_', s)
        s = s.strip('_')
        return s or str(idx)

    # We also need to pick recipe ID based on name, mirroring the code.
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
        if 'scruffin' in n: return 'scruffin_farm'
        if 'rastar' in n: return 'rastar_refinery'
        if 'quantum' in n: return 'quantum_tube_fab'
        if 'chip' in n: return 'chip_plant'
        if 'computer' in n: return 'computer_plant'
        if 'shield' in n: return 'hept_forge'
        if 'ire' in n or 'laser' in n: return 'ire_forge'
        if 'massom' in n: return 'scruffin_farm' # approximate? wait massom mill produces massom powder from scruffin. need to check recipes.
        # Massom Mill is not in the recipes list in vite.config.ts!
        # Wait, lines 386-389: Scruffin Farm produces Scruffin Fruit. Rastar Winery produces Rastar Oil.
        # Massom Mill: usually Scruffin -> Massom Powder.
        # If Massom Mill is missing, we should probably add it or map to something else.
        # For now, let's map to 'scruffin_farm' or 'logistics_hub' if unknown.
        # Actually existing code has 'scruffin_farm' and 'rastar_refinery'.
        # Let's map Massom to 'scruffin_farm' (as placeholder) or leave as logistics.
        
        # CHELT Aquarium -> Chelt Meat. 
        # Rastar Refinery -> Chelt Meat -> Rastar Oil.
        
        # Soyfarm -> Soya Beans.
        # Soyery -> Soya Husk.
        
        # Snail Ranch -> Maja Snails.
        # Majaglit -> Space Jewellery.
        
        # If the user list has stations NOT in recipes, we might have issues.
        # But we can default to 'logistics_hub' (Trade Goods) if unsure.
        
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
        }
        return name_map.get(name, name.lower().replace(' ', '_'))

    ts_output = "export const CUSTOM_STATIONS = [\n"
    
    # We also need to be careful about ID collisions.
    # The current code uses `${sector.id}_${slug(st.name, String(idx))}`
    # We should try to match that or force IDs.
    
    seen_ids = {}
    
    for st in stations:
        # Generate ID
        # Note: In the existing code, ids are generated based on index in sector layout usually.
        # But here we are defining them manually.
        # Let's assume we can use a deterministic ID based on name.
        
        base_slug = slug(st['name'], 0)
        s_id = f"{st['sectorId']}_{base_slug}"
        
        if s_id in seen_ids:
            seen_ids[s_id] += 1
            s_id = f"{s_id}_{seen_ids[s_id]}"
        else:
            seen_ids[s_id] = 1
            
        # Inventory string
        inv_str = ", ".join([f"{map_ware_name(k)}: {v}" for k,v in st['inventory'].items()])
        
        # Recipe ID
        # We can try to infer it, but maybe we should just output the data structure and let the loop handle it?
        # No, the goal is to replace the manual list in vite.config.ts
        
        # Let's format exactly like the `stations` array entries.
        # { id: 'sz_spp_b', name: 'Solar Power Plant (b)', recipeId: 'spp_teladi', sectorId: 'seizewell', inventory: { energy_cells: 500, crystals: 20 }, reorderLevel: { crystals: 40 }, reserveLevel: { energy_cells: 150 } },
        
        # We don't have reorder/reserve levels in the input.
        # We might need to guess them?
        # Or just leave them empty.
        
        # For Recipe ID, we use the helper logic (which we should duplicate in TS or Python)
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

