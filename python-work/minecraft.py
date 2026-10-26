"""
Mini Minecraft made with Ursina.

Controls:
    W A S D      - move
    Space        - jump
    Mouse        - look around
    Left click   - break block
    Right click  - place block
    1 - 6        - choose block (or mouse scroll)
    Esc          - free the mouse / quit
"""
import math
import random

from ursina import *
from ursina.prefabs.first_person_controller import FirstPersonController

app = Ursina(title='Mini Minecraft')
window.fps_counter.enabled = True

WORLD_SIZE = 20

BLOCKS = {
    'grass':   color.rgb(95, 159, 53),
    'dirt':    color.rgb(134, 96, 67),
    'stone':   color.rgb(125, 125, 125),
    'wood':    color.rgb(102, 81, 51),
    'leaves':  color.rgb(60, 120, 40),
    'brick':   color.rgb(160, 70, 50),
    'bedrock': color.rgb(40, 40, 40),
}
HOTBAR = ['grass', 'dirt', 'stone', 'wood', 'leaves', 'brick']
selected = 0


class Block(Button):
    def __init__(self, position=(0, 0, 0), kind='grass'):
        super().__init__(
            parent=scene,
            position=position,
            model='cube',
            origin_y=0.5,
            texture='white_cube',
            color=BLOCKS[kind],
            highlight_color=BLOCKS[kind].tint(0.2),
        )
        self.kind = kind

    def input(self, key):
        if not self.hovered:
            return
        if key == 'right mouse down':
            new_pos = self.position + mouse.normal
            # don't place a block inside the player
            if distance(new_pos, player.position + Vec3(0, 1, 0)) > 1.2:
                Block(position=new_pos, kind=HOTBAR[selected])
        if key == 'left mouse down' and self.kind != 'bedrock':
            destroy(self)


def height_at(x, z):
    """Smooth rolling hills without needing a noise library."""
    h = math.sin(x / 4) * 1.5 + math.cos(z / 5) * 1.5 + math.sin((x + z) / 7)
    return int(h + 3)


def make_tree(x, y, z):
    for i in range(4):
        Block((x, y + i, z), 'wood')
    for dx in range(-1, 2):
        for dz in range(-1, 2):
            for dy in range(3, 5):
                if dx == 0 and dz == 0 and dy == 3:
                    continue
                Block((x + dx, y + dy, z + dz), 'leaves')
    Block((x, y + 5, z), 'leaves')


# build the world
random.seed(1)
for x in range(WORLD_SIZE):
    for z in range(WORLD_SIZE):
        top = height_at(x, z)
        Block((x, 0, z), 'bedrock')
        for y in range(1, top):
            Block((x, y, z), 'stone' if y < top - 1 else 'dirt')
        Block((x, top, z), 'grass')
        if 2 < x < WORLD_SIZE - 3 and 2 < z < WORLD_SIZE - 3 and random.random() < 0.02:
            make_tree(x, top + 1, z)

# hotbar UI
slots = []
for i, kind in enumerate(HOTBAR):
    slot = Entity(
        parent=camera.ui, model='quad', color=BLOCKS[kind],
        scale=0.07, position=(-0.2 + i * 0.08, -0.43),
    )
    Text(parent=camera.ui, text=str(i + 1), position=(-0.23 + i * 0.08, -0.395), scale=0.8)
    slots.append(slot)
selector = Entity(parent=camera.ui, model=Quad(mode='line', thickness=3),
                  color=color.white, scale=0.08, position=slots[0].position, z=-1)
block_label = Text(text=HOTBAR[0], position=(0, -0.35), origin=(0, 0))

player = FirstPersonController(position=(WORLD_SIZE / 2, 10, WORLD_SIZE / 2))


def select(index):
    global selected
    selected = index
    selector.position = slots[index].position
    block_label.text = HOTBAR[index]


def input(key):
    if key in [str(i + 1) for i in range(len(HOTBAR))]:
        select(int(key) - 1)
    if key == 'scroll up':
        select((selected - 1) % len(HOTBAR))
    if key == 'scroll down':
        select((selected + 1) % len(HOTBAR))
    if key == 'escape':
        if mouse.locked:
            mouse.locked = False
        else:
            application.quit()
    if key == 'left mouse down' and not mouse.locked:
        mouse.locked = True


def update():
    # fell off the world? respawn
    if player.y < -10:
        player.position = (WORLD_SIZE / 2, 10, WORLD_SIZE / 2)


Sky(color=color.rgb(135, 206, 235))
app.run()
