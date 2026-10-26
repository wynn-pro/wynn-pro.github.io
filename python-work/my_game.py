import gc
import re

from panda3d.core import loadPrcFileData
loadPrcFileData('', 'gl-version 3 2')

from ursina import *
from ursina.shader import Shader


def upgrade_shaders_for_mac():
    """macOS core profile needs GLSL #version 150; Ursina's shaders use 130/140."""
    for obj in gc.get_objects():
        if isinstance(obj, Shader):
            for part in ('vertex', 'fragment'):
                src = getattr(obj, part, None)
                if isinstance(src, str):
                    object.__setattr__(obj, part, re.sub(r'#version\s+1[34]0', '#version 150', src.lstrip()))
            obj.compiled = False
    for obj in gc.get_objects():
        if isinstance(obj, Entity) and isinstance(getattr(obj, '_shader', None), Shader):
            obj.shader = obj._shader


app = Ursina()
upgrade_shaders_for_mac()

# Your game code here
test_square = Entity(model='cube', color=color.green)

app.run()
