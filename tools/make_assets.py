"""Рисует assets/favicon.png и assets/og.png (превью ссылки). Нужен Pillow."""
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
ASSETS.mkdir(exist_ok=True)
FONTS = Path("C:/Windows/Fonts")


def favicon():
    # верстак-«сетка» 3x3 с ярким центром
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((0, 0, 63, 63), 12, fill=(20, 16, 48))
    colors = [(183, 123, 255), (94, 231, 223), (125, 255, 106), (255, 207, 74)]
    random.seed(3)
    for gy in range(3):
        for gx in range(3):
            x, y = 8 + gx * 17, 8 + gy * 17
            c = (255, 207, 74) if (gx, gy) == (1, 1) else random.choice(colors)
            d.rectangle((x, y, x + 13, y + 13), fill=c)
    img.save(ASSETS / "favicon.png")


def og():
    W, H = 1200, 630
    img = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(img)
    for y in range(H):
        k = y / H
        d.line([(0, y), (W, y)], fill=(int(7 + 13 * k), int(9 + 7 * k), int(18 + 30 * k)))
    random.seed(7)
    for _ in range(140):
        x, y = random.randrange(W), random.randrange(int(H * 0.6))
        d.rectangle((x, y, x + 2, y + 2), fill=(220, 228, 255))
    for color, base, block in (((26, 21, 51), 430, 24), ((20, 26, 46), 490, 24), ((13, 19, 34), 550, 24)):
        h = base
        for x in range(0, W, block):
            h += random.choice((-block, 0, 0, block))
            h = max(base - 72, min(base + 48, h))
            d.rectangle((x, h, x + block, H), fill=color)
    glow = Image.new("RGB", (W, H))
    ImageDraw.Draw(glow).ellipse((250, 120, 950, 420), fill=(90, 50, 160))
    img = Image.blend(img, glow.filter(ImageFilter.GaussianBlur(120)), 0.35)
    d = ImageDraw.Draw(img)
    title = ImageFont.truetype(str(FONTS / "seguibl.ttf"), 132)
    sub = ImageFont.truetype(str(FONTS / "segoeui.ttf"), 40)
    d.text((W // 2, 250), "Modsmith", font=title, fill=(244, 246, 255), anchor="mm")
    d.text((W // 2, 360), "Модпак Minecraft по описанию", font=sub, fill=(200, 205, 230), anchor="mm")
    d.text((W // 2, 420), "«магия и драконы на 1.20.1» → готовая сборка", font=sub, fill=(125, 255, 106), anchor="mm")
    img.save(ASSETS / "og.png")


favicon()
og()
print("saved", ASSETS)
