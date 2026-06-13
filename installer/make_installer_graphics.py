# -*- coding: utf-8 -*-
"""
Genera los gráficos de branding para el instalador ESPECTRA-Setup.exe
- Pantalla de presentación inicial (presentation.png) con logos ESPECTRA + Hingenia
  y crédito a Ingeniero Abel Julcarima.
- Banner lateral para el wizard (wizard_banner.png)
- Small image para la esquina superior del wizard.

Se ejecuta después de make_icon.py (necesita assets/espectra.png).

Uso local:
  python installer/make_installer_graphics.py

Colores de marca sincronizados con el logo ESPECTRA.
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

# Colores de marca (mismos que make_icon.py)
C1 = (245, 98, 30)      # #f5621e
C2 = (251, 93, 62)      # #fb5d3e
C3 = (236, 72, 153)     # #ec4899
DARK = (31, 41, 55)     # #1f2937 texto principal
MUTED = (75, 85, 99)    # #4b5563 texto secundario
WHITE = (255, 255, 255)
LIGHT_BG = (250, 250, 252)

S = 1024  # para cálculos internos

def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))

def gradient_color(t):
    if t <= 0.55:
        return lerp(C1, C2, t / 0.55)
    return lerp(C2, C3, (t - 0.55) / 0.45)

def make_accent_bar(width, height, direction='horizontal'):
    """Barra de acento con gradiente de marca."""
    img = Image.new("RGB", (width, height))
    px = img.load()
    for x in range(width):
        t = x / max(1, width - 1)
        color = gradient_color(t)
        for y in range(height):
            px[x, y] = color
    return img

def get_font(size, bold=False):
    """Intenta cargar fuentes del sistema (Segoe UI / Arial) con fallback."""
    candidates = []
    if bold:
        candidates = [
            "C:\\Windows\\Fonts\\segoeuib.ttf",   # Segoe UI Bold
            "C:\\Windows\\Fonts\\arialbd.ttf",    # Arial Bold
            "C:\\Windows\\Fonts\\calibrib.ttf",
        ]
    else:
        candidates = [
            "C:\\Windows\\Fonts\\segoeui.ttf",    # Segoe UI
            "C:\\Windows\\Fonts\\arial.ttf",
            "C:\\Windows\\Fonts\\calibri.ttf",
        ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                pass
    return ImageFont.load_default()

def create_presentation_image():
    """Imagen principal de presentación (primera pantalla del instalador).
    Tamaño pensado para wizard moderno ~520-560 px de ancho.
    """
    width, height = 540, 300
    canvas = Image.new("RGB", (width, height), LIGHT_BG)
    draw = ImageDraw.Draw(canvas)

    # Barra superior de acento
    bar = make_accent_bar(width, 8)
    canvas.paste(bar, (0, 0))

    # Cargar logo ESPECTRA generado previamente (el cuadrado con onda)
    here = os.path.dirname(os.path.abspath(__file__))
    assets = os.path.join(os.path.dirname(here), "assets")
    logo_path = os.path.join(assets, "espectra.png")

    logo = None
    if os.path.exists(logo_path):
        logo = Image.open(logo_path).convert("RGBA")
        # Escalar el logo a un tamaño hero
        logo_size = 118
        logo = logo.resize((logo_size, logo_size), Image.LANCZOS)

    # Posición del logo (izquierda, centrado verticalmente en la zona superior)
    logo_x = 48
    logo_y = 38
    if logo:
        canvas.paste(logo, (logo_x, logo_y), logo)

    # Fuentes
    font_brand = get_font(42, bold=True)      # ESPECTRA
    font_sub = get_font(18, bold=False)       # subtítulo
    font_joint = get_font(15, bold=False)     # "Creación conjunta..."
    font_credit = get_font(17, bold=True)     # Nombre del ingeniero

    # Texto principal - ESPECTRA (a la derecha del logo)
    text_x = logo_x + 138
    text_y = logo_y + 12
    draw.text((text_x, text_y), "ESPECTRA", font=font_brand, fill=DARK)

    # Subtítulo
    draw.text((text_x, text_y + 48), "Análisis Sísmico E.030 (2026)", font=font_sub, fill=MUTED)

    # Línea decorativa sutil
    line_y = text_y + 82
    draw.line([(text_x, line_y), (text_x + 260, line_y)], fill=(229, 231, 235), width=1)

    # Creación conjunta
    joint_y = line_y + 18
    draw.text((text_x, joint_y), "Creación conjunta con", font=font_joint, fill=MUTED)

    # HINGENIA (énfasis en color de marca)
    hingenia_y = joint_y + 20
    draw.text((text_x, hingenia_y), "HINGENIA", font=get_font(19, bold=True), fill=C1)

    # Crédito principal - centrado más abajo
    credit_text = "Ingeniero Abel Julcarima"
    # Calcular centro para el crédito
    bbox = draw.textbbox((0, 0), credit_text, font=font_credit)
    credit_width = bbox[2] - bbox[0]
    credit_x = (width - credit_width) // 2
    credit_y = 230
    draw.text((credit_x, credit_y), credit_text, font=font_credit, fill=DARK)

    # Pequeño pie
    footer = "Conector para ETABS • Windows"
    bbox_f = draw.textbbox((0, 0), footer, font=get_font(11))
    footer_width = bbox_f[2] - bbox_f[0]
    draw.text(((width - footer_width) // 2, 265), footer, font=get_font(11), fill=(156, 163, 175))

    return canvas

def create_wizard_banner():
    """Banner lateral izquierdo clásico de Inno Setup (ancho ~164-180, alto ~314+)."""
    w, h = 180, 340
    canvas = Image.new("RGB", (w, h), WHITE)
    draw = ImageDraw.Draw(canvas)

    # Fondo con gradiente vertical suave usando la paleta de marca
    for y in range(h):
        t = y / max(1, h - 1)
        # Mezcla ligera hacia el gradiente de marca
        r = int(250 - t * 30)
        g = int(250 - t * 55)
        b = int(252 - t * 40)
        for x in range(w):
            canvas.putpixel((x, y), (r, g, b))

    # Barra lateral izquierda con el gradiente de marca
    bar_width = 12
    for y in range(h):
        t = y / max(1, h - 1)
        color = gradient_color(t * 0.7)
        for x in range(bar_width):
            canvas.putpixel((x, y), color)

    # Cargar y pegar versión pequeña del logo ESPECTRA
    here = os.path.dirname(os.path.abspath(__file__))
    assets = os.path.join(os.path.dirname(here), "assets")
    logo_path = os.path.join(assets, "espectra.png")
    if os.path.exists(logo_path):
        logo = Image.open(logo_path).convert("RGBA")
        logo = logo.resize((78, 78), Image.LANCZOS)
        logo_x = (w - 78) // 2
        canvas.paste(logo, (logo_x, 48), logo)

    # Texto
    font_small = get_font(13, bold=True)
    draw.text((22, 142), "ESPECTRA", font=font_small, fill=DARK)
    draw.text((22, 160), "E.030 (2026)", font=get_font(11), fill=MUTED)

    # Línea
    draw.line([(22, 182), (w-22, 182)], fill=(229, 231, 235), width=1)

    font_tiny = get_font(10)
    draw.text((22, 196), "Con Hingenia", font=font_tiny, fill=C1)
    draw.text((22, 212), "Ingeniero Abel", font=font_tiny, fill=MUTED)
    draw.text((22, 226), "Julcarima", font=font_tiny, fill=MUTED)

    return canvas

def create_wizard_small():
    """Small image que aparece en la esquina superior del wizard."""
    size = 64
    # Usamos el logo ESPECTRA redondeado como small image
    here = os.path.dirname(os.path.abspath(__file__))
    assets = os.path.join(os.path.dirname(here), "assets")
    logo_path = os.path.join(assets, "espectra.png")
    if os.path.exists(logo_path):
        logo = Image.open(logo_path).convert("RGBA")
        logo = logo.resize((size, size), Image.LANCZOS)
        return logo
    # Fallback: cuadrado de color
    img = Image.new("RGBA", (size, size), C1)
    return img

def build():
    here = os.path.dirname(os.path.abspath(__file__))
    assets = os.path.join(os.path.dirname(here), "assets")
    os.makedirs(assets, exist_ok=True)

    # 1. Pantalla de presentación principal (la que ve el usuario al abrir el instalador)
    pres = create_presentation_image()
    pres_png = os.path.join(assets, "espectra-presentation.png")
    pres_bmp = os.path.join(assets, "espectra-presentation.bmp")
    pres.save(pres_png, "PNG")
    pres.save(pres_bmp, "BMP")
    print("Generado:", pres_png)
    print("Generado:", pres_bmp)

    # 2. Banner lateral del wizard (BMP recomendado para WizardImageFile en Inno Setup)
    banner = create_wizard_banner()
    banner_png = os.path.join(assets, "espectra-wizard-banner.png")
    banner_bmp = os.path.join(assets, "espectra-wizard-banner.bmp")
    banner.save(banner_png, "PNG")
    banner.save(banner_bmp, "BMP")
    print("Generado:", banner_png)
    print("Generado:", banner_bmp)

    # 3. Small image para la esquina superior del wizard (BMP para compatibilidad)
    small = create_wizard_small()
    small_png = os.path.join(assets, "espectra-wizard-small.png")
    small_bmp = os.path.join(assets, "espectra-wizard-small.bmp")
    small.save(small_png, "PNG")
    small.save(small_bmp, "BMP")
    print("Generado:", small_png)
    print("Generado:", small_bmp)

if __name__ == "__main__":
    build()
