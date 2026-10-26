from guizero import App, Text, PushButton, Drawing, Box
import math
import random
import os
import subprocess
import time

# one death sound per enemy type
KILL_SOUNDS = {
    "normal": "/System/Library/Sounds/Pop.aiff",
    "tough": "/System/Library/Sounds/Bottle.aiff",
    "boss": "/System/Library/Sounds/Hero.aiff",
    "megaboss": "/System/Library/Sounds/Submarine.aiff",
    "giant": "/System/Library/Sounds/Funk.aiff",
}

WIDTH = 600
HEIGHT = 400
CASTLE_X = WIDTH - 60

BOSS_HEALTH = 12
BOSS_WAVE = 5        # every 5th wave ends with an armored car
MEGA_BOSS_WAVE = 2      # every 2nd wave ends with the giant heavy tank
MEGA_BOSS_HEALTH = 60
MEGA_BOSS_DAMAGE = 10   # castle health lost if the heavy tank gets through (a third of the castle!)
GIANT_BOSS_WAVE = 3     # every 3rd wave ends with the giant boss tank
GIANT_BOSS_HEALTH = 90000
GIANT_BOSS_DAMAGE = 30  # castle health lost if the giant boss gets through (the whole castle!)
# enemies shoot back at your soldiers:
# damage per shot, ticks between shots, how far they can shoot, shot speed, shot size and color
ENEMY_GUNS = {
    "normal":   {"damage": 1, "reload": 40, "range": 220, "speed": 14, "size": 2, "color": "yellow"},
    "tough":    {"damage": 2, "reload": 40, "range": 220, "speed": 14, "size": 2, "color": "orange"},
    "boss":     {"damage": 6, "reload": 50, "range": 350, "speed": 11, "size": 4, "color": "orange"},
    "megaboss": {"damage": 15, "reload": 60, "range": 450, "speed": 10, "size": 5, "color": "orangered"},
    # each giant boss shell takes 150,000 health, so 6 hits destroy a mech
    "giant":    {"damage": 150000, "reload": 60, "range": 2000, "speed": 10, "size": 6, "color": "red"},
}
CASTLE_HEALTH = 30      # the castle starts with 30 health

BOSS_DAMAGE = 5      # castle health lost if an armored car gets through

SLOW_FACTOR = 0.4    # enemies in tear gas move at 40% of their normal speed
POISON_TICK = 20     # a poisoned enemy loses 1 health every 20 ticks (1 second)

CLOUD_EVERY = 400    # a gas grenadier launches a big cloud every 400 ticks (20 seconds)
CLOUD_LIFE = 100     # a big cloud stays for 100 ticks (5 seconds)
CLOUD_RADIUS = 90    # how big the big cloud is
CLOUD_POISON = 30    # poison time given to enemies inside a toxic cloud

# real physics: everything that flies is pulled down by gravity
GRAVITY = 0.25       # pixels per tick, added to the falling speed every tick
CORPSE_LIFE = 160    # a fallen enemy lies on the ground for 8 seconds
STUCK_LIFE = 120     # an arrow stuck in the ground stays for 6 seconds

MAX_SOLDIERS = 10    # you can have at most 10 soldiers at once
UPGRADE_COST = 20    # each weapon upgrade costs $20...
MAX_WEAPON_LEVEL = 5 # ...and adds +1 damage to every shot, up to level 5
ARMOR_COST = 30      # castle armor costs $30...
ARMOR_PACK = 5       # ...for 5 armor points; each point blocks 1 damage to the castle
MAX_ARMOR = 20
AMMO_PACK = 5        # the ammo button buys 5 sniper bullets...
AMMO_COST = 5        # ...for $5

SKIN = "#e0b48a"
SHADOW = "#3f6e2b"

# Each soldier type has its own stats.
# weapon: "bullet" flies straight and fast, "arrow" and "grenade" are lobbed in an arc,
# "shell" flies straight and explodes. spread is how much the soldier's aim wobbles.
# muzzle is how far the weapon sticks out in front of the soldier's front hand.
SOLDIER_TYPES = {
    "strong": {"health": 30, "name": "Rifleman", "cost": 35, "damage": 2, "reload": 12, "range": 320, "color": "olivedrab",
               "weapon": "bullet", "speed": 26, "spread": 0.02, "muzzle": 22, "shot": "gold"},
    # the ragdoll archer has a floppy, wobbly body and lobs real arrows that can miss
    "archer": {"health": 25, "name": "Archer", "cost": 40, "damage": 3, "reload": 24, "range": 400, "color": "forestgreen",
               "weapon": "arrow", "arc": 0.6, "spread": 0.025, "muzzle": 6, "shot": "saddlebrown"},
    # the gas grenadier lobs a canister that poisons every enemy near where it lands for 100 ticks
    "poison": {"health": 25, "name": "Gas grenadier", "cost": 45, "damage": 0, "poison": 100, "blast": 40, "reload": 25, "range": 300,
               "color": "#c9b02a", "weapon": "grenade", "arc": 0.9, "spread": 0.03, "muzzle": 14, "shot": "chartreuse"},
    # tear gas does no damage: it slows every enemy near where the canister lands for 60 ticks (3 seconds)
    "freezer": {"health": 25, "name": "Tear gas", "cost": 50, "damage": 0, "freeze": 60, "blast": 80, "reload": 20, "range": 300,
                "color": "slategray", "weapon": "grenade", "arc": 0.9, "spread": 0.03, "muzzle": 14, "shot": "white"},
    # the sniper comes with 5 bullets and stops shooting when they run out
    "boss killer": {"health": 20, "name": "Sniper", "cost": 70, "damage": BOSS_HEALTH, "reload": 40, "range": 450, "color": "#3b4a2f",
                    "weapon": "bullet", "speed": 40, "spread": 0.004, "muzzle": 36, "shot": "white", "ammo": 5},
    # the mech is a giant walking robot: its cannon shell takes half of the giant boss's health (2 hits kill it)
    "mech": {"name": "Mech", "cost": 200, "damage": 20, "giant_half": True, "health": 9000, "blast": 50, "reload": 40,
             "range": 520, "color": "#5b6b7a", "weapon": "shell", "speed": 20, "spread": 0.008, "shot": "cyan"},
}

# enemy foot soldiers: (uniform color, helmet color)
ENEMY_LOOK = {
    "normal": ("#6b2b2b", "#3b3b3b"),
    "tough": ("#4a4a4a", "#2b2b2b"),
}

# the title screen lets you pick one of these
DIFFICULTIES = {
    "Easy":   {"castle": 40, "monsters": 0.7, "speed": 0.8, "money": 60},
    "Medium": {"castle": 30, "monsters": 1.0, "speed": 1.0, "money": 0},
    "Hard":   {"castle": 20, "monsters": 1.4, "speed": 1.2, "money": 0},
}
difficulty = DIFFICULTIES["Medium"]
max_castle_health = CASTLE_HEALTH

castle_health = CASTLE_HEALTH
score = 0
money = 0
playing = False
sell_mode = False
delete_mode = False   # like sell mode, but the soldier is just removed with no money back
monster_speed_up = 1   # the Speed button cycles this through 1, 2 and 3
weapon_level = 0       # how many weapon upgrades you have bought this game
castle_armor = 0       # armor points left on the castle
wave = 0
wave_total = 0     # how many enemies this wave has
wave_spawned = 0   # how many have appeared so far
# each enemy is [x, y, health, max_health, speed, slowed_time, poison_time, kind, knockback, walk_step]
monsters = []
soldiers = []      # each soldier is [x, y, reload_time, kind, cloud_time, ragdoll, recoil, ammo (None = never runs out)]
projectiles = []   # bullets, arrows, grenades and shells that are flying right now
enemy_shells = []  # enemy shots flying at your soldiers
clouds = []        # each gas cloud is [x, ground_y, time_left, "toxic" or "tear", radius]
particles = []     # smoke, fire, dust, flashes and flying debris
corpses = []       # fallen enemies (floppy ragdolls) and burning wrecks
coins = []         # coins dropped by dead enemies: click one to turn it into money
stuck = []         # arrows that missed and stuck in the ground

# Positions use the ground: x goes toward the castle, y is how far down the field,
# and z is how high something is above the ground. On screen it is drawn at (x, y - z).

# ragdoll soldiers: every body part is [offset_x, offset_y, speed_x, speed_y] and is
# pulled back to its resting spot by a spring, so the whole body wobbles and flops
RAGDOLL_REST = {
    "head": (-1, -17), "bow_hand": (-18, -4), "string_hand": (-6, -4),
    "left_foot": (-6, 22), "right_foot": (6, 22), "hip": (0, 10),
}
SPRING = 0.22   # how hard a body part is pulled back to its resting spot
DAMPING = 0.12  # how quickly the wobbling dies down

# fallen enemies are real ragdolls: points joined by bones of fixed length, falling under gravity
CORPSE_POINTS = {
    "head": (1, 38), "shoulder": (0, 30), "hip": (0, 17),
    "hand_l": (-7, 19), "hand_r": (9, 24), "foot_l": (-4, 0), "foot_r": (4, 0),
}
CORPSE_BONES = [("head", "shoulder"), ("shoulder", "hip"), ("shoulder", "hand_l"),
                ("shoulder", "hand_r"), ("hip", "foot_l"), ("hip", "foot_r")]

def new_ragdoll():
    return {name: [rx, ry, 0.0, 0.0] for name, (rx, ry) in RAGDOLL_REST.items()}

def update_ragdolls():
    for s in soldiers:
        if s[6] > 0:
            s[6] = s[6] - 1   # the mech's cannon slides back into place
        ragdoll = s[5]
        if ragdoll is None:
            continue
        for name, part in ragdoll.items():
            rx, ry = RAGDOLL_REST[name]
            part[2] += -SPRING * (part[0] - rx) - DAMPING * part[2] + random.uniform(-0.12, 0.12)
            part[3] += -SPRING * (part[1] - ry) - DAMPING * part[3] + random.uniform(-0.12, 0.12) + 0.05   # a bit of gravity
            part[0] += part[2]
            part[1] += part[3]

def kick_ragdoll(ragdoll):
    # shooting makes the soldier recoil: the back hand flies back, the head snaps, the feet hop
    ragdoll["string_hand"][2] += 7
    ragdoll["bow_hand"][2] += 3
    ragdoll["head"][2] += 3
    ragdoll["head"][3] -= 2
    ragdoll["hip"][2] += 2
    ragdoll["left_foot"][3] -= 3
    ragdoll["right_foot"][3] -= 3

def clear_battlefield():
    monsters.clear()
    soldiers.clear()
    projectiles.clear()
    enemy_shells.clear()
    clouds.clear()
    particles.clear()
    corpses.clear()
    coins.clear()
    stuck.clear()

def start_game(level):
    global castle_health, score, money, playing, wave, difficulty, max_castle_health, weapon_level, castle_armor
    difficulty = DIFFICULTIES[level]
    weapon_level = 0
    castle_armor = 0
    upgrade_button.text = "Upgrade weapons ($" + str(UPGRADE_COST) + ")"
    max_castle_health = difficulty["castle"]
    castle_health = max_castle_health
    score = 0
    money = difficulty["money"]
    playing = True
    clear_battlefield()
    wave = 0
    start_wave()
    title_box.visible = False
    if sell_mode:
        toggle_sell_mode()
    if delete_mode:
        toggle_delete_mode()
    update_info()

def reset_game():
    # stop the current game and go back to the title screen
    global playing, weapon_level, castle_armor
    playing = False
    weapon_level = 0
    castle_armor = 0
    upgrade_button.text = "Upgrade weapons ($" + str(UPGRADE_COST) + ")"
    clear_battlefield()
    if sell_mode:
        toggle_sell_mode()
    if delete_mode:
        toggle_delete_mode()
    title_box.visible = True
    info_text.value = "Pick a difficulty to start!"
    money_text.value = "$0"
    draw_all()

def update_info():
    text = "Wave " + str(wave) + "   Score: " + str(score) + "   Castle health: " + str(castle_health)
    text = text + "   Soldiers: " + str(len(soldiers)) + "/" + str(MAX_SOLDIERS)
    text = text + "   Weapons Lv " + str(weapon_level)
    text = text + "   Armor: " + str(castle_armor)
    for m in monsters:
        if is_giant(m):
            text = text + "   GIANT BOSS " + str(m[2]) + "/" + str(m[3]) + "!!!!"
            break
        if is_mega(m):
            text = text + "   HEAVY TANK!!!"
            break
        if is_boss(m):
            text = text + "   ARMORED CAR!"
            break
    info_text.value = text
    money_text.value = "$" + str(money)

def is_mega(m):
    return m[7] == "megaboss"

def is_giant(m):
    return m[7] == "giant"

def is_boss(m):
    return m[7] == "boss" or is_mega(m) or is_giant(m)

def is_tough(m):
    return m[7] == "tough"

def monster_size(m):
    if is_giant(m):
        return 150
    if is_mega(m):
        return 100
    if is_boss(m):
        return 55
    if is_tough(m):
        return 30
    return 20

def monster_height(m):
    return {"normal": 38, "tough": 54, "boss": 64, "megaboss": 104, "giant": 156}[m[7]]

def monster_half_width(m):
    return {"normal": 11, "tough": 16, "boss": 50, "megaboss": 95, "giant": 143}[m[7]]

def ground_y(m):
    # m[1] is the middle of the enemy's body, so its feet are half its height lower
    return m[1] + monster_height(m) / 2

def monster_speed(m):
    speed = m[4] * monster_speed_up
    if m[5] > 0:
        speed = speed * SLOW_FACTOR
    return speed

def buy_soldier(kind):
    global money
    cost = SOLDIER_TYPES[kind]["cost"]
    if playing and len(soldiers) >= MAX_SOLDIERS:
        info_text.value = "Your army is full (" + str(MAX_SOLDIERS) + " soldiers). Sell one to buy another."
        return
    if playing and money >= cost:
        money = money - cost
        y = 30 + (len(soldiers) * 60) % (HEIGHT - 60)
        ragdoll = None if kind == "mech" else new_ragdoll()
        stats = SOLDIER_TYPES[kind]
        soldiers.append([CASTLE_X - 40, y, 0, kind, CLOUD_EVERY, ragdoll, 0, stats.get("ammo"), stats.get("health")])
        update_info()

def buy_upgrade():
    # better weapons: every soldier that does damage does 1 more per shot
    global money, weapon_level
    if playing and weapon_level < MAX_WEAPON_LEVEL and money >= UPGRADE_COST:
        money = money - UPGRADE_COST
        weapon_level = weapon_level + 1
        if weapon_level == MAX_WEAPON_LEVEL:
            upgrade_button.text = "Weapons maxed!"
        update_info()

def buy_armor():
    # steel plates for the castle walls
    global money, castle_armor
    if playing and castle_armor < MAX_ARMOR and money >= ARMOR_COST:
        money = money - ARMOR_COST
        castle_armor = min(castle_armor + ARMOR_PACK, MAX_ARMOR)
        update_info()

def damage_castle(damage):
    # armor soaks up hits before the castle walls do
    global castle_health, castle_armor
    blocked = min(castle_armor, damage)
    castle_armor = castle_armor - blocked
    castle_health = castle_health - (damage - blocked)

def shot_damage(stats):
    if stats["damage"] > 0:
        return stats["damage"] + weapon_level
    return 0

def buy_ammo():
    # 5 more bullets for the sniper who has the fewest left
    global money
    snipers = [s for s in soldiers if s[7] is not None]
    if playing and snipers and money >= AMMO_COST:
        money = money - AMMO_COST
        neediest = min(snipers, key=lambda s: s[7])
        neediest[7] = neediest[7] + AMMO_PACK
        update_info()

def start_wave():
    # every wave has more enemies than the one before
    global wave, wave_total, wave_spawned
    wave = wave + 1
    wave_total = round((5 + 3 * wave) * difficulty["monsters"])
    wave_spawned = 0

def add_monster(y, health, speed, kind):
    # then the enemy's reload timer, random so they do not all shoot at once, and the coins it has picked up
    monsters.append([0, y, health, health, speed, 0, 0, kind, 0.0, random.uniform(0, 6), random.randint(10, ENEMY_GUNS[kind]["reload"]), []])

def spawn_monster():
    # runs once per second
    global wave_spawned, money
    if not playing:
        return
    if wave_spawned >= wave_total:
        # wave is fully spawned: once every enemy is dead, get a bonus and the next wave starts right away
        if not monsters:
            money = money + 10 * wave
            start_wave()
            update_info()
        return
    wave_spawned = wave_spawned + 1
    y = random.randint(60, HEIGHT - 60)
    speed = min(3 + 0.25 * (wave - 1), 6) * difficulty["speed"]          # enemies get faster
    tough_chance = min(0.08 * wave, 0.6)            # and more of them are armored
    if wave % GIANT_BOSS_WAVE == 0 and wave_spawned == wave_total:
        # the giant boss is huge and very slow, but almost impossible to destroy
        add_monster(HEIGHT // 2, GIANT_BOSS_HEALTH, 0.4, "giant")
    elif wave % MEGA_BOSS_WAVE == 0 and wave_spawned == wave_total:
        # the heavy tank is so big it drives down the middle of the field
        health = MEGA_BOSS_HEALTH + 10 * (wave // MEGA_BOSS_WAVE - 1)   # later ones are even tougher
        add_monster(HEIGHT // 2, health, 0.8, "megaboss")
    elif wave % BOSS_WAVE == 0 and wave_spawned == wave_total:
        health = BOSS_HEALTH + 4 * (wave // BOSS_WAVE - 1)   # later armored cars have more health
        add_monster(y, health, 1.5 + 0.1 * (wave // BOSS_WAVE), "boss")
    elif random.random() < tough_chance:
        add_monster(y, 2 + (wave - 1) // 2, speed, "tough")
    else:
        add_monster(y, 1 + (wave - 1) // 3, speed, "normal")

def play_sound(path):
    # afplay plays the sound in the background so the game does not freeze
    if os.path.exists(path):
        try:
            subprocess.Popen(["afplay", path])
            print("sound played:", os.path.basename(path))
        except OSError as error:
            print("could not play", path, "-", error)
    else:
        print("sound file missing, using bell:", path)
        app.tk.bell()

def is_alive(m):
    return any(m is other for other in monsters)

def hit_monster(m, damage, push_x=0.0, push_z=0.0):
    # push_x and push_z are how hard the hit shoves the enemy (and its ragdoll if it dies)
    global score
    if not is_alive(m):
        return   # two shots hit at once and the first one already killed it
    m[2] = m[2] - damage
    if is_boss(m):
        for _ in range(3):
            add_particle("fire", m[0], ground_y(m), monster_height(m) / 2, random.uniform(-2, 2), 0, random.uniform(1, 3), 6, 3)
    else:
        m[8] = m[8] + push_x * 0.12 * 20 / monster_size(m)   # knocked back a little
        add_particle("dust", m[0], ground_y(m), monster_height(m) / 2, 0, 0, 0.3, 10, 3)
    if m[2] <= 0:
        monsters[:] = [other for other in monsters if other is not m]
        print("enemy died:", m[7])
        if is_giant(m):
            score = score + 500
            value = 2000
        elif is_mega(m):
            score = score + 50
            value = 250
        elif is_boss(m):
            score = score + 10
            value = 50
        else:
            score = score + 1
            value = 5
        # it drops its own coin plus every coin it picked up
        for v in [value] + m[11]:
            drop_coin(m[0] + random.uniform(-12, 12), ground_y(m) + random.uniform(-6, 6), v)
        if is_boss(m):
            blow_up_vehicle(m)
        else:
            corpses.append(new_corpse(m, push_x, push_z))
        play_sound(KILL_SOUNDS[m[7]])

def distance_to(s, m):
    dx = s[0] - m[0]
    dy = s[1] - m[1]
    return (dx * dx + dy * dy) ** 0.5

def find_closest(s, stats, skip_index=None):
    # skip_index: skip enemies that already have that effect (5 = slowed, 6 = poisoned)
    target = None
    best = stats["range"]
    for m in monsters:
        if skip_index is not None and m[skip_index] > 0:
            continue
        distance = distance_to(s, m)
        if distance < best:
            best = distance
            target = m
    return target

# ---------- real physics: aiming and flying ----------

def muzzle(s):
    # where the shot leaves the weapon, as (x, ground_y, height)
    if s[3] == "mech":
        return s[0] - 44, s[1] + 22, 44
    hand = s[5]["bow_hand"]
    return s[0] + hand[0] - SOLDIER_TYPES[s[3]]["muzzle"], s[1] + 22, 22 - hand[1]

def aim(sx, sy, sz, target, stats):
    # lead the target: guess the flight time, see where the enemy will be by then, and repeat
    tz = 0 if stats["weapon"] == "grenade" else monster_height(target) * 0.5
    ty = ground_y(target)
    flight_time = 0
    for _ in range(4):
        tx = min(target[0] + monster_speed(target) * flight_time, CASTLE_X)
        dx = tx - sx
        dy = ty - sy
        distance = max(math.hypot(dx, dy), 1)
        if "arc" in stats:
            # lobbed at a fixed angle: work out how long it must fly to come down on the target
            lift = distance * math.tan(stats["arc"]) + sz - tz
            flight_time = math.sqrt(2 * max(lift, 1) / GRAVITY)
            flat_speed = distance / flight_time
            vz = flat_speed * math.tan(stats["arc"])
        else:
            flight_time = distance / stats["speed"]
            flat_speed = stats["speed"]
            vz = (tz - sz) / flight_time
    # nobody aims perfectly: add a little random error, so shots can really miss
    angle = math.atan2(dy, dx) + random.gauss(0, stats["spread"])
    flat_speed = flat_speed * (1 + random.gauss(0, stats["spread"]))
    vz = vz + random.gauss(0, stats["spread"]) * flat_speed * 0.5
    return flat_speed * math.cos(angle), flat_speed * math.sin(angle), vz

def fire(s, stats, target, big=False):
    x, y, z = muzzle(s)
    vx, vy, vz = aim(x, y, z, target, stats)
    projectiles.append({"x": x, "y": y, "z": z, "vx": vx, "vy": vy, "vz": vz,
                        "g": GRAVITY if "arc" in stats else 0, "kind": s[3], "big": big, "age": 0})
    if s[5] is not None:
        kick_ragdoll(s[5])
    else:
        s[6] = 8   # the mech's cannon kicks back
    if stats["weapon"] in ("bullet", "shell"):
        add_particle("flash", x, y, z, 0, 0, 0, 2, 8 if stats["weapon"] == "shell" else 5)
        add_particle("smoke", x, y, z, random.uniform(-0.5, 0), 0, 0.4, 20, 3)

def projectile_hits(p):
    for m in monsters:
        if (abs(p["x"] - m[0]) < monster_half_width(m)
                and abs(p["y"] - ground_y(m)) < 10 + monster_half_width(m) * 0.3
                and 0 <= p["z"] <= monster_height(m)):
            return m
    return None

def update_projectiles():
    for p in projectiles:
        stats = SOLDIER_TYPES[p["kind"]]
        p["age"] = p["age"] + 1
        # fast things move in small steps so they cannot jump through an enemy
        steps = int(math.hypot(p["vx"], p["vy"]) // 6) + 1
        for _ in range(steps):
            p["x"] += p["vx"] / steps
            p["y"] += p["vy"] / steps
            p["z"] += p["vz"] / steps
            p["vz"] -= p["g"] / steps
            target = None if stats["weapon"] == "grenade" else projectile_hits(p)
            if target is not None or p["z"] <= 0:
                land(p, stats, target)
                p["done"] = True
                break
        if p["x"] < -30 or p["x"] > WIDTH or p["y"] < -30 or p["y"] > HEIGHT + 30 or p["age"] > 150:
            p["done"] = True
    projectiles[:] = [p for p in projectiles if not p.get("done")]

def land(p, stats, target):
    weapon = stats["weapon"]
    z = max(p["z"], 0)
    if weapon == "shell":
        explode(p["x"], p["y"], z, stats["blast"], shot_damage(stats), stats.get("mega_half", False), stats.get("giant_half", False))
    elif weapon == "grenade":
        gas_burst(p, stats)
    elif target is not None:
        hit_monster(target, shot_damage(stats), p["vx"], p["vz"])
    elif weapon == "arrow":
        stuck.append({"x": p["x"], "y": p["y"], "vx": p["vx"], "vy": p["vy"], "vz": p["vz"], "life": STUCK_LIFE})
    else:
        add_particle("dust", p["x"], p["y"], 0, 0, 0, 0.3, 14, 3)   # the bullet kicks up dirt

def gas_burst(p, stats):
    x = p["x"]
    y = p["y"]
    kind = "toxic" if stats.get("poison", 0) > 0 else "tear"
    add_particle("dust", x, y, 0, 0, 0, 0.5, 12, 5)
    if p["big"]:
        clouds.append([x, y, CLOUD_LIFE, "toxic", CLOUD_RADIUS])
        return
    for m in monsters:
        if math.hypot(m[0] - x, ground_y(m) - y) < stats["blast"] + monster_half_width(m):
            if kind == "toxic":
                m[6] = max(m[6], stats["poison"])
            else:
                m[5] = max(m[5], stats["freeze"])
    clouds.append([x, y, 30, kind, stats["blast"]])

def launch_clouds():
    # every 20 seconds a gas grenadier lobs a big toxic cloud at the closest enemy
    for s in soldiers:
        stats = SOLDIER_TYPES[s[3]]
        if stats.get("poison", 0) > 0:
            s[4] = s[4] - 1
            if s[4] <= 0:
                target = find_closest(s, stats)
                if target is not None:
                    fire(s, stats, target, big=True)
                    s[4] = CLOUD_EVERY

def update_clouds():
    for c in clouds:
        c[2] = c[2] - 1
        for m in monsters:
            if math.hypot(c[0] - m[0], c[1] - ground_y(m)) < c[4]:
                if c[3] == "toxic":
                    if m[6] <= 0:
                        m[6] = CLOUD_POISON
                else:
                    m[5] = max(m[5], 10)
    clouds[:] = [c for c in clouds if c[2] > 0]

def soldiers_shoot():
    for s in soldiers:
        stats = SOLDIER_TYPES[s[3]]
        s[2] = s[2] - 1
        if s[2] > 0:
            continue
        if s[7] is not None and s[7] <= 0:
            continue   # out of ammo: buy more with the ammo button
        skip_index = None
        if stats.get("poison", 0) > 0:
            skip_index = 6   # do not waste gas on enemies that are already poisoned
        elif stats.get("freeze", 0) > 0:
            skip_index = 5   # or tear gas on enemies that are already slowed
        target = find_closest(s, stats, skip_index)
        if stats.get("giant_half"):
            # the mech always shoots the giant boss first if it can reach it
            giants = [m for m in monsters if is_giant(m) and distance_to(s, m) < stats["range"]]
            if giants:
                target = giants[0]
        if target is not None:
            fire(s, stats, target)
            s[2] = stats["reload"]
            if s[7] is not None:
                s[7] = s[7] - 1

# ---------- explosions, smoke and fire ----------

def add_particle(kind, x, y, z, vx, vy, vz, life, size, color="#3a3a3a"):
    particles.append({"kind": kind, "x": x, "y": y, "z": z, "vx": vx, "vy": vy, "vz": vz,
                      "life": life, "max": life, "size": size, "color": color})

def explode(x, y, z, radius, damage=0, mega_half=False, giant_half=False):
    add_particle("flash", x, y, z, 0, 0, 0, 4, radius * 0.8)
    for _ in range(int(6 + radius / 4)):
        angle = random.uniform(0, 2 * math.pi)
        speed = random.uniform(1, 4)
        add_particle("fire", x, y, z, math.cos(angle) * speed, math.sin(angle) * speed * 0.5,
                     random.uniform(1, 4), random.randint(8, 16), random.uniform(4, 9))
        add_particle("smoke", x + random.uniform(-radius, radius) / 2, y + random.uniform(-radius, radius) / 4, z,
                     random.uniform(-0.5, 0.5), 0, random.uniform(0.5, 1.2), random.randint(25, 45), random.uniform(6, 12))
    for _ in range(int(radius / 5)):
        add_particle("debris", x, y, z, random.uniform(-5, 5), random.uniform(-2, 2), random.uniform(3, 8), 40, 3)
    if damage > 0:
        for m in list(monsters):
            if math.hypot(m[0] - x, ground_y(m) - y) < radius + monster_half_width(m):
                hurt = damage
                if mega_half and is_mega(m):
                    hurt = -(-m[3] // 2)   # half of the heavy tank's max health, rounded up
                if giant_half and is_giant(m):
                    hurt = -(-m[3] // 2)   # half of the giant boss's max health, rounded up
                away = 1 if m[0] >= x else -1   # the blast pushes enemies away from it
                hit_monster(m, hurt, away * 6, 6)

def blow_up_vehicle(m):
    gy = ground_y(m)
    explode(m[0], gy, monster_height(m) * 0.5, monster_half_width(m))
    for _ in range(8):
        add_particle("debris", m[0], gy, monster_height(m) * 0.6, random.uniform(-6, 6), random.uniform(-2, 2),
                     random.uniform(4, 10), 60, 6, "#2e2a26")
    corpses.append({"wreck": True, "kind": m[7], "x": m[0], "y": gy, "life": CORPSE_LIFE,
                    "width": monster_half_width(m), "height": monster_height(m)})

def update_particles():
    for q in particles:
        q["life"] = q["life"] - 1
        q["x"] += q["vx"]
        q["y"] += q["vy"]
        q["z"] += q["vz"]
        if q["kind"] == "debris":
            q["vz"] -= GRAVITY
            if q["z"] < 0:
                # bounce, and slide to a stop on the ground
                q["z"] = 0
                q["vz"] = -q["vz"] * 0.4
                q["vx"] *= 0.6
                q["vy"] *= 0.6
        elif q["kind"] in ("smoke", "fire", "dust"):
            q["vx"] *= 0.95
            q["vy"] *= 0.95
    particles[:] = [q for q in particles if q["life"] > 0]

# ---------- ragdoll corpses ----------

def new_corpse(m, push_x, push_z):
    k = monster_size(m) / 20
    points = {}
    for name, (dx, dz) in CORPSE_POINTS.items():
        # the higher up the body part, the harder the hit throws it
        share = 0.3 + dz / 38
        speed_x = (push_x * 0.35 + random.uniform(-1, 1)) * share
        speed_z = (abs(push_z) * 0.2 + 2.5) * share + random.uniform(0, 1)
        x = m[0] + dx * k
        z = dz * k
        points[name] = [x, z, x - speed_x, z - speed_z]   # [x, z, last_x, last_z]
    lengths = {}
    for a, b in CORPSE_BONES:
        ax, az = CORPSE_POINTS[a]
        bx, bz = CORPSE_POINTS[b]
        lengths[(a, b)] = math.hypot(ax - bx, az - bz) * k
    return {"kind": m[7], "y": ground_y(m), "points": points, "lengths": lengths, "k": k, "life": CORPSE_LIFE}

def update_corpses():
    for c in corpses:
        c["life"] = c["life"] - 1
        if c.get("wreck"):
            # the wreck keeps burning
            if c["life"] % 3 == 0 and c["life"] > 40:
                x = c["x"] + random.uniform(-c["width"], c["width"]) / 2
                add_particle("fire", x, c["y"], c["height"] * 0.6, 0, 0, random.uniform(0.8, 1.6), 12, random.uniform(4, 7))
                add_particle("smoke", x, c["y"], c["height"] * 0.8, random.uniform(-0.3, 0.3), 0, 1, 40, 8)
            continue
        # every point keeps its speed (how far it moved last tick) and gravity pulls it down
        for p in c["points"].values():
            vx = (p[0] - p[2]) * 0.98
            vz = (p[1] - p[3]) * 0.98 - GRAVITY
            p[2] = p[0]
            p[3] = p[1]
            p[0] += vx
            p[1] += vz
            if p[1] < 0:
                p[1] = 0
                p[3] = 0.3 * vz          # bounce a little
                p[2] = p[0] - vx * 0.5   # and the ground slows it down
        # the bones keep the body parts the right distance apart
        for _ in range(3):
            for (a, b), length in c["lengths"].items():
                pa = c["points"][a]
                pb = c["points"][b]
                dx = pb[0] - pa[0]
                dz = pb[1] - pa[1]
                distance = math.hypot(dx, dz) or 0.001
                fix = (distance - length) / distance / 2
                pa[0] += dx * fix
                pa[1] += dz * fix
                pb[0] -= dx * fix
                pb[1] -= dz * fix
        for p in c["points"].values():
            p[1] = max(p[1], 0)
    corpses[:] = [c for c in corpses if c["life"] > 0]

def game_loop():
    global castle_health, playing
    if not playing:
        return
    for m in monsters:
        speed = monster_speed(m)
        m[0] = m[0] + speed + m[8]
        m[8] = m[8] * 0.75     # knockback fades away
        m[9] = m[9] + speed * 0.12
        if m[5] > 0:
            m[5] = m[5] - 1
    reached = [m for m in monsters if m[0] + monster_half_width(m) >= CASTLE_X - 14]
    for m in reached:
        monsters.remove(m)
        if is_giant(m):
            damage_castle(GIANT_BOSS_DAMAGE)
        elif is_mega(m):
            damage_castle(MEGA_BOSS_DAMAGE)
        elif is_boss(m):
            damage_castle(BOSS_DAMAGE)
        else:
            damage_castle(1)
        add_particle("dust", CASTLE_X - 14, ground_y(m), 10, -0.5, 0, 0.5, 20, 8)
    # poison hurts a little every second
    for m in list(monsters):
        if m[6] > 0:
            m[6] = m[6] - 1
            if m[6] % POISON_TICK == 0:
                hit_monster(m, 1)
    pick_up_coins()
    soldiers_shoot()
    enemies_shoot()
    giant_crushes()
    update_enemy_shells()
    launch_clouds()
    update_projectiles()
    update_clouds()
    update_particles()
    update_corpses()
    for a in stuck:
        a["life"] = a["life"] - 1
    stuck[:] = [a for a in stuck if a["life"] > 0]
    update_ragdolls()
    update_info()
    if castle_health <= 0:
        playing = False
        monsters.clear()
        info_text.value = "Game over! You reached wave " + str(wave) + ". Final score: " + str(score)
        title_box.visible = True
    draw_all()

def enemies_shoot():
    # every enemy shoots at the closest soldier it can reach; the giant boss goes for a mech first
    for m in monsters:
        gun = ENEMY_GUNS[m[7]]
        m[10] = m[10] - 1
        if m[10] > 0 or not soldiers:
            continue
        targets = soldiers
        if is_giant(m):
            mechs = [s for s in soldiers if s[3] == "mech"]
            if mechs:
                targets = mechs
        target = min(targets, key=lambda s: distance_to(s, m))
        if distance_to(target, m) > gun["range"]:
            continue
        m[10] = gun["reload"]
        x = m[0] + monster_half_width(m)
        y = ground_y(m)
        z = monster_height(m) * (0.95 if is_boss(m) else 0.6)
        add_particle("flash", x, y, z, 0, 0, 0, 3, gun["size"] * 2 + 2)
        enemy_shells.append({"x": x, "y": y, "z": z, "target": target, "gun": gun})

def giant_crushes():
    # the giant boss flattens any soldier it drives over
    for m in monsters:
        if not is_giant(m):
            continue
        for s in list(soldiers):
            if abs(s[0] - m[0]) < monster_half_width(m) and abs(s[1] + 22 - ground_y(m)) < 30:
                hurt_soldier(s, s[8])

def update_enemy_shells():
    for e in enemy_shells:
        s = e["target"]
        if not any(s is other for other in soldiers):
            e["done"] = True   # the soldier was sold or already destroyed
            continue
        # the shot homes in on the soldier's body
        speed = e["gun"]["speed"]
        tx, ty, tz = s[0], s[1] + 22, 40 if s[3] == "mech" else 20
        dx, dy, dz = tx - e["x"], ty - e["y"], tz - e["z"]
        distance = math.sqrt(dx * dx + dy * dy + dz * dz)
        if distance <= speed:
            e["done"] = True
            hurt_soldier(s, e["gun"]["damage"])
            continue
        e["x"] += dx / distance * speed
        e["y"] += dy / distance * speed
        e["z"] += dz / distance * speed
    enemy_shells[:] = [e for e in enemy_shells if not e.get("done")]

def hurt_soldier(s, damage):
    gy = s[1] + 22
    if s[3] == "mech":
        explode(s[0], gy, 40, 30)   # just the fire and smoke, no damage to enemies
    else:
        add_particle("dust", s[0], gy, 20, 0, 0, 0.5, 10, 4)
        if s[5] is not None:
            kick_ragdoll(s[5])
    s[8] = s[8] - damage
    if s[8] <= 0:
        soldiers.remove(s)
        if s[3] == "mech":
            explode(s[0], gy, 30, 50)
            for _ in range(8):
                add_particle("debris", s[0], gy, 40, random.uniform(-6, 6), random.uniform(-2, 2),
                             random.uniform(4, 10), 60, 6, "#39434d")
            play_sound("/System/Library/Sounds/Basso.aiff")
        else:
            for _ in range(6):
                add_particle("debris", s[0], gy, 20, random.uniform(-3, 3), random.uniform(-1, 1),
                             random.uniform(2, 5), 40, 3, SOLDIER_TYPES[s[3]]["color"])
            play_sound("/System/Library/Sounds/Tink.aiff")
        update_info()

# ---------- drawing ----------

def poly(x, gy, k, face, points, color):
    # draws a shape from (forward, height) points; face is 1 for facing right, -1 for facing left
    coords = []
    for dx, dz in points:
        coords.append(x + face * dx * k)
        coords.append(gy - dz * k)
    board.polygon(*coords, color=color, outline=True)

def draw_tank_shape(x, gy, k, face, body, dark, recoil=0):
    def pt(dx, dz):
        return x + face * dx * k, gy - dz * k
    board.oval(x - 50 * k, gy - 7 * k, x + 50 * k, gy + 7 * k, color=SHADOW)
    poly(x, gy, k, face, [(-44, 2), (44, 2), (49, 9), (44, 16), (-44, 16), (-49, 9)], "#2a2a2a")   # tracks
    for dx in range(-36, 37, 12):
        cx, cz = pt(dx, 8)
        board.oval(cx - 5 * k, cz - 5 * k, cx + 5 * k, cz + 5 * k, color="#4a4a4a", outline=True)
        board.oval(cx - 2 * k, cz - 2 * k, cx + 2 * k, cz + 2 * k, color="#7a7a7a")
    poly(x, gy, k, face, [(-46, 15), (42, 15), (50, 22), (40, 30), (-44, 30)], body)              # hull
    start = pt(14 - recoil, 37)
    end = pt(70 - recoil * 1.5, 37)
    board.line(start[0], start[1], end[0], end[1], color=dark, width=max(5 * k, 2))                # main gun
    board.oval(end[0] - 4 * k, end[1] - 4 * k, end[0] + 4 * k, end[1] + 4 * k, color=dark)          # muzzle brake
    poly(x, gy, k, face, [(-24, 30), (14, 30), (22, 38), (14, 46), (-20, 46), (-26, 40)], body)    # turret
    hatch = pt(-6, 47)
    board.oval(hatch[0] - 6 * k, hatch[1] - 3 * k, hatch[0] + 6 * k, hatch[1] + 2 * k, color=dark)
    gun_start = pt(-4, 50)
    gun_end = pt(12, 51)
    board.line(gun_start[0], gun_start[1], gun_end[0], gun_end[1], color="#1c1c1c", width=max(2 * k, 1))
    stripe_a = pt(-36, 22)
    stripe_b = pt(-20, 26)
    board.rectangle(min(stripe_a[0], stripe_b[0]), stripe_b[1], max(stripe_a[0], stripe_b[0]), stripe_a[1], color=dark)

def draw_apc(x, gy, body):
    board.oval(x - 58, gy - 8, x + 58, gy + 8, color=SHADOW)
    poly(x, gy, 1, 1, [(-50, 10), (46, 10), (56, 24), (44, 44), (-50, 44)], body)    # hull
    poly(x, gy, 1, 1, [(-50, 10), (46, 10), (50, 16), (-50, 16)], "#2a2a2a")          # dark skirt
    for dx in (-34, -12, 12, 34):
        board.oval(x + dx - 11, gy - 22, x + dx + 11, gy, color="#1c1c1c")
        board.oval(x + dx - 4, gy - 15, x + dx + 4, gy - 7, color="#6a6a6a")
    poly(x, gy, 1, 1, [(-16, 44), (14, 44), (18, 50), (14, 56), (-16, 56)], body)     # turret
    board.line(x + 16, gy - 51, x + 46, gy - 51, color="#1c1c1c", width=3)           # machine gun
    board.rectangle(x + 30, gy - 34, x + 40, gy - 30, color="#111111")              # vision slit
    board.rectangle(x - 38, gy - 32, x - 22, gy - 26, color="#8b1a1a")              # red marking
    board.oval(x - 8, gy - 60, x + 4, gy - 55, color="#2a2a2a")                     # hatch

def draw_infantry(m):
    x = m[0]
    gy = ground_y(m)
    k = monster_size(m) / 20
    uniform, helmet = ENEMY_LOOK[m[7]]
    if m[5] > 0:
        uniform = "#8fa3b5"   # coughing in tear gas
    elif m[6] > 0:
        uniform = "#5f7a2e"   # poisoned
    swing = math.sin(m[9]) * 7

    def pt(dx, dz):
        return x + dx * k, gy - dz * k

    board.oval(x - 13 * k, gy - 4 * k, x + 13 * k, gy + 4 * k, color=SHADOW)
    hip = pt(0, 17)
    shoulder = pt(1, 31)
    # back arm swings opposite to the legs
    back_hand = pt(-swing * 0.6 - 2, 19)
    board.line(shoulder[0], shoulder[1], back_hand[0], back_hand[1], color=uniform, width=4 * k)
    # walking legs that bend at the knee
    for foot_dx in (swing, -swing):
        knee = pt(foot_dx * 0.5 + 2, 8)
        foot = pt(foot_dx, 0)
        board.line(hip[0], hip[1], knee[0], knee[1], color="#2e2e2e", width=4 * k)
        board.line(knee[0], knee[1], foot[0], foot[1], color="#2e2e2e", width=4 * k)
        board.oval(foot[0] - 3 * k, foot[1] - 2.5 * k, foot[0] + 4 * k, foot[1] + 1.5 * k, color="black")
    board.line(hip[0], hip[1], shoulder[0], shoulder[1], color=uniform, width=9 * k)
    board.line(hip[0] - 4 * k, hip[1] - 1 * k, hip[0] + 4 * k, hip[1] - 1 * k, color="#2b1d12", width=2 * k)   # belt
    if is_tough(m):
        board.rectangle(x - 5 * k, gy - 30 * k, x + 6 * k, gy - 19 * k, color="#55595e", outline=True)        # armor vest
    # rifle pointed at the castle
    stock = pt(-6, 21)
    grip = pt(3, 24)
    barrel = pt(22, 26)
    board.line(stock[0], stock[1], grip[0], grip[1], color="#5a3b1e", width=4 * k)
    board.line(grip[0], grip[1], barrel[0], barrel[1], color="#1e1e1e", width=3 * k)
    front_hand = pt(12, 25)
    board.line(shoulder[0], shoulder[1], front_hand[0], front_hand[1], color=uniform, width=4 * k)
    board.oval(front_hand[0] - 2 * k, front_hand[1] - 2 * k, front_hand[0] + 2 * k, front_hand[1] + 2 * k, color=SKIN)
    # head with a helmet
    hx, hy = pt(2, 38)
    board.oval(hx - 6 * k, hy - 6 * k, hx + 6 * k, hy + 6 * k, color="#e8957a", outline=True)   # red with anger
    board.oval(hx - 7 * k, hy - 9 * k, hx + 7 * k, hy + 1 * k, color=helmet, outline=True)
    board.line(hx - 8 * k, hy - 1 * k, hx + 8 * k, hy - 1 * k, color=helmet, width=2 * k)
    # angry face: eyebrow slanting down toward the nose, glaring eye and a frown
    board.line(hx + 1 * k, hy + 0.2 * k, hx + 5.5 * k, hy + 1.8 * k, color="black", width=1.5 * k)
    board.oval(hx + 2.5 * k, hy + 1.5 * k, hx + 4.5 * k, hy + 3.3 * k, color="black")
    board.line(hx + 2.5 * k, hy + 5 * k, hx + 4 * k, hy + 4 * k, color="#5a1a1a", width=1 * k)
    board.line(hx + 4 * k, hy + 4 * k, hx + 5.5 * k, hy + 5 * k, color="#5a1a1a", width=1 * k)
    if is_tough(m):
        # riot shield carried in front
        board.rectangle(x + 15 * k, gy - 40 * k, x + 20 * k, gy - 4 * k, color="#3c4248", outline=True)
        board.rectangle(x + 16 * k, gy - 34 * k, x + 19 * k, gy - 30 * k, color="#9fc3d6")

def draw_monster(m):
    if m[5] > 0:
        body = "#8fa3b5"
    elif m[6] > 0:
        body = "#5f7a2e"
    else:
        body = None
    gy = ground_y(m)
    if is_giant(m):
        draw_tank_shape(m[0], gy, 3.0, 1, body or "#5a2a26", "#2e1614")
    elif is_mega(m):
        draw_tank_shape(m[0], gy, 2.0, 1, body or "#5a5a52", "#33332e")
    elif is_boss(m):
        draw_apc(m[0], gy, body or "#5d6150")
    else:
        draw_infantry(m)
    if m[11]:
        # a little coin above the head shows it is carrying stolen money
        cx, cy = m[0], gy - monster_height(m) - (24 if is_boss(m) else 8)
        board.oval(cx - 4, cy - 4, cx + 4, cy + 4, color="gold", outline=True)
        board.text(cx + 5, cy - 8, "$" + str(sum(m[11])), color="gold", size=8, bold=True)
    if is_boss(m):
        # health bar above the vehicle
        half = monster_half_width(m)
        top = gy - monster_height(m) - 14
        board.rectangle(m[0] - half, top, m[0] + half, top + 8, color="black")
        board.rectangle(m[0] - half, top, m[0] - half + half * 2 * m[2] / m[3], top + 8, color="lime")

def draw_corpse(c):
    if c.get("wreck"):
        if c["kind"] == "boss":
            draw_apc(c["x"], c["y"], "#2e2a26")
        elif c["kind"] == "giant":
            draw_tank_shape(c["x"], c["y"], 3.0, 1, "#2e2a26", "#1b1917")
        else:
            draw_tank_shape(c["x"], c["y"], 2.0, 1, "#2e2a26", "#1b1917")
        return
    points = c["points"]
    y = c["y"]
    k = c["k"]
    uniform, helmet = ENEMY_LOOK[c["kind"]]

    def sp(name):
        return points[name][0], y - points[name][1]

    hip = sp("hip")
    shoulder = sp("shoulder")
    head = sp("head")
    board.oval(hip[0] - 14 * k, y - 4 * k, hip[0] + 14 * k, y + 4 * k, color=SHADOW)
    for foot_name in ("foot_l", "foot_r"):
        foot = sp(foot_name)
        board.line(hip[0], hip[1], foot[0], foot[1], color="#2e2e2e", width=4 * k)
        board.oval(foot[0] - 3 * k, foot[1] - 2 * k, foot[0] + 3 * k, foot[1] + 2 * k, color="black")
    for hand_name in ("hand_l", "hand_r"):
        hand = sp(hand_name)
        board.line(shoulder[0], shoulder[1], hand[0], hand[1], color=uniform, width=4 * k)
        board.oval(hand[0] - 2 * k, hand[1] - 2 * k, hand[0] + 2 * k, hand[1] + 2 * k, color=SKIN)
    board.line(hip[0], hip[1], shoulder[0], shoulder[1], color=uniform, width=9 * k)
    # the helmet sits on the top of the head, whichever way the head has flopped
    dx = head[0] - shoulder[0]
    dy = head[1] - shoulder[1]
    length = math.hypot(dx, dy) or 1
    ux = dx / length
    uy = dy / length
    board.oval(head[0] - 6 * k, head[1] - 6 * k, head[0] + 6 * k, head[1] + 6 * k, color=SKIN, outline=True)
    hx = head[0] + ux * 3 * k
    hy = head[1] + uy * 3 * k
    board.oval(hx - 6 * k, hy - 6 * k, hx + 6 * k, hy + 6 * k, color=helmet, outline=True)

def draw_person(s):
    x = s[0]
    y = s[1]
    kind = s[3]
    stats = SOLDIER_TYPES[kind]
    uniform = stats["color"]
    p = s[5]
    hip = (x + p["hip"][0], y + p["hip"][1])
    head = (x + p["head"][0], y + p["head"][1])
    shoulder = (x + (hip[0] - x) * 0.4, y - 5)
    bow = (x + p["bow_hand"][0], y + p["bow_hand"][1])          # front hand
    string = (x + p["string_hand"][0], y + p["string_hand"][1])  # back hand
    left_foot = (x + p["left_foot"][0], y + p["left_foot"][1])
    right_foot = (x + p["right_foot"][0], y + p["right_foot"][1])
    pants = uniform if kind == "poison" else "#3b3b2e"
    hands = "#2e2e2e" if kind in ("poison", "freezer") else SKIN

    board.oval(x - 14, y + 18, x + 14, y + 26, color=SHADOW)
    # floppy legs, torso and arms are all lines joined to the wobbling body parts
    for foot in (left_foot, right_foot):
        board.line(hip[0], hip[1], foot[0], foot[1], color=pants, width=5)
        board.oval(foot[0] - 5, foot[1] - 2, foot[0] + 3, foot[1] + 3, color="black")
    if kind == "archer":
        board.line(shoulder[0] + 7, shoulder[1] - 9, hip[0] + 8, hip[1] - 2, color="#6b4423", width=5)   # quiver
        board.line(shoulder[0] + 7, shoulder[1] - 9, shoulder[0] + 9, shoulder[1] - 15, color="white", width=2)
    elif kind == "poison":
        board.oval(shoulder[0] + 3, shoulder[1] - 5, shoulder[0] + 13, hip[1], color="#6b8e23", outline=True)   # gas tank
    board.line(hip[0], hip[1], shoulder[0], shoulder[1], color=uniform, width=9)
    if kind == "strong":
        board.line(shoulder[0] - 4, shoulder[1] + 1, hip[0] + 4, hip[1] - 2, color="#3b3b2e", width=2)   # webbing
    board.line(shoulder[0], shoulder[1], string[0], string[1], color=uniform, width=4)
    board.oval(string[0] - 3, string[1] - 3, string[0] + 3, string[1] + 3, color=hands)

    # the weapon
    if kind == "archer":
        top = (bow[0] + 3, bow[1] - 18)
        bottom = (bow[0] + 3, bow[1] + 18)
        board.line(top[0], top[1], bow[0] - 5, bow[1], color="saddlebrown", width=3)
        board.line(bow[0] - 5, bow[1], bottom[0], bottom[1], color="saddlebrown", width=3)
        board.line(top[0], top[1], string[0], string[1], color="white")
        board.line(bottom[0], bottom[1], string[0], string[1], color="white")
        if s[2] <= 0:
            board.line(string[0], string[1], bow[0] - 12, bow[1], color="dimgray", width=2)   # arrow ready to fire
    elif kind in ("strong", "boss killer"):
        board.line(string[0] + 9, string[1] + 4, string[0] - 2, string[1], color="#6b4423", width=6)   # wooden stock
        board.line(string[0], string[1], bow[0] - stats["muzzle"], bow[1] - 1, color="#222222", width=4 if kind == "strong" else 3)
        if kind == "strong":
            board.line(bow[0] + 4, bow[1], bow[0] + 6, bow[1] + 8, color="#222222", width=4)   # magazine
        else:
            board.rectangle(bow[0] + 1, bow[1] - 7, bow[0] + 13, bow[1] - 3, color="#111111")   # scope
            board.oval(bow[0] - 1, bow[1] - 7, bow[0] + 2, bow[1] - 3, color="#7fdfff")
            board.line(bow[0] - 26, bow[1], bow[0] - 30, bow[1] + 10, color="#222222")         # bipod
    else:
        # grenade launcher with a colored band near the end
        end = bow[0] - stats["muzzle"]
        board.line(string[0] + 6, string[1] + 2, end, bow[1] - 1, color="#3a3a3a", width=7)
        board.line(end + 2, bow[1] - 1, end + 6, bow[1] - 1, color=stats["shot"], width=7)
        board.oval(bow[0] + 2, bow[1] - 2, bow[0] + 10, bow[1] + 6, color="#2b2b2b")
    board.line(shoulder[0], shoulder[1], bow[0], bow[1], color=uniform, width=4)
    board.oval(bow[0] - 3, bow[1] - 3, bow[0] + 3, bow[1] + 3, color=hands)

    # head and headgear
    hx, hy = head
    if kind == "poison":
        board.oval(hx - 9, hy - 9, hx + 9, hy + 9, color=uniform, outline=True)              # hazmat hood
        board.oval(hx - 8, hy - 4, hx + 1, hy + 4, color="#9be7ff", outline=True)            # visor
        board.oval(hx - 12, hy + 2, hx - 5, hy + 8, color="#556b2f", outline=True)          # filter
    elif kind == "freezer":
        board.oval(hx - 8, hy - 8, hx + 8, hy + 8, color=SKIN, outline=True)
        board.oval(hx - 9, hy - 12, hx + 9, hy + 1, color="#2f3a46", outline=True)          # helmet
        board.oval(hx - 8, hy - 5, hx + 5, hy + 8, color="#4a4a4a", outline=True)           # gas mask
        board.oval(hx - 7, hy - 4, hx - 3, hy, color="#b0d8e8")
        board.oval(hx - 2, hy - 4, hx + 2, hy, color="#b0d8e8")
        board.oval(hx - 13, hy + 1, hx - 6, hy + 8, color="#2b2b2b")                         # filter
    else:
        board.oval(hx - 8, hy - 8, hx + 8, hy + 8, color=SKIN, outline=True)
        board.oval(hx - 6, hy - 2, hx - 2, hy + 2, color="black")   # eye looking left at the enemies
        if kind == "archer":
            board.triangle(hx - 9, hy - 2, hx + 9, hy - 2, hx, hy - 16, color="forestgreen", outline=True)   # hood
        elif kind == "strong":
            board.oval(hx - 10, hy - 12, hx + 10, hy + 1, color="#556b2f", outline=True)    # helmet
            board.line(hx - 11, hy - 1, hx + 10, hy - 1, color="#3e4f22", width=2)
            board.line(hx + 6, hy, hx + 2, hy + 7, color="#2e2e2e")                          # chin strap
        elif kind == "boss killer":
            board.oval(hx - 8, hy - 13, hx + 8, hy - 2, color="#4a5a35", outline=True)      # boonie hat
            board.line(hx - 13, hy - 3, hx + 12, hy - 3, color="#4a5a35", width=3)
            board.line(hx - 7, hy + 3, hx - 1, hy + 3, color="#3e4f22", width=2)             # face paint

def draw_mech(s):
    # a big walking robot facing left, with a cannon on its arm
    x = s[0]
    gy = s[1] + 22
    body = SOLDIER_TYPES["mech"]["color"]
    dark = "#39434d"
    recoil = s[6]
    board.oval(x - 26, gy - 5, x + 26, gy + 5, color=SHADOW)
    for dx in (-12, 8):
        board.rectangle(x + dx, gy - 30, x + dx + 8, gy - 4, color=dark, outline=True)        # legs
        board.rectangle(x + dx - 4, gy - 6, x + dx + 12, gy, color="#2a2f35")                  # feet
    board.rectangle(x - 18, gy - 58, x + 18, gy - 28, color=body, outline=True)               # body
    board.rectangle(x - 10, gy - 70, x + 8, gy - 58, color=body, outline=True)                # head
    board.rectangle(x - 9, gy - 66, x - 1, gy - 62, color="cyan")                             # eye
    board.rectangle(x + 18, gy - 56, x + 26, gy - 36, color=dark, outline=True)               # back arm
    board.rectangle(x - 26 + recoil, gy - 50, x - 14 + recoil, gy - 38, color=dark, outline=True)   # cannon arm
    board.rectangle(x - 44 + recoil, gy - 47, x - 26 + recoil, gy - 41, color="#2a2f35")     # cannon barrel

def draw_soldier(s):
    if s[3] == "mech":
        draw_mech(s)
        top = s[1] - 58
        half = 22
    else:
        draw_person(s)
        top = s[1] - 42
        half = 12
    # health bar above the soldier's head
    board.rectangle(s[0] - half, top, s[0] + half, top + 4, color="black")
    board.rectangle(s[0] - half, top, s[0] - half + 2 * half * max(s[8], 0) / SOLDIER_TYPES[s[3]]["health"], top + 4, color="lime")
    if s[7] is not None:
        # bullets left, shown next to the sniper's head
        if s[7] > 0:
            board.text(s[0] - 58, s[1] - 30, "ammo " + str(s[7]), color="white", size=9, bold=True)
        else:
            board.text(s[0] - 62, s[1] - 30, "NO AMMO", color="red", size=9, bold=True)

def draw_bricks(x1, y1, x2, y2, rng, shades):
    row = 0
    for y in range(y1, y2, 16):
        offset = 12 if row % 2 == 1 else 0
        bx = x1 - offset
        while bx < x2:
            board.rectangle(max(bx, x1), y, min(bx + 24, x2), min(y + 16, y2),
                            color=rng.choice(shades), outline=True, outline_color="#5c5853")
            bx = bx + 24
        row = row + 1

def draw_background():
    # drawn once at the start; it never changes, so it is not redrawn every tick
    rng = random.Random(42)
    # mowed grass in stripes
    for i, y in enumerate(range(0, HEIGHT, 20)):
        board.rectangle(0, y, WIDTH, y + 20, color="#5e9140" if i % 2 == 0 else "#58893a")
    # a dirt battlefield with bumpy edges
    top_edge = [(x, 118 + rng.randint(-6, 6)) for x in range(0, CASTLE_X + 31, 30)]
    bottom_edge = [(x, 282 + rng.randint(-6, 6)) for x in range(CASTLE_X + 30, -1, -30)]
    coords = []
    for x, y in top_edge + bottom_edge:
        coords.append(x)
        coords.append(y)
    board.polygon(*coords, color="#9c8358")
    for _ in range(12):
        px = rng.randint(0, CASTLE_X)
        py = rng.randint(135, 265)
        board.oval(px - 30, py - 8, px + 30, py + 8, color="#a68e62")
    # tire ruts
    for lane in (165, 235):
        for x in range(0, CASTLE_X, 20):
            board.line(x, lane + math.sin(x / 50) * 3, x + 20, lane + math.sin((x + 20) / 50) * 3, color="#87714b", width=3)
    # pebbles
    for _ in range(70):
        px = rng.randint(0, CASTLE_X)
        py = rng.randint(125, 275)
        r = rng.uniform(1, 2.5)
        board.oval(px - r, py - r * 0.7, px + r, py + r * 0.7, color=rng.choice(["#7d7468", "#8f8678", "#6b6359"]))
    # grass tufts and flowers
    for _ in range(160):
        px = rng.randint(0, CASTLE_X)
        py = rng.choice([rng.randint(5, 108), rng.randint(294, HEIGHT)])
        color = rng.choice(["#3f6e28", "#6aa04a", "#4d7f31"])
        board.line(px, py, px - 2, py - 5, color=color)
        board.line(px, py, px, py - 6, color=color)
        board.line(px, py, px + 2, py - 5, color=color)
    for _ in range(15):
        px = rng.randint(0, CASTLE_X - 30)
        py = rng.choice([rng.randint(50, 105), rng.randint(300, 360)])
        board.oval(px - 2, py - 2, px + 2, py + 2, color=rng.choice(["white", "#ffe066", "#ff9ecb"]))
    # rocks
    for _ in range(7):
        px = rng.randint(20, CASTLE_X - 60)
        py = rng.choice([rng.randint(60, 100), rng.randint(300, 350)])
        board.polygon(px - 9, py + 3, px - 6, py - 5, px + 3, py - 7, px + 10, py - 1, px + 7, py + 4, color="#8a857c", outline=True)
        board.line(px - 5, py - 4, px + 2, py - 6, color="#b3aea4", width=2)
    # trees along the top edge
    for x in range(30, 500, 75):
        tx = x + rng.randint(-15, 15)
        ty = rng.randint(14, 28)
        board.oval(tx - 18, ty + 6, tx + 26, ty + 20, color=SHADOW)
        board.rectangle(tx - 3, ty, tx + 3, ty + 16, color="#5a3d22")
        board.oval(tx - 18, ty - 22, tx + 8, ty + 4, color="#2f5e22")
        board.oval(tx - 6, ty - 28, tx + 18, ty, color="#356b26")
        board.oval(tx - 12, ty - 16, tx + 14, ty + 8, color="#3f7a2c")
        board.oval(tx - 8, ty - 22, tx + 4, ty - 12, color="#4f8f38")
    # bushes along the bottom edge
    for x in range(20, 500, 90):
        bx = x + rng.randint(-15, 15)
        by = rng.randint(380, 394)
        board.oval(bx - 16, by - 10, bx + 4, by + 6, color="#2f5e22")
        board.oval(bx - 6, by - 14, bx + 16, by + 6, color="#3f7a2c")

    # the castle casts a shadow on the grass
    for i, color in enumerate(["#55863a", "#4e7d35", "#467330"]):
        board.rectangle(CASTLE_X - 44 + i * 10, 0, CASTLE_X - 34 + i * 10, HEIGHT, color=color)
    # stone wall, every brick a slightly different gray
    draw_bricks(CASTLE_X, 0, WIDTH, HEIGHT, rng, ["#8f8b84", "#99958d", "#857f78", "#a39f97", "#7d7871"])
    # battlements sticking out on the enemy side, lit from the top
    for y in range(0, HEIGHT, 40):
        board.rectangle(CASTLE_X - 14, y + 6, CASTLE_X, y + 28, color="#99958d", outline=True, outline_color="#5c5853")
        board.rectangle(CASTLE_X - 14, y + 6, CASTLE_X, y + 9, color="#b3afa6")
        board.rectangle(CASTLE_X - 14, y + 25, CASTLE_X, y + 28, color="#6d6963")
    # arrow slits
    for top in (38, 328):
        board.rectangle(CASTLE_X + 23, top, CASTLE_X + 35, top + 34, color="#6e6a64")
        board.rectangle(CASTLE_X + 26, top + 3, CASTLE_X + 32, top + 31, color="black")
    # gate tower in the middle
    draw_bricks(CASTLE_X - 18, 112, WIDTH, 288, rng, ["#86827b", "#7e7a73", "#8e8a82", "#77736c"])
    for y in range(112, 288, 36):
        board.rectangle(CASTLE_X - 30, y + 4, CASTLE_X - 18, y + 24, color="#8e8a82", outline=True, outline_color="#5c5853")
        board.rectangle(CASTLE_X - 30, y + 4, CASTLE_X - 18, y + 7, color="#aaa69d")
    # wooden gate made of planks, with iron bands
    board.oval(CASTLE_X + 6, 146, WIDTH - 6, 198, color="#4a4540")
    board.rectangle(CASTLE_X + 6, 172, WIDTH - 6, 274, color="#4a4540")
    board.oval(CASTLE_X + 10, 150, WIDTH - 10, 194, color="#7a4e2a")
    for i, px in enumerate(range(CASTLE_X + 10, WIDTH - 10, 8)):
        board.rectangle(px, 172, min(px + 8, WIDTH - 10), 270, color="#7a4e2a" if i % 2 == 0 else "#6c4322",
                        outline=True, outline_color="#4a2e16")
    for band in (196, 240):
        board.rectangle(CASTLE_X + 10, band, WIDTH - 10, band + 4, color="#2e2e2e")
        for rx in range(CASTLE_X + 14, WIDTH - 10, 8):
            board.oval(rx - 1, band + 1, rx + 1, band + 3, color="#777777")
    board.oval(CASTLE_X + 36, 215, CASTLE_X + 42, 221, color="gold", outline=True)
    # torch brackets and the flag pole
    for ty in (150, 250):
        board.rectangle(CASTLE_X - 8, ty, CASTLE_X - 4, ty + 16, color="#3a3a3a")
    board.line(WIDTH - 30, 120, WIDTH - 30, 78, color="#333333", width=3)
    board.oval(WIDTH - 33, 73, WIDTH - 27, 79, color="gold")

def draw_castle_details():
    # the parts of the castle that move or change
    for ty in (150, 250):
        flicker = random.uniform(0.8, 1.2)
        board.oval(CASTLE_X - 10, ty - 12 * flicker, CASTLE_X - 2, ty + 1, color="#ff8c1a")
        board.oval(CASTLE_X - 8, ty - 7 * flicker, CASTLE_X - 4, ty, color="#ffe066")
    # the flag waves in the wind
    t = time.time()
    top = []
    bottom = []
    for i in range(6):
        fx = WIDTH - 30 - i * 5
        wave_y = math.sin(t * 6 - i) * i * 0.6
        top.append((fx, 80 + wave_y))
        bottom.append((fx, 98 + wave_y))
    coords = []
    for fx, fy in top + bottom[::-1]:
        coords.append(fx)
        coords.append(fy)
    board.polygon(*coords, color="#b22222", outline=True)
    # steel armor plates on the battlements: one plate for every 2 armor points
    for i in range(min(10, (castle_armor + 1) // 2)):
        y = i * 40
        board.rectangle(CASTLE_X - 16, y + 5, CASTLE_X + 2, y + 29, color="#7f8c99", outline=True, outline_color="#3c4650")
        board.rectangle(CASTLE_X - 16, y + 5, CASTLE_X + 2, y + 8, color="#b8c4cf")
        for ry in (y + 12, y + 24):
            board.oval(CASTLE_X - 13, ry - 1, CASTLE_X - 11, ry + 1, color="#3c4650")
            board.oval(CASTLE_X - 3, ry - 1, CASTLE_X - 1, ry + 1, color="#3c4650")
    # cracks appear when the castle is damaged
    if castle_health <= max_castle_health * 0.6:
        board.line(CASTLE_X, 90, CASTLE_X + 18, 105, color="black", width=2)
        board.line(CASTLE_X + 18, 105, CASTLE_X + 8, 125, color="black", width=2)
    if castle_health <= max_castle_health * 0.3:
        board.line(CASTLE_X + 60, 300, CASTLE_X + 40, 320, color="black", width=2)
        board.line(CASTLE_X + 40, 320, CASTLE_X + 55, 345, color="black", width=2)
        board.line(CASTLE_X, 20, CASTLE_X + 15, 35, color="black", width=2)

def draw_cloud(c):
    # a gas cloud is a bunch of puffs; the same cloud always has the same puffs
    rng = random.Random(int(c[0] * 7 + c[1] * 13))
    fade = min(c[2] / 20, 1)
    colors = ["#a8d84a", "#9ac43a"] if c[3] == "toxic" else ["#dadddd", "#c8cccc"]
    for _ in range(8):
        px = c[0] + rng.uniform(-0.7, 0.7) * c[4]
        py = c[1] + rng.uniform(-0.35, 0.35) * c[4]
        r = c[4] * rng.uniform(0.25, 0.45) * (0.6 + 0.4 * fade)
        board.oval(px - r, py - r * 0.7, px + r, py + r * 0.5, color=rng.choice(colors))

def draw_projectile(p):
    stats = SOLDIER_TYPES[p["kind"]]
    weapon = stats["weapon"]
    sx = p["x"]
    sy = p["y"] - p["z"]
    dx = p["vx"]
    dy = p["vy"] - p["vz"]   # how it moves on screen
    length = math.hypot(dx, dy) or 1
    ux = dx / length
    uy = dy / length
    if weapon in ("arrow", "grenade"):
        board.oval(p["x"] - 2, p["y"] - 1, p["x"] + 2, p["y"] + 1, color=SHADOW)   # shadow on the ground
    if weapon == "arrow":
        tail = (sx - ux * 16, sy - uy * 16)
        board.line(tail[0], tail[1], sx, sy, color="#8b5a2b", width=2)
        board.line(sx - ux * 4, sy - uy * 4, sx + ux * 2, sy + uy * 2, color="#3a3a3a", width=3)
        board.line(tail[0], tail[1], tail[0] - ux * 4 - uy * 3, tail[1] - uy * 4 + ux * 3, color="white", width=2)
        board.line(tail[0], tail[1], tail[0] - ux * 4 + uy * 3, tail[1] - uy * 4 - ux * 3, color="white", width=2)
    elif weapon == "grenade":
        board.oval(sx - 3.5, sy - 3.5, sx + 3.5, sy + 3.5, color="#333333")
        board.oval(sx - 1.5, sy - 1.5, sx + 1.5, sy + 1.5, color=stats["shot"])
    elif weapon == "shell":
        board.line(sx - dx * 0.8, sy - dy * 0.8, sx, sy, color=stats["shot"], width=3)
        board.oval(sx - 3, sy - 3, sx + 3, sy + 3, color="#2a2a2a")
    else:
        board.line(sx - dx * 0.7, sy - dy * 0.7, sx, sy, color=stats["shot"], width=2)   # tracer

def draw_particle(q):
    x = q["x"]
    y = q["y"] - q["z"]
    left = q["life"] / q["max"]   # 1 when new, 0 when gone
    kind = q["kind"]
    if kind == "flash":
        r = q["size"] * (0.5 + left * 0.5)
        board.oval(x - r, y - r, x + r, y + r, color="#fff6c8")
    elif kind == "fire":
        if left > 0.75:
            color = "#fff2a8"
        elif left > 0.5:
            color = "#ffc23d"
        elif left > 0.25:
            color = "#ff7b1c"
        else:
            color = "#b8321a"
        r = q["size"] * (0.5 + left * 0.5)
        board.oval(x - r, y - r, x + r, y + r, color=color)
    elif kind == "smoke":
        if left > 0.66:
            color = "#4d4d4d"
        elif left > 0.33:
            color = "#6f6f6f"
        else:
            color = "#949494"
        r = q["size"] * (1.6 - left * 0.6)
        board.oval(x - r, y - r, x + r, y + r, color=color)
    elif kind == "dust":
        r = q["size"] * (1.8 - left * 0.8)
        board.oval(x - r, y - r * 0.7, x + r, y + r * 0.7, color="#b39a6e")
    else:
        r = q["size"]
        board.rectangle(x - r, y - r * 0.6, x + r, y + r * 0.6, color=q["color"])

def draw_all():
    board.tk.delete("!bg")   # remove everything except the background
    draw_castle_details()
    for c in clouds:
        draw_cloud(c)
    for a in stuck:
        # the arrow is stuck in the ground at the angle it came down
        length = math.hypot(a["vx"], a["vz"]) or 1
        ux = a["vx"] / length
        uz = a["vz"] / length
        board.line(a["x"], a["y"], a["x"] - ux * 12, a["y"] + uz * 12, color="#8b5a2b", width=2)
        board.line(a["x"] - ux * 12, a["y"] + uz * 12, a["x"] - ux * 15, a["y"] + uz * 15, color="white", width=3)
    # draw from the back of the field to the front, so nearer things cover farther ones
    things = []
    for c in corpses:
        things.append((c["y"], draw_corpse, c))
    for m in monsters:
        things.append((ground_y(m), draw_monster, m))
    for s in soldiers:
        things.append((s[1] + 22, draw_soldier, s))
    things.sort(key=lambda thing: thing[0])
    for _, draw, thing in things:
        draw(thing)
    for c in coins:
        draw_coin(c)
    for p in projectiles:
        draw_projectile(p)
    for e in enemy_shells:
        sx, sy = e["x"], e["y"] - e["z"]
        r = e["gun"]["size"]
        board.oval(sx - r, sy - r, sx + r, sy + r, color=e["gun"]["color"], outline=r > 3)
    for q in particles:
        draw_particle(q)

def change_monster_speed():
    # each click: x1 -> x2 -> x3 -> back to x1
    global monster_speed_up
    monster_speed_up = monster_speed_up % 3 + 1
    speed_button.text = "Enemy speed x" + str(monster_speed_up)

def toggle_delete_mode():
    global delete_mode
    delete_mode = not delete_mode
    if delete_mode:
        if sell_mode:
            toggle_sell_mode()
        delete_button.text = "Deleting... (click a soldier)"
    else:
        delete_button.text = "Delete soldier"

def toggle_sell_mode():
    global sell_mode
    sell_mode = not sell_mode
    if sell_mode and delete_mode:
        toggle_delete_mode()
    if sell_mode:
        sell_button.text = "Selling... (click a soldier)"
    else:
        sell_button.text = "Sell soldier"

def sell_soldier_at(x, y, refund=True):
    global money
    # check the newest soldier first, because it is drawn on top
    for s in reversed(soldiers):
        reach = 30 if s[3] == "mech" else 25
        top = -60 if s[3] == "mech" else -37
        if abs(s[0] - x) < reach and top < y - s[1] < 26:
            if refund:
                money = money + SOLDIER_TYPES[s[3]]["cost"]   # full money back
            soldiers.remove(s)
            update_info()
            draw_all()
            return

def drop_coin(x, y, value):
    coins.append({"x": x, "y": min(max(y, 20), HEIGHT - 5), "value": value, "spin": random.uniform(0, 6)})

def pick_up_coins():
    # enemies grab any coin they walk over and carry it until they die
    for m in monsters:
        for c in list(coins):
            if abs(c["x"] - m[0]) < monster_half_width(m) and abs(c["y"] - ground_y(m)) < 12:
                coins.remove(c)
                m[11].append(c["value"])

def coin_radius(c):
    return {5: 6, 50: 9, 250: 12}.get(c["value"], 16)

def collect_coin(c):
    global money
    coins.remove(c)
    money = money + c["value"]
    for _ in range(6):
        add_particle("fire", c["x"], c["y"], 6, random.uniform(-2, 2), random.uniform(-1, 1), random.uniform(1, 3), 10, 3, "gold")
    play_sound("/System/Library/Sounds/Glass.aiff")
    update_info()
    draw_all()

def draw_coin(c):
    # the coin spins: it gets thinner and wider as it turns
    c["spin"] = c["spin"] + 0.15
    r = coin_radius(c)
    w = max(abs(math.cos(c["spin"])) * r, 1.5)
    x, y = c["x"], c["y"] - r - 2
    board.oval(x - r, c["y"] - 2, x + r, c["y"] + 2, color=SHADOW)
    board.oval(x - w, y - r, x + w, y + r, color="gold", outline=True)
    if w > r * 0.6:
        board.text(x - r * 0.35, y - r * 0.8, "$", color="#8a6d00", size=max(int(r * 0.9), 6), bold=True)

def tab_pressed(event):
    # cheat key: Tab kills every enemy on the field, and they all drop their coins
    if playing:
        for m in list(monsters):
            hit_monster(m, m[2])
        update_info()
        draw_all()
    return "break"

def clicked(event):
    if not playing:
        return
    # coins come first: a click on a coin turns it into money
    for c in reversed(coins):
        if math.hypot(c["x"] - event.x, c["y"] - 6 - event.y) < coin_radius(c) + 6:
            collect_coin(c)
            return
    if sell_mode:
        sell_soldier_at(event.x, event.y)
        return
    if delete_mode:
        sell_soldier_at(event.x, event.y, refund=False)
        return
    for m in monsters:
        reach = monster_size(m) + 15
        if abs(m[0] - event.x) < reach and abs(m[1] - event.y) < reach:
            hit_monster(m, 1, -4, 2)
            break

app = App(title="Castle Defense", width=WIDTH + 380, height=HEIGHT + 130)

top_bar = Box(app, width="fill", align="top")
for kind in ("strong", "archer", "poison", "freezer", "boss killer"):
    stats = SOLDIER_TYPES[kind]
    PushButton(top_bar, text=stats["name"] + " ($" + str(stats["cost"]) + ")", command=buy_soldier, args=[kind], align="left")
upgrade_button = PushButton(top_bar, text="Upgrade weapons ($" + str(UPGRADE_COST) + ")", command=buy_upgrade, align="left")
armor_button = PushButton(top_bar, text="Armor +" + str(ARMOR_PACK) + " ($" + str(ARMOR_COST) + ")", command=buy_armor, align="left")
ammo_button = PushButton(top_bar, text="Sniper ammo x" + str(AMMO_PACK) + " ($" + str(AMMO_COST) + ")", command=buy_ammo, align="left")
sell_button = PushButton(top_bar, text="Sell soldier", command=toggle_sell_mode, align="left")
speed_button = PushButton(top_bar, text="Enemy speed x1", command=change_monster_speed, align="left")
reset_button = PushButton(top_bar, text="Reset", command=reset_game, align="left")

bottom_bar = Box(app, width="fill", align="bottom")
money_text = Text(bottom_bar, text="$0", size=20, color="green", align="left")
mech_button = PushButton(bottom_bar, text="Mech ($" + str(SOLDIER_TYPES["mech"]["cost"]) + ")", command=buy_soldier, args=["mech"], align="right")
delete_button = PushButton(bottom_bar, text="Delete soldier", command=toggle_delete_mode, align="right")

info_text = Text(app, text="Pick a difficulty to start!", size=16)
board = Drawing(app, width=WIDTH, height=HEIGHT)
board.when_clicked = clicked
app.tk.bind_all("<Tab>", tab_pressed)   # replaces Tab's normal job of moving between buttons
title_box = Box(app, width="fill")
Text(title_box, text="CASTLE DEFENSE", size=24, color="darkred")
Text(title_box, text="Choose your difficulty", size=14)
for level in DIFFICULTIES:
    PushButton(title_box, text=level, command=start_game, args=[level])

draw_background()
board.tk.addtag_all("bg")
draw_all()
app.repeat(50, game_loop)
app.repeat(1000, spawn_monster)
app.display()
