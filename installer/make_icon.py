# -*- coding: utf-8 -*-
"""
Genera el icono de ESPECTRA (assets/espectra.ico) replicando el logo de la
interfaz: cuadro redondeado con gradiente naranja->rosa y la onda blanca "〰".
Uso:  C:\\Python\\python.exe installer\\make_icon.py
"""
import os
import math
from PIL import Image, ImageDraw

# Colores de marca (de styles.css: --grad)
C1 = (245, 98, 30)    # #f5621e
C2 = (251, 93, 62)    # #fb5d3e
C3 = (236, 72, 153)   # #ec4899

S = 1024              # lienzo de alta resolucion (se reescala luego)


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def gradient_color(t):
    # t en [0,1]; tramo 0..0.55 = C1->C2, 0.55..1 = C2->C3
    if t <= 0.55:
        return lerp(C1, C2, t / 0.55)
    return lerp(C2, C3, (t - 0.55) / 0.45)


def make_gradient(size, angle_deg=120):
    """Gradiente lineal diagonal en 'angle_deg'."""
    img = Image.new("RGB", (size, size))
    px = img.load()
    ang = math.radians(angle_deg)
    dx, dy = math.cos(ang), math.sin(ang)
    # proyeccion min/max para normalizar
    corners = [(0, 0), (size, 0), (0, size), (size, size)]
    projs = [cx * dx + cy * dy for cx, cy in corners]
    pmin, pmax = min(projs), max(projs)
    span = (pmax - pmin) or 1
    for y in range(size):
        base = y * dy
        for x in range(size):
            t = ((x * dx + base) - pmin) / span
            px[x, y] = gradient_color(t)
    return img


def rounded_mask(size, radius):
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return m


def draw_wave(draw, size):
    """Onda blanca centrada (estilo 〰), trazo liso por estampado de circulos."""
    cx = size / 2
    amp = size * 0.095          # amplitud
    width = size * 0.54         # ancho total de la onda
    x0 = cx - width / 2
    cy = size * 0.5
    r = size * 0.042            # radio del "pincel" (mitad del grosor)
    n = 600
    for i in range(n + 1):
        t = i / n
        x = x0 + width * t
        # dos ciclos de seno -> aspecto de "〰"
        y = cy - amp * math.sin(t * 2 * math.pi * 2)
        draw.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, 255))


def build():
    grad = make_gradient(S, 120).convert("RGBA")
    mask = rounded_mask(S, radius=int(S * 0.22))
    canvas = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    canvas.paste(grad, (0, 0), mask)
    # dibuja la onda sobre el cuadro
    draw = ImageDraw.Draw(canvas)
    draw_wave(draw, S)
    # aplica de nuevo la mascara para recortar la onda a las esquinas
    r, g, b, a = canvas.split()
    a = Image.composite(a, Image.new("L", (S, S), 0), mask)
    canvas = Image.merge("RGBA", (r, g, b, a))

    here = os.path.dirname(os.path.abspath(__file__))
    assets = os.path.join(os.path.dirname(here), "assets")
    os.makedirs(assets, exist_ok=True)

    # PNG de vista previa
    png = os.path.join(assets, "espectra.png")
    canvas.resize((256, 256), Image.LANCZOS).save(png)

    # ICO multi-resolucion
    ico = os.path.join(assets, "espectra.ico")
    sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
    canvas.save(ico, format="ICO", sizes=sizes)
    print("Generado:", ico)
    print("Generado:", png)


if __name__ == "__main__":
    build()
