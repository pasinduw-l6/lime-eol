"""Crops the Lime wordmark down to its circular symbol, as a square PNG.

The full logo is 878x387. Dropped into a square icon slot it renders at less
than half the height of the square brand logos beside it, which is why it looked
small. The symbol alone is square and sits at the same visual weight.
"""

from PIL import Image

im = Image.open('nav-logo.png').convert('RGBA')
width, height = im.size

# The symbol occupies the leftmost square-ish region; the wordmark follows.
mark = im.crop((0, 0, int(height * 1.02), height))

# Trim transparent padding so the symbol fills its square edge to edge.
bbox = mark.getbbox()
if bbox:
    mark = mark.crop(bbox)

side = max(mark.size)
square = Image.new('RGBA', (side, side), (0, 0, 0, 0))
square.paste(mark, ((side - mark.width) // 2, (side - mark.height) // 2))

square = square.resize((256, 256), Image.LANCZOS)
square.save('lime-mark.png')
print(f'source {width}x{height} -> lime-mark.png {square.size[0]}x{square.size[1]}')
